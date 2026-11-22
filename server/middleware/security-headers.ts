import { createHash } from "node:crypto";
import { THEME_BOOT_SCRIPT } from "../../src/lib/theme";

interface SecurityHeaderEvent {
  url: URL;
}

/**
 * Audit Vibe 2026-11-19 (issue #467, F1) : la CSP n'autorise plus les scripts
 * inline arbitraires ni les scripts hébergés sur grok.com. Le SEUL script
 * inline de l'application est le boot de thème (THEME_BOOT_SCRIPT, injecté dans
 * src/routes/__root.tsx) : il est permis par son hash SHA-256, calculé ici à
 * partir de la constante source — impossible à désynchroniser.
 *
 *   - script-src 'self' <hash> : un XSS n'a aucun vecteur d'exécution inline.
 *   - L'hôte https://grok.com est RETIRÉ de script-src : l'app est un ONGLET
 *     (éventuellement embarqué dans du chrome de preview), jamais un consommateur
 *     de scripts d'un domaine tiers. Si un besoin réel réapparaît, l'épingler au
 *     chemin exact et le justifier ici.
 *   - En développement (Vite injecte ses propres scripts inline), le mode
 *     permissif 'unsafe-inline' est conservé hors production.
 */
const THEME_BOOT_HASH = `sha256-${createHash("sha256").update(THEME_BOOT_SCRIPT, "utf8").digest("base64")}`;

/**
 * INCIDENT 2026-11-20/21 — page blanche en production (pages.dev + workers.dev).
 * Le durcissement #467 F1 posait script-src 'self' <hash de THEME_BOOT_SCRIPT>,
 * or TanStack Start émet AUSSI des scripts inline (données d'hydratation du
 * router). Bloqués, l'application ne s'hydrate jamais et reste figée sur le
 * rendu serveur (splash « Connexion à Optimus… », écran perçu comme vide).
 * Rétablissement temporaire de 'unsafe-inline' (état antérieur au 19/11, ayant
 * toujours fonctionné). TODO : recalculer l'allowlist par hash sur le HTML
 * construit réel (thème + scripts de données TanStack), puis retirer de nouveau
 * 'unsafe-inline'. Le THEME_BOOT_HASH est conservé dans la politique — ignoré
 * par les navigateurs tant que 'unsafe-inline' est présent, mais il documente
 * la cible du futur resserrement et reste vérifié par les tests.
 */
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
    hashes.add(`sha256-${'${'}createHash('sha256').update(match[1], 'utf8').digest('base64')}`);
  }
  return [...hashes];
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || process.env.CF_PAGES === '1';
}

function scriptSrc(responseHashes: string[]): string {
  const sources = ["'self'", THEME_BOOT_HASH, ...responseHashes];
  if (!isProduction()) sources.push("'unsafe-inline'");
  return `script-src ${'${'}sources.join(' ')}`;
}

/**
 * Baseline CSP posée sur toutes les réponses. Miroir EXACT du bloc `/*` de
 * `public/_headers` (actifs statiques du CDN) : les deux doivent rester
 * alignées — un écart créerait deux politiques selon le type de réponse.
 *
 * INCIDENT 2026-11-20/21 : script-src porte de nouveau 'unsafe-inline' (voir scriptSrc). Pentest 2026-11-09 §3 : sans CSP ni X-Frame-Options, l'app est encadrable
 * (clickjacking sur les écrans de paiement/activation) et un XSS sur le jeton
 * de contenu (§4) n'a aucun frein. Audit #467 F1 : `script-src` passe en
 * allowlist par hash — plus de 'unsafe-inline' ni de domaine tiers en prod.
 *   - `style-src 'unsafe-inline'` : les styles injectés par le runtime restent
 *     fonctionnels (PWA, graphiques) — resserrable après inventaire.
 *   - `connect-src` : Supabase (REST + Realtime wss) et l'API LemonSqueezy.
 *   - `img-src` : images.unsplash.com (photo de fond de l'écran de connexion).
 */
function contentSecurityPolicy(scriptSources: string): string {
  return [
  "default-src 'self'",
  scriptSources,
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

async function hardenResponse(response: Response, event: SecurityHeaderEvent): Promise<Response> {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  headers.delete("content-security-policy");

  // CSP par hash sur le HTML construit (production) : les scripts inline
  // réellement servis sont autorisés, rien d'autre (résolution du TODO de
  // l'incident 2026-11-20/21 : TanStack Start émet des scripts d'hydratation
  // inline inconnus d'une politique figée). Hors production, Vite (HMR)
  // garde son mode permissif.
  const isHtml = (headers.get("content-type") ?? "").includes("text/html");
  if (isHtml) {
    const html = await response.text();
    headers.set(
      "content-security-policy",
      contentSecurityPolicy(scriptSrc(inlineScriptHashes(html))),
    );
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Réponse non-HTML (JSON, actifs statiques…) : aucun script inline légitime,
  // politique stricte sans exception.
  headers.set("content-security-policy", contentSecurityPolicy("script-src 'self'"));

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
 * CSP (script-src par hash, audit #467 F1), anti-clickjacking (X-Frame-Options
 * DENY + frame-ancestors 'none'), nosniff, Referrer/Permissions-Policy, HSTS on
 * HTTPS. Framing was previously left open for platform chrome; the pentest
 * (docs/PENTEST-2026-11-09.md §3) closed it — Optimus est une PWA autonome, pas
 * un widget embarqué.
 */
export default async function securityHeadersMiddleware(
  event: SecurityHeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  return result instanceof Response ? await hardenResponse(result, event) : result;
}
