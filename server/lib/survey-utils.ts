import crypto from "node:crypto";

export function hashString(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
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
