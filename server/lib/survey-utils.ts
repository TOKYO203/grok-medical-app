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
  // Math.trunc(NaN) === NaN et NaN se propage dans Math.min/max : une variable
  // d'environnement malformée (RECENT_WINDOW_MINUTES="abc") faisait échouer la
  // requête SQL (interval 'NaN minutes') en 500 sur CHAQUE soumission de
  // sondage. Repli sur 60 minutes si la valeur n'est pas un nombre fini
  // (audit sécurité 2026-11-12).
  const parsedWindow = Math.trunc(Number(windowMinutes));
  const safeWindow = Number.isFinite(parsedWindow)
    ? Math.max(1, Math.min(parsedWindow, 24 * 60))
    : 60;
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
