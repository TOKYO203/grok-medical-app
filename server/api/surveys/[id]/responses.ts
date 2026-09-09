import { defineEventHandler, getMethod, getRouterParam, readBody, setResponseStatus } from 'h3';
import { getSql } from '@/lib/db';
import { hashString, getClientIp, recentResponseExists } from '../../../lib/survey-utils';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const surveyId = getRouterParam(event, 'id');
  const sql = await getSql();

  if (!surveyId) {
    setResponseStatus(event, 400);
    return { error: 'missing survey id' };
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405);
    return { error: 'Method Not Allowed' };
  }

  const body = (await readBody(event)) as any;
  if (!body || !Array.isArray(body.answers)) {
    setResponseStatus(event, 400);
    return { error: 'answers array required' };
  }

  // fetch survey to know anonymization
  const surveys = await sql.query('select * from surveys where id = $1 limit 1', [surveyId]);
  const survey = surveys[0] ?? null;
  if (!survey) {
    setResponseStatus(event, 404);
    return { error: 'survey not found' };
  }

  const ip = await getClientIp(event);
  const salt = process.env.RESPONSE_SALT || 'default_salt';
  const ipHash = ip ? hashString(`${ip}:${salt}`) : null;

  // anti-dup: check recent response by same ipHash
  if (ipHash) {
    const dup = await recentResponseExists(sql, surveyId, ipHash, Number(process.env.RECENT_WINDOW_MINUTES || 60));
    if (dup) {
      setResponseStatus(event, 429);
      return { error: 'duplicate_response' };
    }
  }

  const answersJson = JSON.stringify(body.answers);
  const metadata: any = { userAgent: body.meta?.userAgent ?? null };
  if (ipHash) metadata.ipHash = ipHash;

  const respondentId = survey.anonymized ? null : body.respondentId || null;

  const res = await sql.query(
    `insert into survey_responses (survey_id, respondent_id, submitted_at, answers, metadata) values ($1,$2,now(),$3,$4) returning id, submitted_at`,
    [surveyId, respondentId, answersJson, JSON.stringify(metadata)],
  );

  const created = res[0] ?? null;
  return { ok: true, id: created?.id ?? null, submittedAt: created?.submitted_at ?? null };
});
