import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { REPORT_ISSUE_LABEL, type ReportIssue } from "@/lib/content-reports";

const ADMIN_ENV = "PURCHASE_ADMIN_USER_IDS";

function isAdmin(userId: string): boolean {
  const allowed = (process.env[ADMIN_ENV] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(userId);
}

export type ContentReportStatus = "new" | "reviewing" | "resolved" | "rejected";

export type AdminContentReport = {
  id: string;
  userId: string;
  contentType: "question" | "deck" | "clinical_case";
  contentId: string;
  deckId: string | null;
  deckVersion: string | null;
  label: string;
  issue: ReportIssue;
  issueLabel: string;
  details: string;
  location: string;
  status: ContentReportStatus;
  createdAt: number;
  resolvedAt: number | null;
};

type ReportRow = {
  id: string;
  user_id: string;
  content_type: "question" | "deck" | "clinical_case";
  content_id: string;
  deck_id: string | null;
  deck_version: string | null;
  label: string;
  issue_type: ReportIssue;
  details: string;
  location: string;
  status: ContentReportStatus;
  created_at: string | Date;
  resolved_at: string | Date | null;
};

function toAdminReport(row: ReportRow): AdminContentReport {
  return {
    id: row.id,
    userId: row.user_id,
    contentType: row.content_type,
    contentId: row.content_id,
    deckId: row.deck_id,
    deckVersion: row.deck_version,
    label: row.label,
    issue: row.issue_type,
    issueLabel: REPORT_ISSUE_LABEL[row.issue_type] ?? row.issue_type,
    details: row.details,
    location: row.location,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
  };
}

const listSchema = z.object({
  status: z.enum(["new", "reviewing", "resolved", "rejected", "all"]).optional(),
});

export const listContentReportsForAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(listSchema)
  .handler(async ({ data, context }) => {
    if (!isAdmin(context.userId)) throw new Error("Forbidden");

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const rows = data.status && data.status !== "all"
      ? await sql<ReportRow>`
          select * from content_reports
          where status = ${data.status}
          order by created_at desc
          limit 200
        `
      : await sql<ReportRow>`
          select * from content_reports
          order by created_at desc
          limit 200
        `;

    return rows.map(toAdminReport);
  });

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "reviewing", "resolved", "rejected"]),
});

export const reviewContentReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reviewSchema)
  .handler(async ({ data, context }) => {
    if (!isAdmin(context.userId)) throw new Error("Forbidden");

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const rows = await sql<ReportRow>`
      update content_reports
         set status = ${data.status},
             resolved_at = case when ${data.status} in ('resolved', 'rejected') then now() else null end
       where id = ${data.id}
       returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Signalement introuvable.");
    return toAdminReport(row);
  });
