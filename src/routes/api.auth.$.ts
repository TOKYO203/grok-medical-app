import { createFileRoute } from "@tanstack/react-router";
import { getAuth, lastAuthError } from "@/lib/auth/server";

/**
 * Catch-all Better Auth — toutes les routes `/api/auth/*` sont déléguées à
 * `auth.handler(request)` : sign-in, callback OAuth, get-session, sign-out,
 * refresh, etc.
 *
 * ⚠️ Le `getAuth()` est lazy (pas d'init au top-level) : Cloudflare Workers
 * interdit l'I/O et le crypto dans le scope global. On doit donc l'appeler
 * à l'intérieur de chaque handler.
 *
 * ⚠️ En mode `VITE_AUTH_ENABLED=false`, `getAuth()` retourne le stub SSR qui
 * renvoie 404 — comportement attendu pour les instances publiques sans auth.
 */
function debugJson(request: Request, error: unknown): Response {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? (error.stack ?? "").split("\n").slice(0, 4).join(" | ") : "";
  return new Response(JSON.stringify({ authDebug: message, authStack: stack }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

function handleAuth(request: Request): Promise<Response> | Response {
  try {
    const out = getAuth().handler(request);
    if (out instanceof Promise) {
      return out.then(
        (response) => response,
        (asyncErr) => debugJson(request, asyncErr),
      );
    }
    return out;
  } catch (syncErr) {
    return debugJson(request, syncErr);
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuth(request),
      POST: async ({ request }) => handleAuth(request),
      PUT: async ({ request }) => handleAuth(request),
      DELETE: async ({ request }) => handleAuth(request),
    },
  },
});
