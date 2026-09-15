import {
  defineEventHandler,
  getHeader,
  getMethod,
  getRouterParam,
  readBody,
  setResponseStatus,
} from "h3";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getClientIp } from "../../../lib/client-ip";
import { applyRateLimitHeaders, consumeRateLimit } from "../../../lib/rate-limit";
import { apiAuthFailure, requireApiUser } from "../../../lib/route-auth";
import { hashString, recentResponseExists } from "../../../lib/survey-utils";

const submissionSchema = z
  .object({
    consent: z.boolean().optional(),
    answers: z
      .array(
        z.object({
          questionId: z.string().uuid(),
          value: z.unknown(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

type SurveyRow = {
  id: string;
  anonymized: boolean;
  consent_text: string | null;
  published: boolean;
  open_at: string | Date | null;
  close_at: string | Date | null;
};

type QuestionRow = {
  id: string;
  required: boolean;
};

function isOpen(survey: SurveyRow, now = Date.now()): boolean {
  if (!survey.published) return false;
  if (survey.open_at && Date.parse(String(survey.open_at)) > now) return false;
  if (survey.close_at && Date.parse(String(survey.close_at)) <= now) return false;
  return true;
}

export default defineEventHandler(async (event) => {
  if (getMethod(event).toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method Not Allowed" };
  }

  const surveyId = getRouterParam(event, "id");
  if (!surveyId) {
    setResponseStatus(event, 400);
    return { error: "missing survey id" };
  }

  const clientIp = getClientIp(event);
  const anonymousSubject = clientIp || `unknown:${(getHeader(event, "user-agent") ?? "no-user-agent").slice(0, 160)}`;
  try {
    const decision = await consumeRateLimit({
      scope: `survey-submit:${surveyId}`,
      subject: anonymousSubject,
      limit: 30,
      windowSeconds: 60,
    });
    applyRateLimitHeaders(event, decision);
    if (!decision.allowed) {
      setResponseStatus(event, 429);
      return { error: "rate_limited" };
    }
  } catch (error) {
    console.error("[surveys] rate limiter unavailable", error);
    setResponseStatus(event, 503);
    return { error: "survey_protection_unavailable" };
  }

  const parsed = submissionSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "invalid_submission", issues: parsed.error.flatten() };
  }

  const answersJson = JSON.stringify(parsed.data.answers);
  if (Buffer.byteLength(answersJson, "utf8") > 64 * 1024) {
    setResponseStatus(event, 413);
    return { error: "answers_too_large" };
  }

  const sql = await getSql();
  const surveys = await sql.query<SurveyRow>("select * from surveys where id = $1 limit 1", [surveyId]);
  const survey = surveys[0];
  if (!survey) {
    setResponseStatus(event, 404);
    return { error: "survey_not_found" };
  }
  if (!isOpen(survey)) {
    setResponseStatus(event, 409);
    return { error: "survey_not_open" };
  }
  if (survey.consent_text && parsed.data.consent !== true) {
    setResponseStatus(event, 400);
    return { error: "consent_required" };
  }

  const questions = await sql.query<QuestionRow>(
    "select id, required from survey_questions where survey_id = $1",
    [surveyId],
  );
  const knownQuestions = new Set(questions.map((question) => question.id));
  const answeredQuestions = new Set(parsed.data.answers.map((answer) => answer.questionId));
  if (parsed.data.answers.some((answer) => !knownQuestions.has(answer.questionId))) {
    setResponseStatus(event, 400);
    return { error: "unknown_question" };
  }
  if (questions.some((question) => question.required && !answeredQuestions.has(question.id))) {
    setResponseStatus(event, 400);
    return { error: "required_answer_missing" };
  }

  let respondentId: string | null = null;
  if (!survey.anonymized) {
    try {
      respondentId = (await requireApiUser(event)).id;
    } catch (error) {
      const authError = apiAuthFailure(error);
      if (authError) {
        setResponseStatus(event, authError.statusCode);
        return { error: authError.message };
      }
      throw error;
    }

    const existing = await sql.query<{ id: string }>(
      "select id from survey_responses where survey_id = $1 and respondent_id = $2 limit 1",
      [surveyId, respondentId],
    );
    if (existing.length > 0) {
      setResponseStatus(event, 409);
      return { error: "duplicate_response" };
    }
  }

  const responseSalt = process.env.RESPONSE_SALT?.trim();
  if (!responseSalt && process.env.NODE_ENV === "production") {
    setResponseStatus(event, 503);
    return { error: "survey_protection_unavailable" };
  }

  const salt = responseSalt || "development-only-response-salt";
  const ipHash = clientIp ? hashString(`${clientIp}:${salt}`) : null;
  if (ipHash) {
    const recentWindow = Number(process.env.RECENT_WINDOW_MINUTES ?? 60);
    if (await recentResponseExists(sql, surveyId, ipHash, recentWindow)) {
      setResponseStatus(event, 429);
      return { error: "duplicate_response" };
    }
  }

  const metadata = {
    userAgent: (getHeader(event, "user-agent") ?? "").slice(0, 300) || null,
    ...(ipHash ? { ipHash } : {}),
  };

  const rows = await sql.query<{ id: string; submitted_at: string | Date }>(
    `insert into survey_responses (
       survey_id, respondent_id, submitted_at, answers, metadata
     ) values ($1,$2,now(),$3,$4)
     returning id, submitted_at`,
    [surveyId, respondentId, answersJson, JSON.stringify(metadata)],
  );

  const created = rows[0];
  setResponseStatus(event, 201);
  return {
    ok: true,
    id: created?.id ?? null,
    submittedAt: created?.submitted_at ?? null,
  };
});
