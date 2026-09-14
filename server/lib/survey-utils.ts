import crypto from "node:crypto";
import type { H3Event } from "h3";

export function hashString(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getClientIp(event: H3Event): string | null {
  const headers = event.node.req.headers;
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers["x-real-ip"];
  if (realIp) {
    const value = Array.isArray(realIp) ? realIp[0] : realIp;
    if (value?.trim()) return value.trim();
  }

  return event.node.req.socket?.remoteAddress ?? null;
}

export async function recentResponseExists(
  sql: { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]> },
  surveyId: string,
  ipHash: string,
  windowMinutes: number,
) {
  const safeWindow = Math.max(1, Math.min(Math.trunc(windowMinutes), 24 * 60));
  const rows = await sql.query<{ cnt: number | string }>(
    `select count(*) as cnt
       from survey_responses
      where survey_id = $1
        and (metadata->>'ipHash') = $2
        and submitted_at > now() - ($3::interval)`,
    [surveyId, ipHash, `${safeWindow} minutes`],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}
