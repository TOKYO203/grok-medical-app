import { createHash, timingSafeEqual } from "node:crypto";
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
