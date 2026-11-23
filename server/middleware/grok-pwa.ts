/**
 * Deployed-app (Nitro) half of the platform PWA chrome.
 *
 * ROBUSTESSE PROD (incident 500 worker) : ce middleware s'exécute sur TOUTES
 * les requêtes GET, y compris /api/*. Aucun de ses chemins ne doit pouvoir
 * lever vers h3 : chaque appel est défensif et retombe sur next() en cas
 * d'échec (head-injection et page d'install sont des bonus, pas des
 * prérequis). Les imports lourds restent paresseux mais leurs échecs sont
 * absorbés au lieu de casser la requête.
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
const cached: {
  loaded: boolean;
  failed: boolean;
  installPageTemplate?: string;
  grokOgIdentity?: { site: unknown };
  createHeadInjector?: (opts: { host: string; site: unknown }) => any;
  acceptsHtml?: (accept?: string | null) => boolean;
  isDocumentPath?: (path: string) => boolean;
  isInstallQuery?: (q: string) => boolean;
  renderInstallPageHtml?: (tpl: string, opts: { host: string; url: string }) => string;
  renderWebManifest?: (host: string) => string;
} = { loaded: false, failed: false };

async function ensureCachedModules(): Promise<boolean> {
  if (cached.loaded) return true;
  if (cached.failed) return false;
  try {
    const [tplMod, sharedMod, ogMod] = await Promise.all([
      import("../../scripts/install-page.html?raw") as Promise<{ default: string }>,
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
    return true;
  } catch (error) {
    // Un échec de chargement (module virtuel absent du bundle Nitro, etc.)
    // ne doit JAMAIS casser la requête : on dégrade sans chrome PWA.
    cached.failed = true;
    console.error("[grok-pwa] lazy modules unavailable, degrading:", error instanceof Error ? error.message : error);
    return false;
  }
}

function safePath(event: GrokPwaEvent): string {
  try {
    return event.url.pathname;
  } catch {
    return "/";
  }
}

function safeSearch(event: GrokPwaEvent): string {
  try {
    return event.url.search;
  } catch {
    return "";
  }
}

function injectHeadStreaming(response: Response, host: string) {
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
  try {
    const method = (event.req.method ?? "GET").toUpperCase();
    if (method !== "GET") return next();

    const path = safePath(event);
    const urlWithQuery = path + safeSearch(event);

    if (path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json") {
      const ok = await ensureCachedModules();
      if (ok && typeof cached.renderWebManifest === "function") {
        return new Response(cached.renderWebManifest!(requestHost(event)), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "no-cache",
          },
        });
      }
      return next();
    }

    const modulesReady = await ensureCachedModules();
    const isDocument = modulesReady && typeof cached.isDocumentPath === "function" ? cached.isDocumentPath!(path) : true;
    const isInstall =
      modulesReady &&
      typeof cached.isInstallQuery === "function" &&
      typeof cached.acceptsHtml === "function" &&
      cached.isInstallQuery!(urlWithQuery) &&
      isDocument &&
      cached.acceptsHtml!(event.req.headers.get("accept"));

    if (isInstall && typeof cached.renderInstallPageHtml === "function") {
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

    if (!isDocument) return next();

    const result = await next();
    if (
      result instanceof Response &&
      result.body &&
      String(result.headers.get("content-type") ?? "").includes("text/html") &&
      !result.headers.get("content-encoding") &&
      modulesReady &&
      typeof cached.createHeadInjector === "function"
    ) {
      try {
        return injectHeadStreaming(result, requestHost(event));
      } catch (error) {
        console.error("[grok-pwa] head injection failed, returning raw response:", error instanceof Error ? error.message : error);
        return result;
      }
    }
    return result;
  } catch (error) {
    // Filet absolu : ce middleware ne doit jamais être la cause d'un 500.
    console.error("[grok-pwa] middleware error, falling through to next():", error instanceof Error ? error.message : error);
    return next();
  }
}
