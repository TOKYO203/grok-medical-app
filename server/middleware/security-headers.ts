successfully downloaded text file (SHA: a48bbb4d678efc67baf016f1e734edc69f439f2b)
interface SecurityHeaderEvent {
  url: URL;
}

const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-permitted-cross-domain-policies": "none",
};

/** Origines https uniquement — une origine non https est ignorée, pas levée. */
function httpsOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * CSP construite depuis la configuration d'environnement, pour rester
 * correcte quel que soit le déploiement (Supabase, Upstash, OAuth).
 *
 * ÉCHAPPATOIRES VOLONTAIRES :
 *  • script-src/style-src tolèrent 'unsafe-inline' : TanStack Start injecte
 *    des scripts/styles d'amorçage inline au SSR, et une CSP trop stricte
 *    casserait l'hydratation et le login OAuth. Resserrer plus tard avec des
 *    nonces, une fois les points d'inventaire couverts.
 *  • img-src accepte https: : les couvertures de profil et les assets
 *    éditoriaux peuvent provenir de Supabase Storage.
 *  • DISABLE_CSP=true est un kill switch de déploiement (incident), jamais
 *    une configuration de production.
 */
function contentSecurityPolicy(): string | null {
  if (process.env.DISABLE_CSP === "true") return null;

  const connectOrigins = [
    httpsOrigin(process.env.VITE_SUPABASE_URL),
    httpsOrigin(process.env.SUPABASE_URL),
    httpsOrigin(process.env.UPSTASH_REDIS_REST_URL),
    httpsOrigin(process.env.GROK_AUTH_ISSUER),
  ].filter((origin): origin is string => origin !== null);

  const extraConnect = (process.env.CSP_EXTRA_CONNECT_SRC ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${[...new Set([...connectOrigins, ...extraConnect])].join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/**
 * Politique de framing : 'none' par défaut (anti-clickjacking, y compris sur
 * /admin et le parcours de paiement). Un déploiement qui DOIT rester
 * embarqué (chrome de plateforme, iframe de preview) liste ses origines
 * autorisées dans FRAMING_ALLOWED_ORIGINS (séparées par des virgules) ;
 * X-Frame-Options n'est alors pas posé, car il ne sait pas exprimer une
 * liste et s'appliquerait à tous les navigateurs qui préfèrent l'ancien
 * en-tête à frame-ancestors.
 */
function frameAncestors(): { directive: string; allowLegacyXfo: boolean } {
  const allowed = (process.env.FRAMING_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.length === 0) return { directive: "frame-ancestors 'none'", allowLegacyXfo: true };
  return { directive: `frame-ancestors ${allowed.join(" ")}`, allowLegacyXfo: false };
}

function hardenResponse(response: Response, event: SecurityHeaderEvent): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  // HSTS is meaningful only on HTTPS. Do not emit it for localhost/dev HTTP,
  // because browsers ignore it there and it would make local behavior confusing.
  if (event.url.protocol === "https:" && !headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  const csp = contentSecurityPolicy();
  if (csp) {
    const reportOnly = process.env.CSP_REPORT_ONLY === "true";
    const name = reportOnly ? "content-security-policy-report-only" : "content-security-policy";
    if (!headers.has(name)) headers.set(name, csp);
  }

  const framing = frameAncestors();
  const existingCsp = headers.get("content-security-policy") ?? "";
  if (framing.allowLegacyXfo && !headers.has("x-frame-options")) {
    headers.set("x-frame-options", "DENY");
  }
  if (!existingCsp.includes("frame-ancestors")) {
    if (headers.has("content-security-policy")) {
      headers.set("content-security-policy", `${existingCsp}; ${framing.directive}`);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Baseline response hardening for all Nitro responses.
 *
 * SÉCURITÉ (audit 2026-11, failles F2) : ajoute une CSP par défaut et
 * l'anti-clickjacking (frame-ancestors 'none' + X-Frame-Options DENY),
 * surchargeables par déploiement via CSP_REPORT_ONLY, DISABLE_CSP et
 * FRAMING_ALLOWED_ORIGINS. Le CSP en mode report-only permet de mesurer les
 * violations avant de durcir script-src (suppression de 'unsafe-inline').
 */
export default async function securityHeadersMiddleware(
  event: SecurityHeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  return result instanceof Response ? hardenResponse(result, event) : result;
}
