import { isIP } from "node:net";

/**
 * Trusted client IP resolution for Web `Request`/`Headers` — **server-only**.
 *
 * Mirrors the doctrine of `server/lib/client-ip.ts` (which serves the H3/Nitro
 * routes) for the TanStack Start server-function / route-handler world, so both
 * halves of the app agree on when a forwarding header may be believed.
 *
 * Why this exists: `x-forwarded-for` is a plain request header. Anyone can set
 * it. Using it as a rate-limit subject lets an attacker rotate one header value
 * per request and buy an unlimited budget — which is exactly how the public
 * `/api/ai-stream` proxy could be driven against the owner's paid provider keys.
 *
 * Only two classes of source are trusted:
 *   - platform-owned single-client-IP headers (Vercel, Netlify), recognised only
 *     when that platform's own deployment marker is present, and
 *   - a generic `x-forwarded-for` chain, opt-in via `TRUST_PROXY_HEADERS=true`
 *     for operators who control a proxy that strips client-supplied values.
 *
 * Anything else returns `null`. Callers must then fall back to a **shared,
 * non-spoofable bucket**: that fails closed (all anonymous callers share one
 * budget) instead of failing open (each forged header buys a fresh budget).
 */

/** A header is only usable when it holds exactly one well-formed IP. */
function singleIpHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim();
  if (!value || value.includes(",") || isIP(value) === 0) return null;
  return value;
}

export function clientIpFromHeaders(headers: Headers | null | undefined): string | null {
  if (!headers) return null;

  if (process.env.VERCEL === "1") {
    return singleIpHeader(headers, "x-vercel-forwarded-for");
  }

  if (process.env.NETLIFY === "true") {
    return singleIpHeader(headers, "x-nf-client-connection-ip");
  }

  // Cloudflare Pages (la cible de production du module Premium) publie
  // `cf-connecting-ip`, MAIS `CF_PAGES` est une variable de build absente du
  // runtime du Worker : on reconnaît donc la plateforme à `cf-ray`, que
  // Cloudflare ajoute (et surtout RÉÉCRIT) sur chaque requête proxifiée, en
  // même temps que `cf-connecting-ip`.
  //
  // Sans cette branche, tout le trafic de production retombait sur le seau
  // partagé `"shared"` : la limite « 10 vérifications de licence par heure »
  // aurait été une limite GLOBALE, et le 11e étudiant de la journée se serait
  // vu refuser sa licence. ⚠️ Un opérateur qui déploie derrière un proxy qui
  // n'est PAS Cloudflare doit retirer les en-têtes `cf-*` avant de relayer
  // (documenté dans docs/SECURITY-PREMIUM.md), sinon ils seraient forgeables.
  if (headers.get("cf-ray")) {
    return singleIpHeader(headers, "cf-connecting-ip");
  }

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return first && isIP(first) !== 0 ? first : null;
  }

  return null;
}

/**
 * Rate-limit subject for a request. A trusted IP is used when available;
 * otherwise every untrusted caller collapses onto the `shared` bucket, which
 * cannot be widened by forging headers.
 */
export function clientIpSubject(headers: Headers | null | undefined): string {
  return clientIpFromHeaders(headers) ?? "shared";
}
