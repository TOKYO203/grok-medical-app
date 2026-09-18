import { createPrivateKey, createPublicKey } from "node:crypto";
import { defineEventHandler, getMethod, readBody, setHeader, setResponseStatus } from "h3";
import { isLicenseReceipt, verifyLicenseReceipt } from "@/content/license-receipt";
import { getSql } from "@/lib/db";
import { getClientIp } from "../../lib/client-ip";
import { applyRateLimitHeaders, consumeRateLimit } from "../../lib/rate-limit";

type LicenseRow = {
  revoked_at: string | Date | null;
  expires_at: string | Date | null;
};

function signingPublicKey(): string | undefined {
  const configured = process.env.VITE_LICENSE_SIGNING_PUBLIC_KEY?.trim();
  if (configured) return configured;
  const privateKeyBase64 = process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim();
  if (!privateKeyBase64) return undefined;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyBase64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const jwk = createPublicKey(privateKey).export({ format: "jwk" });
    return typeof jwk.x === "string" ? jwk.x : undefined;
  } catch {
    return undefined;
  }
}

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  if (getMethod(event).toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method Not Allowed" };
  }

  const body = (await readBody(event)) as { receipt?: unknown };
  if (!isLicenseReceipt(body.receipt)) {
    setResponseStatus(event, 400);
    return { error: "Preuve de licence invalide." };
  }
  const receipt = body.receipt;

  const subject =
    getClientIp(event) ||
    receipt.payload.licenseId ||
    `${receipt.payload.optimusId}:${receipt.payload.deviceId}:${receipt.payload.product}`;
  try {
    const decision = await consumeRateLimit({
      scope: "license-status",
      subject,
      limit: 60,
      windowSeconds: 60,
    });
    applyRateLimitHeaders(event, decision);
    if (!decision.allowed) {
      setResponseStatus(event, 429);
      return { error: "Trop de vérifications. Réessayez plus tard." };
    }
  } catch (error) {
    console.error("[licenses] status rate limiter unavailable", error);
    setResponseStatus(event, 503);
    return { error: "Vérification de licence temporairement indisponible." };
  }

  const publicKey = signingPublicKey();
  if (
    !publicKey ||
    !(await verifyLicenseReceipt(
      receipt,
      publicKey,
      receipt.payload.optimusId,
      receipt.payload.deviceId,
    ))
  ) {
    setResponseStatus(event, 401);
    return { error: "Preuve de licence non authentique ou expirée." };
  }

  const sql = await getSql();
  const params = receipt.payload.licenseId
    ? [
        receipt.payload.licenseId,
        receipt.payload.optimusId,
        receipt.payload.product,
        receipt.payload.deviceId,
        receipt.payload.issuedAt,
      ]
    : [
        receipt.payload.optimusId,
        receipt.payload.product,
        receipt.payload.deviceId,
        receipt.payload.issuedAt,
      ];
  const rows = receipt.payload.licenseId
    ? await sql.query<LicenseRow>(
        `select revoked_at, expires_at
           from activation_keys
          where id = $1
            and optimus_id = $2
            and product = $3
            and device_id = $4
            and activated_at = $5::timestamptz
          limit 1`,
        params,
      )
    : await sql.query<LicenseRow>(
        `select revoked_at, expires_at
           from activation_keys
          where optimus_id = $1
            and product = $2
            and device_id = $3
            and activated_at = $4::timestamptz
          order by created_at desc
          limit 1`,
        params,
      );

  const row = rows[0];
  const now = Date.now();
  const expired = row?.expires_at ? new Date(row.expires_at).getTime() <= now : false;
  const revoked = Boolean(row?.revoked_at);
  return {
    active: Boolean(row) && !revoked && !expired,
    revoked,
    expired,
    checkedAt: new Date(now).toISOString(),
  };
});
