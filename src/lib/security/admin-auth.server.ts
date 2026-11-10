import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clientIpSubject } from "./client-ip.server.ts";
import { rateLimit } from "./rate-limit.server.ts";

/**
 * Shared admin-password guard for the `/admin*` server functions — server-only.
 *
 * Replaces the inline `adminKey === expected` comparisons that guarded licence
 * issuance, licence revocation and content moderation. That pattern had two
 * defects:
 *   1. it short-circuits on the first differing character, so response timing
 *      leaked how much of the secret had been guessed correctly, and
 *   2. callers had no throttling at all, so the (single, shared) admin password
 *      could be guessed at wire speed.
 *
 * Both are fixed here rather than at each call site so a future admin function
 * inherits them by construction.
 */

/** Length-blind constant-time comparison of a candidate against ADMIN_PASSWORD. */
export function adminSecretMatches(candidate: string): boolean {
  const expected = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (expected.length === 0) return false; // unset => fail closed
  // Hash both sides first: the digests are always 32 bytes, so the comparison
  // never returns early on a length mismatch and leaks nothing about the size.
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Consume one attempt from the caller's budget. Throws when exhausted. */
export async function enforceAdminAttempt(
  scope: string,
  limit = 60,
  windowMs = 60_000,
): Promise<void> {
  let headers: Headers | undefined;
  try {
    const mod = await import("@tanstack/react-start/server");
    headers = mod.getRequest?.()?.headers;
  } catch {
    headers = undefined;
  }
  const decision = rateLimit(`${scope}:${clientIpSubject(headers)}`, limit, windowMs);
  if (!decision.ok) {
    throw new Error("Trop de tentatives d'authentification. Réessayez plus tard.");
  }
}

/**
 * Throttle, then verify. Throws `Forbidden: admin key invalid` on a bad
 * password — the client keys off /forbidden/i to route back to sign-in.
 */
export async function requireAdminKey(
  adminKey: string,
  scope: string,
  limit = 60,
  windowMs = 60_000,
): Promise<void> {
  await enforceAdminAttempt(scope, limit, windowMs);
  if (!adminSecretMatches(adminKey)) {
    throw new Error("Forbidden: admin key invalid");
  }
}

// ─── Session admin côté serveur (pentest 2026-11-09 §5, issue #453) ────────
//
// Avant, la session admin ne vivait QUE dans le localStorage du navigateur :
// le serveur ne pouvait pas distinguer un admin d'un visiteur anonyme, et
// /admin* répondait 200 en anonyme (cartographie de l'interface offerte à
// l'attaquant). Désormais, /api/admin-verify pose un cookie HttpOnly portant
// un jeton HMAC-SHA256 horodaté (TTL 7 j), et le garde serveur
// (server/middleware/admin-guard.ts) refuse /admin* en 403 sans cookie valide.
// Le mot de passe ne quitte jamais le serveur : il sert seulement de clé HMAC.

export const ADMIN_SESSION_COOKIE = "optimus_admin";

/** TTL de la session admin, aligné sur `TTL_MS` de `admin-login.tsx` (7 j). */
export const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Clé HMAC dérivée du secret serveur ; `null` si ADMIN_PASSWORD est absent. */
function adminSessionKey(): Uint8Array | null {
  const secret = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (secret.length === 0) return null; // unset => pas de session serveur
  return new Uint8Array(
    createHash("sha256").update(`admin-session-key:${secret}`, "utf8").digest(),
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Jeton de session admin : `<epochSecondes>.<HMAC-SHA256 base64url>`.
 * `null` quand ADMIN_PASSWORD n'est pas configuré : aucun cookie ne doit être
 * posé dans ce cas (le garde serveur reste alors inactif, cf. middleware).
 */
export function signAdminSessionToken(nowMs: number = Date.now()): string | null {
  const key = adminSessionKey();
  if (!key) return null;
  const issuedAt = Math.floor(nowMs / 1000);
  const mac = createHmac("sha256", key)
    .update(`admin-session:${issuedAt}`)
    .digest();
  return `${issuedAt}.${toBase64Url(new Uint8Array(mac))}`;
}

/** Vérifie un jeton de session admin (signature + fraîcheur). */
export function verifyAdminSessionToken(
  token: string | null | undefined,
  nowMs: number = Date.now(),
  ttlSeconds: number = ADMIN_SESSION_TTL_SECONDS,
): boolean {
  const key = adminSessionKey();
  if (!key || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const issuedAt = Number(token.slice(0, dot));
  if (!Number.isInteger(issuedAt)) return false;
  const now = Math.floor(nowMs / 1000);
  if (issuedAt > now || now - issuedAt > ttlSeconds) return false;
  const expected = createHmac("sha256", key)
    .update(`admin-session:${issuedAt}`)
    .digest();
  const provided = fromBase64Url(token.slice(dot + 1));
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(new Uint8Array(provided), new Uint8Array(expected));
}

/** Attribut Set-Cookie de session (HttpOnly, Secure, SameSite=Lax, 7 j). */
export function adminSessionCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; SameSite=Lax; HttpOnly; Secure`;
}

/** Attribut Set-Cookie d'effacement de la session admin. */
export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`;
}
