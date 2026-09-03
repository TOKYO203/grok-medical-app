import { defineEventHandler, getQuery } from 'h3';
import { getSql } from '@/lib/db';

function sum(arr: number[]) { return arr.reduce((a,b) => a+b, 0); }

export default defineEventHandler(async (event) => {
  const params = (event.context as any)?.params || {};
  const surveyId = params.id;
  const q = getQuery(event) as Record<string,string>;

  if (!surveyId) {
    event.node.res.statusCode = 400;
    return { error: 'missing survey id' };
  }

  const sql = await getSql();
  const surveys = await sql.query('select * from surveys where id = $1 limit 1', [surveyId]);
  const survey = surveys[0] ?? null;
  if (!survey) {
    event.node.res.statusCode = 404;
    return { error: 'survey not found' };
  }

  // load questions
  const questions = await sql.query('select * from survey_questions where survey_id = $1 order by position', [surveyId]);
  const qmap: Record<string, any> = {};
  for (const qq of questions) qmap[qq.id] = qq;

  // load responses
  const rows = await sql.query('select id, submitted_at, answers, metadata from survey_responses where survey_id = $1', [surveyId]);

  // parse and aggregate
  const aggregates: Record<string, any> = {};
  for (const qq of questions) {
    const qid = qq.id;
    const qtype = qq.type;
    aggregates[qid] = { question: qq.prompt, type: qtype, totalResponses: 0 } as any;
    if (qtype === 'mcq' || qtype === 'checkbox') aggregates[qid].counts = {};
    if (qtype === 'likert' || qtype === 'numeric') aggregates[qid].values = [] as number[];
    if (qtype === 'text') aggregates[qid].texts = [] as string[];
  }

  for (const r of rows) {
    let answers: any[] = [];
    try { answers = JSON.parse(r.answers as string); } catch (e) { continue; }
    for (const a of answers) {
      const qid = a.questionId || a.question_id || a.id;
      if (!qid || !aggregates[qid]) continue;
      aggregates[qid].totalResponses += 1;
      const val = a.value;
      const qt = qmap[qid]?.type;
      if (qt === 'mcq') {
        aggregates[qid].counts[val] = (aggregates[qid].counts[val] || 0) + 1;
      } else if (qt === 'checkbox') {
        // assume array
        if (Array.isArray(val)) {
          for (const opt of val) aggregates[qid].counts[opt] = (aggregates[qid].counts[opt] || 0) + 1;
        }
      } else if (qt === 'likert' || qt === 'numeric') {
        const n = Number(val);
        if (!Number.isNaN(n)) aggregates[qid].values.push(n);
      } else if (qt === 'text') {
        if (typeof val === 'string' && val.trim()) aggregates[qid].texts.push(val);
      }
    }
  }

  // finalize stats
  for (const qid of Object.keys(aggregates)) {
    const entry = aggregates[qid];
    if (entry.values) {
      const vals = entry.values as number[];
      entry.count = vals.length;
      entry.sum = sum(vals);
      entry.mean = vals.length ? entry.sum / vals.length : null;
      // simple variance
      entry.stddev = vals.length ? Math.sqrt(sum(vals.map((v:any)=> (v - entry.mean)*(v - entry.mean))) / vals.length) : null;
    }
    if (entry.counts) {
      const total = entry.totalResponses || 0;
      entry.breakdown = Object.fromEntries(Object.entries(entry.counts).map(([k,v]) => [k, { count: v, percent: total ? (v/total*100) : 0 }]));
    }
  }

  return { survey: { id: survey.id, title: survey.title, anonymized: survey.anonymized }, questions, aggregates };
});
