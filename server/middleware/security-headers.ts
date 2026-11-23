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

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || process.env.CF_PAGES === "1";
}

/**
 * INCIDENT 2026-11-20/21, RÉSOLU (audit 2026-11-22) : l'allowlist figée de
 * #467 F1 ignorait les scripts d'hydratation inline émis par TanStack Start
 * (page blanche en prod), d'où un 'unsafe-inline' temporaire. La faille XSS
 * correspondante est fermée : pour chaque document HTML rendu en production,
 * hardenResponse calcule les hashes SHA-256 des blocs <script> inline
 * RÉELLEMENT présents dans le HTML servi (thème + hydratation + tout inline
 * futur) et pose script-src 'self' <hashes> — plus aucun 'unsafe-inline' en
 * production. En cas d'échec de lecture du HTML, le repli reste limité à LA
 * réponse en cause (disponibilité d'abord), avec log.
 *
 *   - Baseline hors HTML (JSON, redirections) : strict, seul le script de
 *     thème épinglé par son hash est permis ;
 *   - Développement : Vite injecte ses propres scripts inline, mode
 *     permissif conservé hors production.
 */
function scriptSrc(): string {
  if (!isProduction()) {
    return `script-src 'self' 'unsafe-inline' ${THEME_BOOT_HASH}`;
  }
  return `script-src 'self' ${THEME_BOOT_HASH}`;
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
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  scriptSrc(),
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

const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-permitted-cross-domain-policies": "none",
};

// Blocs <script> inline (sans attribut src). Le texte intérieur est capturé
// EXACTEMENT : le hash CSP se calcule sur les octets tels qu'ils seront servis.
const INLINE_SCRIPT_TAG = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** Hashes SHA-256 des scripts inline d'un document HTML rendu. */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(INLINE_SCRIPT_TAG)) {
    const code = match[1] ?? "";
    if (!code.trim()) continue;
    hashes.add(`sha256-${createHash("sha256").update(code, "utf8").digest("base64")}`);
  }
  return [...hashes];
}

function strictScriptDirective(hashes: string[]): string {
  const unique = [...new Set([THEME_BOOT_HASH, ...hashes])];
  return `script-src 'self' ${unique.join(" ")}`.trim();
}

async function hardenResponse(response: Response, event: SecurityHeaderEvent): Promise<Response> {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  // HSTS is meaningful only on HTTPS. Do not emit it for localhost/dev HTTP,
  // because browsers ignore it there and it would make local behavior confusing.
  if (event.url.protocol === "https:" && !headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  // Production + document HTML : allowlist par hash des scripts inline réels
  // (thème, hydratation TanStack Start, tout inline futur).
  if (isProduction() && response.body !== null) {
    const contentType = headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      try {
        const html = await response.text();
        headers.set(
          "content-security-policy",
          buildCsp(strictScriptDirective(inlineScriptHashes(html))),
        );
        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        // Repli de disponibilité : UNIQUEMENT pour cette réponse (leçon de
        // l'incident 2026-11-20/21). L'erreur reste visible dans les logs.
        console.error(
          "[security-headers] lecture du HTML impossible (repli 'unsafe-inline' pour cette réponse)",
          error,
        );
        headers.set(
          "content-security-policy",
          buildCsp(`script-src 'self' 'unsafe-inline' ${THEME_BOOT_HASH}`),
        );
      }
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
