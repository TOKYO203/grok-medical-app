import { defineEventHandler, getQuery, readBody } from 'h3';
import { getSql } from '@/lib/db';

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export default defineEventHandler(async (event) => {
  const method = (event.node.req.method || 'GET').toUpperCase();
  const sql = await getSql();

  if (method === 'GET') {
    const q = getQuery(event) as Record<string, string>;
    const tag = q.tag;
    const limit = Math.min(Number(q.limit ?? 20), 100);
    if (tag) {
      const rows = await sql.query("select * from publications where $1 = any(tags) order by published_at desc limit $2", [tag, limit]);
      return rows;
    }

    const rows = await sql.query("select * from publications order by published_at desc limit $1", [limit]);
    return rows;
  }

  if (method === 'POST') {
    const body = (await readBody(event)) as any;
    const title = String(body.title || 'Untitled');
    const summary = body.summary || null;
    const bodyJson = body.body || null;
    const authors = body.authors || null;
    const tags = Array.isArray(body.tags) ? body.tags : [];
    const specialties = Array.isArray(body.specialties) ? body.specialties : [];
    const visibility = body.visibility || 'public';
    const status = body.status || 'draft';
    const created_by = body.created_by || null;

    const slugBase = slugify(title).slice(0, 160);
    // ensure unique slug by appending short suffix if needed
    let slug = slugBase || `pub-${Date.now()}`;
    let suffix = 0;
    while (true) {
      const existing = await sql.query('select id from publications where slug = $1', [slug]);
      if (existing.length === 0) break;
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const res = await sql.query(
      `insert into publications (slug, title, summary, body, authors, attachments, tags, specialties, visibility, status, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now()) returning *`,
      [slug, title, summary, JSON.stringify(bodyJson), JSON.stringify(authors), JSON.stringify(body.attachments || null), tags, specialties, visibility, status, created_by],
    );

    return res[0] ?? null;
  }

  // other methods not implemented yet
  event.node.res.statusCode = 405;
  return { error: 'Method Not Allowed' };
});
