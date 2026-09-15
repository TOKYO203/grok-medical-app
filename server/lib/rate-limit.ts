import { createHash } from "node:crypto";
import { setHeader, type H3Event } from "h3";
import { getSql } from "@/lib/db";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

let cleanupTick = 0;

function rateLimitSalt(): string {
  const configured = process.env.RATE_LIMIT_SALT?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SALT must be configured in production");
  }
  return "optimus-dev-rate-limit-salt";
}

export function pseudonymousRateLimitKey(scope: string, subject: string): string {
  return createHash("sha256")
    .update(`${rateLimitSalt()}:${scope}:${subject}`, "utf8")
    .digest("hex");
}

export async function consumeRateLimit(options: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const limit = Math.max(1, Math.trunc(options.limit));
  const windowSeconds = Math.max(1, Math.trunc(options.windowSeconds));
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const bucketKey = pseudonymousRateLimitKey(options.scope, options.subject);

  const sql = await getSql();
  const rows = await sql.query<{ request_count: number }>(
    `insert into api_rate_limits (bucket_key, window_start, request_count, updated_at)
     values ($1, $2, 1, now())
     on conflict (bucket_key, window_start)
     do update set request_count = least(api_rate_limits.request_count + 1, $3),
                   updated_at = now()
     returning request_count`,
    [bucketKey, windowStart, limit + 1],
  );

  // Keep the table bounded without adding a cleanup query to every request.
  cleanupTick += 1;
  if (cleanupTick % 128 === 0) {
    await sql.query("delete from api_rate_limits where updated_at < now() - interval '2 days'");
  }

  const count = Number(rows[0]?.request_count ?? limit + 1);
  const resetAtMs = windowStartMs + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

export function applyRateLimitHeaders(event: H3Event, decision: RateLimitDecision): void {
  setHeader(event, "X-RateLimit-Limit", String(decision.limit));
  setHeader(event, "X-RateLimit-Remaining", String(decision.remaining));
  if (!decision.allowed) {
    setHeader(event, "Retry-After", String(decision.retryAfterSeconds));
  }
}
