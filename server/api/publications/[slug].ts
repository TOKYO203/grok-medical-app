import { defineEventHandler, readBody } from "h3";
import { getSql } from "@/lib/db";

export default defineEventHandler(async (event) => {
  const method = (event.node.req.method || "GET").toUpperCase();
  const params = (event.context && (event.context as any).params) || {};
  const slug = params.slug || null;
  const sql = await getSql();

  if (!slug) {
    event.node.res.statusCode = 400;
    return { error: "missing slug" };
  }

  if (method === "GET") {
    const rows = await sql.query("select * from publications where slug = $1 limit 1", [slug]);
    return rows[0] ?? null;
  }

  if (method === "PATCH") {
    const body = (await readBody(event)) as any;
    const allowed: Record<string, boolean> = {
      title: true,
      summary: true,
      body: true,
      authors: true,
      tags: true,
      specialties: true,
      visibility: true,
      status: true,
    };
    const sets: string[] = [];
    const paramsArr: any[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(body)) {
      if (!allowed[k]) continue;
      if (k === "body" || k === "authors") {
        sets.push(`${k} = $${idx}`);
        paramsArr.push(JSON.stringify(v));
      } else if (k === "tags" || k === "specialties") {
        sets.push(`${k} = $${idx}`);
        paramsArr.push(Array.isArray(v) ? v : []);
      } else {
        sets.push(`${k} = $${idx}`);
        paramsArr.push(v);
      }
      idx += 1;
    }

    if (sets.length === 0) {
      return { error: "no updatable fields provided" };
    }

    // If status -> published, set published_at
    const statusIdx = Object.keys(body).indexOf("status");
    const willPublish = body.status === "published";
    if (willPublish) {
      sets.push(`published_at = now()`);
    }

    const query = `update publications set ${sets.join(", ")} , updated_at = now() where slug = $${idx} returning *`;
    paramsArr.push(slug);
    const res = await sql.query(query, paramsArr);
    return res[0] ?? null;
  }

  event.node.res.statusCode = 405;
  return { error: "Method Not Allowed" };
});
