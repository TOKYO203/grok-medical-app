import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const REPORT_ISSUES = [
  "wrong_answer",
  "unclear_explanation",
  "outdated_source",
  "unsafe_recommendation",
  "other",
] as const;

export type ReportIssue = (typeof REPORT_ISSUES)[number];

export const REPORT_ISSUE_LABEL: Record<ReportIssue, string> = {
  wrong_answer: "Réponse incorrecte",
  unclear_explanation: "Explication imprécise",
  outdated_source: "Source obsolète",
  unsafe_recommendation: "Recommandation à risque",
  other: "Autre problème",
};

const reportSchema = z.object({
  contentType: z.enum(["question", "deck", "clinical_case"]),
  contentId: z.string().trim().min(1).max(120),
  deckId: z.string().trim().max(120).optional(),
  deckVersion: z.string().trim().max(40).optional(),
  label: z.string().trim().min(1).max(500),
  issue: z.enum(REPORT_ISSUES),
  details: z.string().trim().max(2_000),
  location: z.string().trim().max(500),
});

export type ContentReportInput = z.infer<typeof reportSchema>;

export function formatContentReport(input: ContentReportInput): string {
  const context = [
    `Type : ${input.contentType}`,
    `Contenu : ${input.contentId}`,
    input.deckId ? `Deck : ${input.deckId}` : null,
    input.deckVersion ? `Version : ${input.deckVersion}` : null,
    `Motif : ${REPORT_ISSUE_LABEL[input.issue]}`,
    `Élément : ${input.label}`,
    input.details ? `Détail : ${input.details}` : null,
  ];
  return context.filter(Boolean).join("\n");
}

export const submitContentReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reportSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      insert into content_reports (
        user_id,
        content_type,
        content_id,
        deck_id,
        deck_version,
        label,
        issue_type,
        details,
        location
      ) values (
        ${context.userId},
        ${data.contentType},
        ${data.contentId},
        ${data.deckId ?? null},
        ${data.deckVersion ?? null},
        ${data.label},
        ${data.issue},
        ${data.details},
        ${data.location}
      )
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("Le signalement n'a pas pu être enregistré.");
    return { reference: id.slice(0, 8).toUpperCase() };
  });
