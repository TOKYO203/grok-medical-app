import { getSql } from '@/lib/db';
import { defineEventHandler } from 'h3';
import crypto from 'crypto';

export function hashString(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function getClientIp(event: any): Promise<string | null> {
  const hdr = event.node?.req?.headers || {};
  const xf = hdr['x-forwarded-for'] || hdr['x-forwarded-host'];
  if (xf) {
    const parts = (Array.isArray(xf) ? xf[0] : xf).split(',');
    return parts[0].trim();
  }
  const socket = event.node?.req?.socket;
  if (socket && socket.remoteAddress) return socket.remoteAddress;
  return null;
}

export async function recentResponseExists(sql: any, surveyId: string, ipHash: string, windowMinutes = 60) {
  const rows = await sql.query('select count(*) as cnt from survey_responses where survey_id = $1 and (metadata->>\'ipHash\') = $2 and submitted_at > now() - ($3::interval)', [surveyId, ipHash, `${windowMinutes} minutes`]);
  const n = Number((rows[0] && (rows[0] as any).cnt) || 0);
  return n > 0;
}

export default defineEventHandler(async (event) => {
  return { ok: true };
});
