import {
  defineEventHandler,
  getMethod,
  getRouterParam,
  readBody,
  setResponseStatus,
} from "h3";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { applyRateLimitHeaders, consumeRateLimit } from "../../lib/rate-limit";
import { apiAuthFailure, requireContentEditor } from "../../lib/route-auth";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    summary: z.string().trim().max(2_000).nullable().optional(),
    body: z.unknown().nullable().optional(),
    authors: z.unknown().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    specialties: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict();

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const slug = getRouterParam(event, "slug") ?? null;
  const sql = await getSql();

  if (!slug) {
    setResponseStatus(event, 400);
    return { error: "missing slug" };
  }

  if (method === "GET") {
    const rows = await sql.query(
      `select * from publications
       where slug = $1 and status = 'published' and visibility = 'public'
       limit 1`,
      [slug],
    );
    if (!rows[0]) setResponseStatus(event, 404);
    return rows[0] ?? null;
  }

  if (method === "PATCH") {
    try {
      const editor = await requireContentEditor(event);
      const decision = await consumeRateLimit({
        scope: "publication-update",
        subject: editor.id,
        limit: 60,
        windowSeconds: 60,
      });
      applyRateLimitHeaders(event, decision);
      if (!decision.allowed) {
        setResponseStatus(event, 429);
        return { error: "rate_limited" };
      }

      const parsed = updateSchema.safeParse(await readBody(event));
      if (!parsed.success) {
        setResponseStatus(event, 400);
        return { error: "invalid_publication_update", issues: parsed.error.flatten() };
      }

      const body = parsed.data;
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(body)) {
        if (key === "body" || key === "authors") {
          sets.push(`${key} = $${idx}`);
          values.push(JSON.stringify(value ?? null));
        } else {
          sets.push(`${key} = $${idx}`);
          values.push(value);
        }
        idx += 1;
      }

      if (sets.length === 0) {
        setResponseStatus(event, 400);
        return { error: "no updatable fields provided" };
      }

      if (body.status === "published") {
        sets.push("published_at = coalesce(published_at, now())");
      }

      values.push(slug);
      const rows = await sql.query(
        `update publications
         set ${sets.join(", ")}, updated_at = now()
         where slug = $${idx}
         returning *`,
        values,
      );

      if (!rows[0]) {
        setResponseStatus(event, 404);
        return { error: "publication_not_found" };
      }
      return rows[0];
    } catch (error) {
      const authError = apiAuthFailure(error);
      if (authError) {
        setResponseStatus(event, authError.statusCode);
        return { error: authError.message };
      }
      console.error("[publications] update failed", error);
      setResponseStatus(event, 503);
      return { error: "publication_service_unavailable" };
    }
  }

  setResponseStatus(event, 405);
  return { error: "Method Not Allowed" };
});
