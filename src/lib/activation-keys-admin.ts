import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";

/**
 * Admin authorization for every licence read and mutation. Delegates to the
 * shared guard so the comparison stays length-blind (no timing oracle) and
 * attempts are throttled on the TRUSTED client IP: the previous
 * `adminKey !== expected` was an unthrottled, character-by-character
 * comparison of the single shared admin password.
 */
async function assertAdmin(adminKey: string): Promise<void> {
  const { requireAdminKey } = await import("@/lib/security/admin-auth.server");
  await requireAdminKey(adminKey, "admin-licences", 60, 60_000);
}

export type AdminLicenseStatus = "pending" | "active" | "expired" | "revoked";

export type AdminLicense = {
  id: string;
  optimusId: string;
  product: string;
  status: AdminLicenseStatus;
  createdAt: number;
  activatedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
  deviceId: string | null;
  keyPrefix: string;
};

type Row = {
  id: string;
  key_hash: string;
  optimus_id: string;
  device_id: string | null;
  product: string;
  expires_at: string | Date | null;
  activated_at: string | Date | null;
  revoked_at: string | Date | null;
  created_at: string | Date;
};

function toMs(v: string | Date | null): number | null {
  if (!v) return null;
  return new Date(v).getTime();
}

function computeStatus(row: Row): AdminLicenseStatus {
  if (row.revoked_at) return "revoked";
  if (!row.activated_at) return "pending";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

function toAdminLicense(row: Row): AdminLicense {
  return {
    id: row.id,
    optimusId: row.optimus_id,
    product: row.product,
    status: computeStatus(row),
    createdAt: toMs(row.created_at) ?? 0,
    activatedAt: toMs(row.activated_at),
    expiresAt: toMs(row.expires_at),
    revokedAt: toMs(row.revoked_at),
    deviceId: row.device_id,
    keyPrefix: row.key_hash.slice(0, 10),
  };
}

export const listActivationKeysForAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      adminKey: z.string().min(1),
      filter: z.enum(["all", "pending", "active", "expired", "revoked"]).default("all"),
      limit: z.number().int().min(1).max(500).default(150),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminKey);
    const sql = await getSql();
    const rows = (await sql.query(
      "SELECT id, key_hash, optimus_id, device_id, product, expires_at, activated_at, revoked_at, created_at FROM activation_keys ORDER BY created_at DESC LIMIT $1",
      [data.limit],
    )) as Row[];
    const all = rows.map(toAdminLicense);
    return data.filter === "all" ? all : all.filter((l) => l.status === data.filter);
  });

export const issueLicense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      adminKey: z.string().min(1),
      optimusId: z.string().regex(/^OM-[A-F0-9]{8}$/),
      days: z.number().int().min(1).max(730),
      product: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/).default("OPTIMUS_PRO"),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminKey);
    const sql = await getSql();
    const raw = (randomBytes(12).toString("hex").toUpperCase().match(/.{1,4}/g) ?? []) as string[];
    const key = "OPT-" + raw.join("-");
    const hash = createHash("sha256").update(key, "utf8").digest("hex");
    const expires = new Date(Date.now() + data.days * 86400000).toISOString();
    await sql.query(
      "INSERT INTO activation_keys (key_hash, optimus_id, product, expires_at) VALUES ($1,$2,$3,$4)",
      [hash, data.optimusId, data.product, expires],
    );
    return { key, optimusId: data.optimusId, days: data.days };
  });

export const revokeLicense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      adminKey: z.string().min(1),
      id: z.string().uuid(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminKey);
    const sql = await getSql();
    await sql.query(
      "UPDATE activation_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
      [data.id],
    );
    return { ok: true };
  });
