import { createHash } from "node:crypto";
import { defineEventHandler, getMethod, readBody, setHeader, setResponseStatus } from "h3";
import { getSql } from "@/lib/db";
import { signLicenseReceipt } from "@/content/license-receipt.server";

type ActivationBody = {
  key?: unknown;
  optimusId?: unknown;
  deviceId?: unknown;
};

type ActivatedLicense = {
  product: string;
  expires_at: string | Date | null;
  activated_at: string | Date;
};

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function keyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function isoTimestamp(value: string | Date): string {
  return new Date(value).toISOString();
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

  if (
    !/^OPT-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/.test(key) ||
    !/^OM-[A-F0-9]{8}$/.test(optimusId) ||
    !/^[a-f0-9]{12}$/i.test(deviceId)
  ) {
    setResponseStatus(event, 400);
    return { error: "Clé ou identifiant invalide." };
  }

  const privateKey = process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim();
  if (!privateKey) {
    setResponseStatus(event, 503);
    return { error: "Le service d'activation sécurisée est temporairement indisponible." };
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
     returning product, expires_at, activated_at`,
    [keyHash(key), deviceId, optimusId],
  );

  const license = rows[0];
  if (!license) {
    setResponseStatus(event, 401);
    return { error: "Cette clé est invalide, expirée ou déjà liée à un autre appareil." };
  }

  try {
    const receipt = signLicenseReceipt(
      {
        version: 1,
        product: license.product,
        optimusId,
        deviceId: deviceId.toLowerCase(),
        issuedAt: isoTimestamp(license.activated_at),
        expiresAt: license.expires_at === null ? null : isoTimestamp(license.expires_at),
      },
      privateKey,
    );
    return { ok: true, product: license.product, expiresAt: receipt.payload.expiresAt, receipt };
  } catch (error) {
    console.error("[licenses] receipt signing failed", error);
    setResponseStatus(event, 503);
    return { error: "Le service d'activation sécurisée est temporairement indisponible." };
  }
});
