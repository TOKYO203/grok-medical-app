import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  optimusSyncPushSchema,
  optimusSyncSnapshotSchema,
  type OptimusSyncSnapshot,
} from "@/lib/optimus-sync-model";

const MAX_SYNC_BYTES = 512 * 1024;

type StateRow = {
  optimus_id: string;
  state: unknown;
  revision: number | string;
  updated_at: string | Date;
};

type SyncControlRow = {
  suspended_at: string | Date;
  reason: string;
};

type PurchaseExportRow = {
  reference: string;
  optimus_id: string;
  offer: string;
  specialty: string;
  deck_number: number;
  product: string;
  label: string;
  amount: number;
  status: string;
  proof_attached: boolean;
  device_id: string | null;
  device_key_id: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  proof_digest: string | null;
  payment_submitted_at: string | Date | null;
  payment_verified_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  delivered_at: string | Date | null;
  rejected_at: string | Date | null;
  refunded_at: string | Date | null;
};

type PurchaseEventExportRow = {
  reference: string;
  event_type: string;
  metadata: unknown;
  created_at: string | Date;
};

type ContentReportExportRow = {
  id: string;
  content_type: string;
  content_id: string;
  deck_id: string | null;
  deck_version: string | null;
  label: string;
  issue_type: string;
  details: string;
  location: string;
  status: string;
  created_at: string | Date;
  resolved_at: string | Date | null;
};

type SurveyResponseExportRow = {
  id: string;
  survey_id: string;
  submitted_at: string | Date;
  answers: unknown;
  metadata: unknown;
};

function parseSnapshot(value: unknown): OptimusSyncSnapshot {
  const candidate = typeof value === "string" ? JSON.parse(value) : value;
  return optimusSyncSnapshotSchema.parse(candidate);
}

