import { clientIpSubject } from "./client-ip.server.ts";

type Bucket = { count: number; resetAt: number };

/**
 * In-process fixed-window limiter for the TanStack Start route handlers.
 *
 * Two properties matter and are both enforced here:
 *   - the SUBJECT must not be attacker-chosen (`clientIpSubject` believes only
 *     platform-owned headers, or an explicit `TRUST_PROXY_HEADERS=true`), and
 *   - the bucket map must stay BOUNDED, otherwise forging a fresh subject per
 *     request turns the limiter itself into a memory-exhaustion vector.
 *
 * The durable, cross-instance limiter is `server/lib/rate-limit.ts`
 * (`api_rate_limits` in Postgres); this one covers handlers that cannot reach an
 * H3 event.
 */
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQ = 20;
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

/** Drop expired buckets, then evict oldest-first (Map preserves insertion order). */
function evict(now: number, incoming: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size + incoming > MAX_BUCKETS && buckets.size > 0) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function rateLimit(key: string, max = MAX_REQ, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt < now) {
    evict(now, 1);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (b.count >= max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true, remaining: max - b.count, resetAt: b.resetAt };
}

/**
 * Rate-limit a Web `Request` on its trusted client IP. When no IP can be
 * trusted every caller shares one bucket — fail closed, never fail open.
 */
export function rateLimitRequest(
  request: Request,
  scope: string,
  max = MAX_REQ,
  windowMs = WINDOW_MS,
): RateLimitResult {
  return rateLimit(`${scope}:${clientIpSubject(request.headers)}`, max, windowMs);
}

export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
