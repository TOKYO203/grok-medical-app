import type { LicenseReceipt, LicenseReceiptPayload } from "../core/types.ts";
import { licenseReceiptMessage } from "./signature-payload.ts";

const PRODUCT_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const OPTIMUS_ID_PATTERN = /^OM-[A-F0-9]{8}$/;
const DEVICE_ID_PATTERN = /^[a-f0-9]{12}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isPayload(value: unknown): value is LicenseReceiptPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<LicenseReceiptPayload>;
  const issuedAt = typeof payload.issuedAt === "string" ? Date.parse(payload.issuedAt) : Number.NaN;
  const expiresAt =
    payload.expiresAt === null
      ? null
      : typeof payload.expiresAt === "string"
        ? Date.parse(payload.expiresAt)
        : Number.NaN;
  return (
    payload.version === 1 &&
    (payload.licenseId === undefined ||
      (typeof payload.licenseId === "string" && UUID_PATTERN.test(payload.licenseId))) &&
    typeof payload.product === "string" &&
    PRODUCT_PATTERN.test(payload.product) &&
    typeof payload.optimusId === "string" &&
    OPTIMUS_ID_PATTERN.test(payload.optimusId) &&
    typeof payload.deviceId === "string" &&
    DEVICE_ID_PATTERN.test(payload.deviceId) &&
    Number.isFinite(issuedAt) &&
    (expiresAt === null || Number.isFinite(expiresAt))
  );
}

export function isLicenseReceipt(value: unknown): value is LicenseReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<LicenseReceipt>;
  return (
    isPayload(receipt.payload) &&
    Boolean(receipt.signature) &&
    receipt.signature?.algorithm === "Ed25519" &&
    receipt.signature.keyId === "optimus-license-v1" &&
    typeof receipt.signature.value === "string" &&
    receipt.signature.value.length >= 64
  );
}

export async function verifyLicenseReceipt(
  receiptValue: unknown,
  publicKey: string | undefined,
  expectedOptimusId: string,
  expectedDeviceId: string,
  now = Date.now(),
): Promise<boolean> {
  if (!publicKey || !isLicenseReceipt(receiptValue)) return false;
  const { payload, signature } = receiptValue;
  if (
    payload.optimusId !== expectedOptimusId.toUpperCase() ||
    payload.deviceId.toLowerCase() !== expectedDeviceId.toLowerCase()
  ) {
    return false;
  }
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = payload.expiresAt === null ? null : Date.parse(payload.expiresAt);
  if (
    issuedAt > now + CLOCK_SKEW_MS ||
    (expiresAt !== null && (expiresAt <= issuedAt || expiresAt <= now))
  ) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      fromBase64Url(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromBase64Url(signature.value),
      new TextEncoder().encode(licenseReceiptMessage(payload)),
    );
  } catch {
    return false;
  }
}
