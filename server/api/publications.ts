import { defineEventHandler, getMethod, getQuery, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { apiAuthFailure, requireContentEditor } from "../lib/route-auth";

const publicationSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().max(2_000).nullable().optional(),
  body: z.unknown().nullable().optional(),
  authors: z.unknown().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  specialties: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeLimit(value: unknown): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const sql = await getSql();

  if (method === "GET") {
    const q = getQuery(event) as Record<string, string>;
    const tag = q.tag?.trim();
    const limit = safeLimit(q.limit);

    if (tag) {
      return sql.query(
        `select * from publications
         where status = 'published'
           and visibility = 'public'
           and $1 = any(tags)
         order by published_at desc nulls last, created_at desc
         limit $2`,
        [tag, limit],
      );
    }

    return sql.query(
      `select * from publications
       where status = 'published' and visibility = 'public'
       order by published_at desc nulls last, created_at desc
       limit $1`,
      [limit],
    );
  }

  if (method === "POST") {
    try {
      const editor = await requireContentEditor(event);
      const parsed = publicationSchema.safeParse(await readBody(event));
      if (!parsed.success) {
        setResponseStatus(event, 400);
        return { error: "invalid_publication", issues: parsed.error.flatten() };
      }

      const data = parsed.data;
      const slugBase = slugify(data.title).slice(0, 160) || `publication-${Date.now()}`;
      let slug = slugBase;
      let suffix = 0;
      while (true) {
        const existing = await sql.query("select id from publications where slug = $1", [slug]);
        if (existing.length === 0) break;
        suffix += 1;
        slug = `${slugBase}-${suffix}`;
      }

      const publishedAt = data.status === "published" ? new Date().toISOString() : null;
      const rows = await sql.query(
        `insert into publications (
           slug, title, summary, body, authors, attachments, tags, specialties,
           visibility, status, created_by, published_at, created_at, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
         returning *`,
        [
          slug,
          data.title,
          data.summary ?? null,
          JSON.stringify(data.body ?? null),
          JSON.stringify(data.authors ?? null),
          JSON.stringify(data.attachments ?? null),
          data.tags,
          data.specialties,
          data.visibility,
          data.status,
          editor.id,
          publishedAt,
        ],
      );
      setResponseStatus(event, 201);
      return rows[0] ?? null;
    } catch (error) {
      const authError = apiAuthFailure(error);
      if (authError) {
        setResponseStatus(event, authError.statusCode);
        return { error: authError.message };
      }
      throw error;
    }
  }

  setResponseStatus(event, 405);
  return { error: "Method Not Allowed" };
});
