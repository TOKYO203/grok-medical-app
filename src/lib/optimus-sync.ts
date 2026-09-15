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

export const pullOptimusState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
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
    if (!row) return { snapshot: null, revision: 0, updatedAt: null };
    return responseFromRow(row);
  });

export const pushOptimusState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(optimusSyncPushSchema)
  .handler(async ({ data, context }) => {
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
        return { ok: true as const, conflict: false as const, ...responseFromRow(inserted[0]) };
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
      return { ok: true as const, conflict: false as const, ...responseFromRow(updated[0]) };
    }

    const latest = await sql.query<StateRow>(
      `select optimus_id, state, revision, updated_at
         from optimus_user_state
        where user_id = $1
        limit 1`,
      [context.userId],
    );
    if (!latest[0]) throw new Error("État Optimus introuvable après conflit de synchronisation.");
    return { ok: false as const, conflict: true as const, ...responseFromRow(latest[0]) };
  });

export const deleteOptimusCloudState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ confirmation: z.literal("DELETE_OPTIMUS_DATA") }))
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from optimus_user_state where user_id = $1", [context.userId]);
    return { ok: true };
  });
