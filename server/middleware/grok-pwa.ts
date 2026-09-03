/**
 * Deployed-app (Nitro) half of the platform PWA chrome.
 *
 * To speed up cold starts on serverless platforms (Vercel) we lazily import
 * the heavier shared modules and the raw install page only when needed.
 * This avoids paying for IO/parse at module-initialization time for functions
 * that don't need PWA logic.
 */

interface GrokPwaEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function requestHost(event: GrokPwaEvent): string {
  return (
    event.req.headers.get("x-forwarded-host") ?? event.req.headers.get("host") ?? event.url.host
  );
}

// Cache imports so subsequent requests reuse the loaded modules inside the
// same function instance (reduces overhead after cold start).
let cached: {
  loaded: boolean;
  installPageTemplate?: string;
  grokOgIdentity?: { site: unknown };
  createHeadInjector?: (opts: { host: string; site: unknown }) => any;
  acceptsHtml?: (accept?: string | null) => boolean;
  isDocumentPath?: (path: string) => boolean;
  isInstallQuery?: (q: string) => boolean;
  renderInstallPageHtml?: (tpl: string, opts: { host: string; url: string }) => string;
  renderWebManifest?: (host: string) => string;
} = { loaded: false };

async function ensureCachedModules() {
  if (cached.loaded) return;
  // Dynamic import of the raw template and shared helpers.
  // These imports are only performed on the first request that actually
  // needs PWA behavior, reducing function init time for other paths.
  const [tplMod, sharedMod, ogMod] = await Promise.all([
    import("../../scripts/install-page.html?raw") as Promise<{ default: string }> ,
    import("../../scripts/grok-pwa-shared.mjs") as Promise<any>,
    import("virtual:grok-og-identity") as Promise<{ grokOgIdentity: { site: unknown } }>,
  ]);

  cached.installPageTemplate = (tplMod as any).default;
  cached.grokOgIdentity = (ogMod as any).grokOgIdentity;
  cached.createHeadInjector = (sharedMod as any).createHeadInjector;
  cached.acceptsHtml = (sharedMod as any).acceptsHtml;
  cached.isDocumentPath = (sharedMod as any).isDocumentPath;
  cached.isInstallQuery = (sharedMod as any).isInstallQuery;
  cached.renderInstallPageHtml = (sharedMod as any).renderInstallPageHtml;
  cached.renderWebManifest = (sharedMod as any).renderWebManifest;
  cached.loaded = true;
}

function injectHeadStreaming(response: Response, host: string) {
  // createHeadInjector assumed available
  const injector = cached.createHeadInjector!({ host, site: cached.grokOgIdentity!.site });
  const transformed = (response.body as ReadableStream<Uint8Array>).pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        for (const out of injector.push(chunk)) controller.enqueue(out);
      },
      flush(controller) {
        for (const out of injector.flush()) controller.enqueue(out);
      },
    }),
  );
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function grokPwaMiddleware(
  event: GrokPwaEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") return next();

  const path = event.url.pathname;
  const urlWithQuery = path + event.url.search;

  // Lightweight fast-paths that don't need the shared modules.
  if (path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json") {
    // Ensure modules are loaded because renderWebManifest is in the shared module.
    await ensureCachedModules();
    return new Response(cached.renderWebManifest!(requestHost(event)), {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }

  // For the install page we need the template + helpers.
  if (
    (await (async () => {
      // We must load the shared module to check isInstallQuery / isDocumentPath.
      await ensureCachedModules();
      return cached.isInstallQuery!(urlWithQuery) && cached.isDocumentPath!(path) && cached.acceptsHtml!(event.req.headers.get("accept"));
    })())
  ) {
    const html = cached.renderInstallPageHtml!(cached.installPageTemplate!, {
      host: requestHost(event),
      url: urlWithQuery,
    });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }

  if (!cached.loaded) {
    // Avoid loading the shared modules for non-document paths.
    if (!(await (async () => {
      // If the path is not a document path, skip loading.
      await ensureCachedModules();
      return cached.isDocumentPath!(path);
    })())) {
      return next();
    }
  } else if (!cached.isDocumentPath!(path)) {
    return next();
  }

  const result = await next();
  if (
    result instanceof Response &&
    result.body &&
    String(result.headers.get("content-type") ?? "").includes("text/html") &&
    !result.headers.get("content-encoding")
  ) {
    // Ensure modules loaded (should be already in the document path branch).
    await ensureCachedModules();
    return injectHeadStreaming(result, requestHost(event));
  }
  return result;
}
