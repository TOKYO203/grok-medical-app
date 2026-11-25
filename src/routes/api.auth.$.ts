import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth/server";

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
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => getAuth().handler(request),
      POST: async ({ request }) => getAuth().handler(request),
      PUT: async ({ request }) => getAuth().handler(request),
      DELETE: async ({ request }) => getAuth().handler(request),
    },
  },
});
