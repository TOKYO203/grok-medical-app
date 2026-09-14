import {
  defineEventHandler,
  getRouterParam,
  setHeader,
  setResponseStatus,
} from "h3";
import { getSql } from "@/lib/db";
import { apiAuthFailure, requireContentEditor } from "../../../lib/route-auth";

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");

  const surveyId = getRouterParam(event, "id");
  if (!surveyId) {
    setResponseStatus(event, 400);
    return { error: "missing survey id" };
  }

  try {
    await requireContentEditor(event);
  } catch (error) {
    const authError = apiAuthFailure(error);
    if (authError) {
      setResponseStatus(event, authError.statusCode);
      return { error: authError.message };
    }
    throw error;
  }

  const sql = await getSql();
  const surveys = await sql.query<Record<string, any>>(
    "select * from surveys where id = $1 limit 1",
    [surveyId],
  );
  const survey = surveys[0] ?? null;
  if (!survey) {
    setResponseStatus(event, 404);
    return { error: "survey_not_found" };
  }

  const questions = await sql.query<Record<string, any>>(
    "select * from survey_questions where survey_id = $1 order by position",
    [surveyId],
  );
  const questionMap: Record<string, any> = {};
  for (const question of questions) questionMap[question.id] = question;

  // Deliberately exclude respondent_id and metadata from the result-processing query.
  const rows = await sql.query<Record<string, any>>(
    "select answers from survey_responses where survey_id = $1",
    [surveyId],
  );

  const aggregates: Record<string, any> = {};
  for (const question of questions) {
    const id = question.id;
    aggregates[id] = {
      question: question.prompt,
      type: question.type,
      totalResponses: 0,
    };
    if (question.type === "mcq" || question.type === "checkbox") aggregates[id].counts = {};
    if (question.type === "likert" || question.type === "numeric") aggregates[id].values = [];
    if (question.type === "text") aggregates[id].texts = [];
  }

  for (const row of rows) {
    let answers: any[] = [];
    try {
      answers = typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers;
    } catch {
      continue;
    }
    if (!Array.isArray(answers)) continue;

    for (const answer of answers) {
      const questionId = answer?.questionId || answer?.question_id || answer?.id;
      const aggregate = questionId ? aggregates[questionId] : null;
      if (!aggregate) continue;

      aggregate.totalResponses += 1;
      const value = answer.value;
      const type = questionMap[questionId]?.type;
      if (type === "mcq" && typeof value === "string") {
        aggregate.counts[value] = (aggregate.counts[value] || 0) + 1;
      } else if (type === "checkbox" && Array.isArray(value)) {
        for (const option of value) {
          if (typeof option !== "string") continue;
          aggregate.counts[option] = (aggregate.counts[option] || 0) + 1;
        }
      } else if (type === "likert" || type === "numeric") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) aggregate.values.push(numeric);
      } else if (type === "text" && typeof value === "string" && value.trim()) {
        aggregate.texts.push(value.trim().slice(0, 4_000));
      }
    }
  }

  for (const entry of Object.values(aggregates)) {
    if (entry.values) {
      const values = entry.values as number[];
      entry.count = values.length;
      entry.sum = sum(values);
      entry.mean = values.length ? entry.sum / values.length : null;
      entry.stddev = values.length
        ? Math.sqrt(sum(values.map((value) => (value - entry.mean) ** 2)) / values.length)
        : null;
    }
    if (entry.counts) {
      const total = entry.totalResponses || 0;
      entry.breakdown = Object.fromEntries(
        Object.entries(entry.counts as Record<string, number>).map(([key, count]) => [
          key,
          { count, percent: total ? (count / total) * 100 : 0 },
        ]),
      );
    }
  }

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      anonymized: survey.anonymized,
    },
    responseCount: rows.length,
    questions,
    aggregates,
  };
});
