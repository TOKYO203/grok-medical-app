import { defineEventHandler, readBody, getQuery } from "h3";
import { getSql } from "@/lib/db";

export default defineEventHandler(async (event) => {
  const method = (event.node.req.method || "GET").toUpperCase();
  const sql = await getSql();

  if (method === "GET") {
    const q = getQuery(event) as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 20), 100);
    const rows = await sql.query("select id, title, description, created_by, published, created_at from surveys order by created_at desc limit $1", [limit]);
    return rows;
  }

  if (method === "POST") {
    const body = (await readBody(event)) as any;
    const title = String(body.title || "Untitled survey");
    const description = body.description || null;
    const created_by = body.created_by || null;
    const target = body.target || null;
    const anonymized = body.anonymized == null ? true : Boolean(body.anonymized);
    const consent_text = body.consent_text || null;
    const open_at = body.open_at || null;
    const close_at = body.close_at || null;
    const published = body.published ? true : false;

    const res = await sql.query(
      `insert into surveys (title, description, created_by, target, anonymized, consent_text, open_at, close_at, published, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now()) returning *`,
      [title, description, created_by, target, anonymized, consent_text, open_at, close_at, published],
    );

    const survey = res[0] ?? null;

    // If questions provided inline, insert them
    if (survey && Array.isArray(body.questions)) {
      let position = 0;
      for (const q of body.questions) {
        position += 1;
        await sql.query(
          `insert into survey_questions (survey_id, position, type, prompt, options, required) values ($1,$2,$3,$4,$5,$6)`,
          [survey.id, position, q.type, q.prompt, q.options ? JSON.stringify(q.options) : null, q.required ? true : false],
        );
      }
    }

    return survey;
  }

  event.node.res.statusCode = 405;
  return { error: "Method Not Allowed" };
});