function responseFromRow(row: StateRow) {
  return {
    snapshot: parseSnapshot(row.state),
    revision: Number(row.revision),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function isoDate(value: string | Date | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function getSyncControl(userId: string): Promise<SyncControlRow | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<SyncControlRow>(
    `select suspended_at, reason
       from optimus_sync_controls
      where user_id = $1
      limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export const pullOptimusState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const control = await getSyncControl(context.userId);
    if (control) {
      return {
        snapshot: null,
        revision: 0,
        updatedAt: null,
        syncSuspended: true,
        suspendedAt: new Date(control.suspended_at).toISOString(),
      };
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<StateRow>(
      `select optimus_id, state, revision, updated_at
         from optimus_user_state
        where user_id = $1
        limit 1`,
      [context.userId],
    );
    const row = rows[0];
    if (!row) {
      return {
        snapshot: null,
        revision: 0,
        updatedAt: null,
        syncSuspended: false,
        suspendedAt: null,
      };
    }
    return {
      ...responseFromRow(row),
      syncSuspended: false,
      suspendedAt: null,
    };
  });

export const pushOptimusState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(optimusSyncPushSchema)
  .handler(async ({ data, context }) => {
    const control = await getSyncControl(context.userId);
    if (control) {
      return {
        ok: false as const,
        conflict: false as const,
        suspended: true as const,
        snapshot: null,
        revision: 0,
        updatedAt: null,
      };
    }

    const serialized = JSON.stringify(data.snapshot);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SYNC_BYTES) {
      throw new Error("La progression à synchroniser dépasse la limite autorisée.");
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql.query<StateRow>(
      `select optimus_id, state, revision, updated_at
         from optimus_user_state
        where user_id = $1
        limit 1`,
      [context.userId],
    );

    if (!existing[0]) {
      const inserted = await sql.query<StateRow>(
        `insert into optimus_user_state (
           user_id, optimus_id, state, revision, created_at, updated_at
         ) values ($1, $2, $3::jsonb, 1, now(), now())
         on conflict (user_id) do nothing
         returning optimus_id, state, revision, updated_at`,
        [context.userId, data.snapshot.profile.optimusId, serialized],
      );
      if (inserted[0]) {
        return {
          ok: true as const,
          conflict: false as const,
          suspended: false as const,
          ...responseFromRow(inserted[0]),
        };
      }
    }

    const baseRevision = data.baseRevision ?? 0;
    const updated = await sql.query<StateRow>(
      `update optimus_user_state
          set optimus_id = $2,
              state = $3::jsonb,
              revision = revision + 1,
              updated_at = now()
        where user_id = $1
          and revision = $4
        returning optimus_id, state, revision, updated_at`,
      [context.userId, data.snapshot.profile.optimusId, serialized, baseRevision],
    );
    if (updated[0]) {
      return {
        ok: true as const,
        conflict: false as const,
        suspended: false as const,
        ...responseFromRow(updated[0]),
      };
    }

    const latest = await sql.query<StateRow>(
      `select optimus_id, state, revision, updated_at
         from optimus_user_state
        where user_id = $1
        limit 1`,
      [context.userId],
    );
    if (!latest[0]) throw new Error("État Optimus introuvable après conflit de synchronisation.");
    return {
      ok: false as const,
      conflict: true as const,
      suspended: false as const,
      ...responseFromRow(latest[0]),
    };
  });

/**
 * Export data associated with the authenticated Optimus identity.
 * Device private keys and raw payment-proof files are intentionally absent because
 * they are never stored in the cloud. Commercial rows are exported read-only and
 * remain governed by their separate retention/audit policy.
 */
export const exportOptimusAccountData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const [learningRows, controls, orderRows, eventRows, reportRows, responseRows] =
      await Promise.all([
        sql.query<StateRow>(
          `select optimus_id, state, revision, updated_at
             from optimus_user_state
            where user_id = $1
            limit 1`,
          [context.userId],
        ),
        sql.query<SyncControlRow>(
          `select suspended_at, reason
             from optimus_sync_controls
            where user_id = $1
            limit 1`,
          [context.userId],
        ),
        sql.query<PurchaseExportRow>(
          `select reference, optimus_id, offer, specialty, deck_number, product, label,
                  amount, status, proof_attached, device_id, device_key_id,
                  payment_provider, payment_reference, proof_digest,
                  payment_submitted_at, payment_verified_at,
                  created_at, updated_at, delivered_at, rejected_at, refunded_at
             from purchase_orders
            where user_id = $1
            order by created_at asc`,
          [context.userId],
        ),
        sql.query<PurchaseEventExportRow>(
          `select e.reference, e.event_type, e.metadata, e.created_at
             from purchase_order_events e
             join purchase_orders o on o.reference = e.reference
            where o.user_id = $1
            order by e.created_at asc, e.id asc`,
          [context.userId],
        ),
        sql.query<ContentReportExportRow>(
          `select id, content_type, content_id, deck_id, deck_version, label,
                  issue_type, details, location, status, created_at, resolved_at
             from content_reports
            where user_id = $1
            order by created_at asc`,
          [context.userId],
        ),
        sql.query<SurveyResponseExportRow>(
          `select id, survey_id, submitted_at, answers, metadata
             from survey_responses
            where respondent_id = $1
            order by submitted_at asc`,
          [context.userId],
        ),
      ]);

    const learning = learningRows[0] ? responseFromRow(learningRows[0]) : null;
    const control = controls[0];
    const orders = orderRows.map((row) => ({
      reference: row.reference,
      optimusId: row.optimus_id,
      offer: row.offer,
      specialty: row.specialty,
      deckNumber: row.deck_number,
      product: row.product,
      label: row.label,
      amount: row.amount,
      status: row.status,
      proofAttached: row.proof_attached,
      deviceId: row.device_id,
      deviceKeyId: row.device_key_id,
      paymentProvider: row.payment_provider,
      paymentReference: row.payment_reference,
      proofDigest: row.proof_digest,
      paymentSubmittedAt: isoDate(row.payment_submitted_at),
      paymentVerifiedAt: isoDate(row.payment_verified_at),
      createdAt: isoDate(row.created_at) as string,
      updatedAt: isoDate(row.updated_at) as string,
      deliveredAt: isoDate(row.delivered_at),
      rejectedAt: isoDate(row.rejected_at),
      refundedAt: isoDate(row.refunded_at),
    }));
    const events = eventRows.map((row) => ({
      reference: row.reference,
      eventType: row.event_type,
      metadataJson: jsonText(row.metadata),
      createdAt: isoDate(row.created_at) as string,
    }));
    const contentReports = reportRows.map((row) => ({
      id: row.id,
      contentType: row.content_type,
      contentId: row.content_id,
      deckId: row.deck_id,
      deckVersion: row.deck_version,
      label: row.label,
      issueType: row.issue_type,
      details: row.details,
      location: row.location,
      status: row.status,
      createdAt: isoDate(row.created_at) as string,
      resolvedAt: isoDate(row.resolved_at),
    }));
    const surveyResponses = responseRows.map((row) => ({
      id: row.id,
      surveyId: row.survey_id,
      submittedAt: isoDate(row.submitted_at) as string,
      answersJson: jsonText(row.answers),
      metadataJson: jsonText(row.metadata),
    }));

    return {
      format: "optimus-user-export-v1" as const,
      exportedAt: new Date().toISOString(),
      subject: { userId: context.userId },
      learning,
      cloudSync: control
        ? {
            suspended: true,
            suspendedAt: new Date(control.suspended_at).toISOString(),
            reason: control.reason,
          }
        : { suspended: false, suspendedAt: null, reason: null },
      commerce: { orders, events },
      feedback: { contentReports },
      surveys: { responses: surveyResponses },
      exclusions: [
        "Les clés privées d'appareil ne quittent jamais l'appareil.",
        "Les fichiers bruts de preuve de paiement ne sont pas stockés dans le registre cloud.",
      ],
    };
  });

/**
 * Erases the cloud learning snapshot and writes a durable tombstone in one SQL
 * statement. The tombstone blocks all devices from recreating the snapshot until
 * the user explicitly resumes cloud sync.
 */
export const deleteOptimusCloudState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ confirmation: z.literal("DELETE_OPTIMUS_DATA") }))
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `with deleted as (
         delete from optimus_user_state
          where user_id = $1
          returning user_id
       )
       insert into optimus_sync_controls (user_id, suspended_at, reason)
       values ($1, now(), 'user_erasure')
       on conflict (user_id)
       do update set suspended_at = excluded.suspended_at, reason = excluded.reason`,
      [context.userId],
    );
    return {
      ok: true as const,
      syncSuspended: true as const,
      retainedCategories: ["commerce_audit", "device_local_secrets"] as const,
    };
  });

export const resumeOptimusCloudSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ confirmation: z.literal("RESUME_OPTIMUS_SYNC") }))
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from optimus_sync_controls where user_id = $1", [context.userId]);
    return { ok: true as const, syncSuspended: false as const };
  });
