import { createPrivateKey, sign } from "node:crypto";
import type { LicenseReceipt, LicenseReceiptPayload } from "../core/types.ts";
import { licenseReceiptMessage } from "./signature-payload.ts";

export function signLicenseReceipt(
  payload: LicenseReceiptPayload,
  privateKeyBase64: string,
): LicenseReceipt {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const value = sign(null, Buffer.from(licenseReceiptMessage(payload)), key).toString("base64url");
  return {
    payload,
    signature: { algorithm: "Ed25519", keyId: "optimus-license-v1", value },
  };
}
