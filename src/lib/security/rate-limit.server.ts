import { clientIpSubject } from "./client-ip.server.ts";
import { Redis } from "@upstash/redis/cloudflare";
import { Ratelimit } from "@upstash/ratelimit";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

// Fallback en mémoire (dev local / si Upstash absent)
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQ = 20;
const MAX_BUCKETS = 10_000;

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

function rateLimitMemory(key: string, max = MAX_REQ, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    evict(now, 1);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (b.count >= max) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: max - b.count, resetAt: b.resetAt };
}

// ⚠️ LAZY INIT : Cloudflare Workers interdit l'init asynchrone en global scope.
let limiterCache: Ratelimit | null = null;

function getUpstashLimiter(): Ratelimit | null {
  if (limiterCache) return limiterCache;

  // Cloudflare expose les variables d'env via process.env au moment de l'exécution du handler
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const redis = new Redis({ url, token });
    limiterCache = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      analytics: true,
      prefix: "@upstash/ratelimit/optimus",
    });
  }
  return limiterCache;
}

export async function rateLimitRequest(
  request: Request,
  scope: string,
  max = MAX_REQ,
  windowMs = WINDOW_MS,
): Promise<RateLimitResult> {
  const subject = clientIpSubject(request.headers);
  const key = `${scope}:${subject}`;
  const upstashLimiter = getUpstashLimiter();

  if (upstashLimiter) {
    try {
      const { success, remaining, reset } = await upstashLimiter.limit(key);
      return { ok: success, remaining, resetAt: reset };
    } catch (error) {
      console.warn("[rate-limit] Upstash indisponible, fallback mémoire:", error);
    }
  }

  return rateLimitMemory(key, max, windowMs);
}

export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
