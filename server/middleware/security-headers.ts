interface SecurityHeaderEvent {
  url: URL;
}

/**
 * Baseline CSP posée sur toutes les réponses. Miroir EXACT du bloc `/*` de
 * `public/_headers` (actifs statiques du CDN) : les deux doivent rester
 * alignées — un écart créerait deux politiques selon le type de réponse.
 *
 * Pentest 2026-11-09 §3 : sans CSP ni X-Frame-Options, l'app est encadrable
 * (clickjacking sur les écrans de paiement/activation) et un XSS sur le jeton
 * de contenu (§4) n'a aucun frein.
 *   - `script-src 'self'` : le shell SPA ne charge que des modules du domaine.
 *   - `style-src 'unsafe-inline'` : les styles injectés par le runtime restent
 *     fonctionnels (PWA, graphiques) — resserrable après inventaire.
 *   - `connect-src` : Supabase (REST + Realtime wss) et l'API LemonSqueezy.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://grok.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lemonsqueezy.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-permitted-cross-domain-policies": "none",
};

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

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Baseline response hardening for all Nitro responses.
 *
 * Applies the same security baseline as `public/_headers` (static CDN assets):
 * CSP, anti-clickjacking (X-Frame-Options DENY + frame-ancestors 'none'),
 * nosniff, Referrer/Permissions-Policy, HSTS on HTTPS. Framing was previously
 * left open for platform chrome; the pentest (docs/PENTEST-2026-11-09.md §3)
 * closed it — Optimus est une PWA autonome, pas un widget embarqué.
 */
export default async function securityHeadersMiddleware(
  event: SecurityHeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  return result instanceof Response ? hardenResponse(result, event) : result;
}
