import { createHash } from "node:crypto";
import { defineEventHandler, getMethod, readBody, setHeader, setResponseStatus } from "h3";
import { getSql } from "@/lib/db";

type ActivationBody = {
  key?: unknown;
  optimusId?: unknown;
  deviceId?: unknown;
};

type ActivatedLicense = {
  product: string;
  expires_at: string | null;
};

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function keyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");

  if (getMethod(event).toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method Not Allowed" };
  }

  const body = (await readBody(event)) as ActivationBody;
  const key = normalizeKey(body.key);
  const optimusId = String(body.optimusId ?? "").trim().toUpperCase();
  const deviceId = String(body.deviceId ?? "").trim();

  if (!/^OPT-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/.test(key) || !/^OM-[A-F0-9]{8}$/.test(optimusId) || deviceId.length < 8) {
    setResponseStatus(event, 400);
    return { error: "Clé ou identifiant invalide." };
  }

  const sql = await getSql();
  const rows = await sql.query<ActivatedLicense>(
    `update activation_keys
       set device_id = coalesce(device_id, $2),
           activated_at = coalesce(activated_at, now())
     where key_hash = $1
       and optimus_id = $3
       and revoked_at is null
       and (expires_at is null or expires_at > now())
       and (device_id is null or device_id = $2)
     returning product, expires_at`,
    [keyHash(key), deviceId, optimusId],
  );

  const license = rows[0];
  if (!license) {
    setResponseStatus(event, 401);
    return { error: "Cette clé est invalide, expirée ou déjà liée à un autre appareil." };
  }

  return {
    ok: true,
    product: license.product,
    expiresAt: license.expires_at,
  };
});
