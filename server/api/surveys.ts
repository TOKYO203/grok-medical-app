import {
  defineEventHandler,
  getMethod,
  getQuery,
  readBody,
  setResponseStatus,
} from "h3";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { applyRateLimitHeaders, consumeRateLimit } from "../lib/rate-limit";
import { apiAuthFailure, requireContentEditor } from "../lib/route-auth";

const questionSchema = z.object({
  type: z.enum(["mcq", "checkbox", "likert", "numeric", "text"]),
  prompt: z.string().trim().min(1).max(2_000),
  options: z.array(z.string().max(500)).max(50).nullable().optional(),
  required: z.boolean().default(true),
});

const surveySchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(4_000).nullable().optional(),
    target: z.string().trim().max(500).nullable().optional(),
    anonymized: z.boolean().default(true),
    consent_text: z.string().trim().max(5_000).nullable().optional(),
    open_at: z.string().datetime({ offset: true }).nullable().optional(),
    close_at: z.string().datetime({ offset: true }).nullable().optional(),
    published: z.boolean().default(false),
    questions: z.array(questionSchema).max(100).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.open_at && data.close_at && Date.parse(data.close_at) <= Date.parse(data.open_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["close_at"],
        message: "close_at must be after open_at",
      });
    }
  });

function safeLimit(value: unknown): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();

  if (method === "GET") {
    const sql = await getSql();
    const q = getQuery(event) as Record<string, string>;
    const limit = safeLimit(q.limit);
    return sql.query(
      `select id, title, description, target, anonymized, consent_text, open_at, close_at
         from surveys
        where published = true
          and (open_at is null or open_at <= now())
          and (close_at is null or close_at > now())
        order by created_at desc
        limit $1`,
      [limit],
    );
  }

  if (method === "POST") {
    try {
      const editor = await requireContentEditor(event);
      const decision = await consumeRateLimit({
        scope: "survey-create",
        subject: editor.id,
        limit: 20,
        windowSeconds: 60,
      });
      applyRateLimitHeaders(event, decision);
      if (!decision.allowed) {
        setResponseStatus(event, 429);
        return { error: "rate_limited" };
      }

      const parsed = surveySchema.safeParse(await readBody(event));
      if (!parsed.success) {
        setResponseStatus(event, 400);
        return { error: "invalid_survey", issues: parsed.error.flatten() };
      }

      const sql = await getSql();
      const data = parsed.data;
      const rows = await sql.query<Record<string, unknown>>(
        `insert into surveys (
           title, description, created_by, target, anonymized, consent_text,
           open_at, close_at, published, created_at, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
         returning *`,
        [
          data.title,
          data.description ?? null,
          editor.id,
          data.target ?? null,
          data.anonymized,
          data.consent_text ?? null,
          data.open_at ?? null,
          data.close_at ?? null,
          data.published,
        ],
      );

      const survey = rows[0];
      if (!survey || typeof survey.id !== "string") {
        throw new Error("Survey insert did not return an id");
      }

      for (let index = 0; index < data.questions.length; index += 1) {
        const question = data.questions[index];
        await sql.query(
          `insert into survey_questions (
             survey_id, position, type, prompt, options, required
           ) values ($1,$2,$3,$4,$5,$6)`,
          [
            survey.id,
            index + 1,
            question.type,
            question.prompt,
            question.options ? JSON.stringify(question.options) : null,
            question.required,
          ],
        );
      }

      setResponseStatus(event, 201);
      return survey;
    } catch (error) {
      const authError = apiAuthFailure(error);
      if (authError) {
        setResponseStatus(event, authError.statusCode);
        return { error: authError.message };
      }
      console.error("[surveys] create failed", error);
      setResponseStatus(event, 503);
      return { error: "survey_service_unavailable" };
    }
  }

  setResponseStatus(event, 405);
  return { error: "Method Not Allowed" };
});
