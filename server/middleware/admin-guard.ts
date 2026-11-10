import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "../../src/lib/security/admin-auth.server";

interface AdminGuardEvent {
  url: URL;
  // Nitro selon le preset : `req` (Request H3 v2) ou `node.req` (Node legacy).
  req?: { headers?: Headers };
  node?: { req?: { headers?: Record<string, string | string[] | undefined> } };
}

/**
 * Garde serveur du back-office (pentest 2026-11-09 §5, issue #453).
 *
 * Avant : /admin, /admin-licences, /admin-achats… répondaient 200 en anonyme —
 * le HTML de l'interface était offert à quiconque (cartographie, surface de
 * phishing ciblé). Désormais : toute page /admin* exige le cookie de session
 * admin posé par /api/admin-verify (HttpOnly, jeton HMAC horodaté) — sinon 403.
 *
 *   - /admin-login reste public : c'est la porte d'entrée ;
 *   - /api/** est exclu : chaque endpoint gère sa propre autorisation ;
 *   - le garde n'est actif que si ADMIN_PASSWORD est configuré. Sans secret
 *     serveur, aucune session vérifiable n'existe (aucun cookie n'est jamais
 *     posé) : en production il l'est, donc le garde y est fail closed.
 */
function cookieHeaderFromEvent(event: AdminGuardEvent): string | null {
  const requestHeaders = event.req?.headers;
  if (requestHeaders && typeof requestHeaders.get === "function") {
    return requestHeaders.get("cookie");
  }
  const legacy = event.node?.req?.headers;
  if (legacy) {
    const value = legacy.cookie;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join("; ");
  }
  return null;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    return raw || null;
  }
  return null;
}

const FORBIDDEN_PAGE = [
  "<!doctype html>",
  '<html lang="fr"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>403 — Accès refusé</title>",
  '<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b0f14;color:#e6edf3}main{text-align:center;padding:2rem}h1{font-size:1.4rem}p{color:#8b98a5;font-size:.9rem}</style>',
  "</head><body><main><h1>403 — Accès refusé</h1>",
  "<p>Le back-office est réservé aux administrateurs authentifiés.</p>",
  "</main></body></html>",
].join("");

export default async function adminGuardMiddleware(
  event: AdminGuardEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const pathname = event.url?.pathname ?? "/";
  if (
    !pathname.startsWith("/admin") ||
    pathname.startsWith("/admin-login") ||
    pathname.startsWith("/api/")
  ) {
    return next();
  }
  const secret = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (secret.length === 0) return next();

  const token = readCookie(cookieHeaderFromEvent(event), ADMIN_SESSION_COOKIE);
  if (verifyAdminSessionToken(token)) return next();

  return new Response(FORBIDDEN_PAGE, {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}
