import { randomBytes } from "node:crypto";

interface SecurityHeaderEvent {
  url: URL;
}

/**
 * Politique CSP des réponses dynamiques : allowlist stricte par NONCE.
 *
 * Historique (à ne pas réintroduire) :
 *  - Audit #467 F1 (2026-11-19) : `script-src 'self' <hash du boot de thème>`.
 *    Un hash statique ne peut couvrir que le script de thème ; TanStack Start
 *    émet en plus des scripts inline par réponse (données de streaming
 *    `data-tsr-stream-part`, frontière `$tsr-stream-boundary`). Résultat :
 *    scripts d'hydratation bloqués, application figée sur le rendu serveur
 *    (page blanche perçue), incident 2026-11-20/21.
 *  - Correctif 39260c8 : `'self' 'unsafe-inline' <hash>`. Or, dès qu'un hash est
 *    présent dans `script-src`, les navigateurs IGNORENT `'unsafe-inline'`
 *    (CSP2+, MDN « If a directive contains a hash and unsafe-inline, then the
 *    browser ignores unsafe-inline ») : la politique restait donc hash-only,
 *    l'incident n'était pas corrigé et le commentaire mentait.
 *
 * Décision 2026-11-23 : nonce aléatoire par réponse. Le middleware tamponne le
 * HTML, pose `nonce="…"` sur chaque `<script>` inline, et le même nonce dans
 * l'en-tête. `script-src` ne contient plus ni `'unsafe-inline'` ni hash, ni
 * domaine tiers : un script inline non étiqueté est bloqué, un XSS injecté
 * dans le HTML ne peut pas deviner le nonce. C'est strictement plus strict que
 * `'unsafe-inline'`, et c'est la seule forme qui laisse l'hydratation
 * fonctionner pour des scripts dont le contenu change à chaque requête.
 *
 * `public/_headers` (actifs statiques du CDN) garde `script-src 'self'` : aucun
 * HTML inline n'est servi depuis ce dossier, et un nonce ne peut pas y être
 * figé. L'écart est volontaire et verrouillé par les tests.
 */

/** Nonce CSP : 128 bits d'entropie, base64, neuf à chaque réponse. */
function createNonce(): string {
  return randomBytes(16).toString("base64");
}

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Styles injectés par le runtime (PWA, graphiques) : resserrable après
    // inventaire, comme documenté dans le pentest 2026-11-09 §3.
    "style-src 'self' 'unsafe-inline'",
    // images.unsplash.com : photo de fond de l'écran de connexion (AuthScreen).
    // CDN d'images passif, aucune exécution de code : acceptable en img-src.
    "img-src 'self' data: blob: https://images.unsplash.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lemonsqueezy.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-permitted-cross-domain-policies": "none",
};

const INLINE_SCRIPT_TAG = /<script(?![^>]*\bsrc=)(?![^>]*\bnonce=)/gi;

function tagInlineScripts(html: string, nonce: string): string {
  return html.replace(INLINE_SCRIPT_TAG, `<script nonce="${nonce}"`);
}

/** Une réponse dont le corps peut être réécrit (HTML complet, pas de 304/HEAD). */
function isRewritableHtml(response: Response): boolean {
  if (response.body === null) return false;
  if (response.status === 204 || response.status === 304) return false;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("text/html");
}

async function hardenResponse(response: Response, event: SecurityHeaderEvent): Promise<Response> {
  const nonce = createNonce();
  const headers = new Headers(response.headers);
  let body: BodyInit | null = response.body;

  if (isRewritableHtml(response)) {
    body = tagInlineScripts(await response.text(), nonce);
    // Le corps a été décodé et sa taille a changé : ces en-têtes ne sont plus
    // valides (un `content-encoding` conservé corromprait la réponse).
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
  }

  if (!headers.has("content-security-policy")) {
    headers.set("content-security-policy", contentSecurityPolicy(nonce));
  }
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  // HSTS is meaningful only on HTTPS. Do not emit it for localhost/dev HTTP,
  // because browsers ignore it there and it would make local behavior confusing.
  if (event.url.protocol === "https:" && !headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Baseline response hardening for all Nitro responses.
 *
 * Applies the same security baseline as `public/_headers` (static CDN assets),
 * à l'exception assumée de `script-src` (nonce ici, `'self'` côté CDN) :
 * CSP, anti-clickjacking (X-Frame-Options DENY + frame-ancestors 'none'),
 * nosniff, Referrer/Permissions-Policy, HSTS on HTTPS. Pentest
 * (docs/PENTEST-2026-11-09.md §3) : Optimus est une PWA autonome, pas un
 * widget embarqué.
 */
export default async function securityHeadersMiddleware(
  event: SecurityHeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  return result instanceof Response ? hardenResponse(result, event) : result;
}
