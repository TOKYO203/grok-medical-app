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
function handleAuth(request: Request): Promise<Response> | Response {
  const out = getAuth().handler(request);
  if (out instanceof Promise) {
    return out.then(async (response) => {
      if (new URL(request.url).searchParams.get("authdebug") === "1") {
        const err = lastAuthError();
        if (err) {
          return new Response(JSON.stringify({ authDebug: err }), {
            status: response.status,
            headers: { "content-type": "application/json" },
          });
        }
      }
      return response;
    });
  }
  return out;
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
