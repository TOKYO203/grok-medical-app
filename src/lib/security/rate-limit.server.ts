import { clientIpSubject } from "./client-ip.server.ts";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

// Fallback en mémoire
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

// ⚠️ Lazy : pas d'I/O au module load (Cloudflare Workers interdit)
function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function rateLimitUpstash(key: string, max: number, windowMs: number): Promise<RateLimitResult | null> {
  const cfg = getUpstashConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs, "NX"],
        ["PTTL", key],
      ]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result: number }>;
    const count = Number(data[0]?.result ?? 0);
    const pttl = Number(data[2]?.result ?? windowMs);
    const resetAt = Date.now() + Math.max(0, pttl);
    return { ok: count <= max, remaining: Math.max(0, max - count), resetAt };
  } catch (err) {
    console.warn("[rate-limit] Upstash error:", err);
    return null;
  }
}

export async function rateLimitRequest(
  request: Request,
  scope: string,
  max = MAX_REQ,
  windowMs = WINDOW_MS,
): Promise<RateLimitResult> {
  const subject = clientIpSubject(request.headers);
  const key = `optimus:ratelimit:${scope}:${subject}`;
  const upstash = await rateLimitUpstash(key, max, windowMs);
  if (upstash) return upstash;
  return rateLimitMemory(key, max, windowMs);
}

// Sync fallback pour admin-auth.server.ts
export function rateLimit(key: string, max = MAX_REQ, windowMs = WINDOW_MS): RateLimitResult {
  return rateLimitMemory(key, max, windowMs);
}

export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
