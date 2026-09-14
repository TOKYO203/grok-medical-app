import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import type { LicenseReceiptPayload } from "../core/types.ts";
import { signLicenseReceipt } from "./license-receipt.server.ts";
import { verifyLicenseReceipt } from "./license-receipt.ts";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyBase64 = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64");
const publicJwk = publicKey.export({ format: "jwk" });
const publicKeyBase64Url = String(publicJwk.x);
const now = Date.parse("2026-09-10T06:00:00.000Z");

const payload: LicenseReceiptPayload = {
  version: 1,
  product: "NEURO_PRO",
  optimusId: "OM-A1B2C3D4",
  deviceId: "a1b2c3d4e5f6",
  issuedAt: "2026-09-10T05:00:00.000Z",
  expiresAt: "2027-09-10T05:00:00.000Z",
};

test("a genuine receipt unlocks only its bound Optimus ID and device", async () => {
  const receipt = signLicenseReceipt(payload, privateKeyBase64);
  assert.equal(
    await verifyLicenseReceipt(
      receipt,
      publicKeyBase64Url,
      payload.optimusId,
      payload.deviceId,
      now,
    ),
    true,
  );
  assert.equal(
    await verifyLicenseReceipt(
      receipt,
      publicKeyBase64Url,
      "OM-FFFFFFFF",
      payload.deviceId,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyLicenseReceipt(
      receipt,
      publicKeyBase64Url,
      payload.optimusId,
      "ffffffffffff",
      now,
    ),
    false,
  );
});

test("changing a signed product invalidates the receipt", async () => {
  const receipt = signLicenseReceipt(payload, privateKeyBase64);
  const tampered = {
    ...receipt,
    payload: { ...receipt.payload, product: "OPTIMUS_PRO" },
  };
  assert.equal(
    await verifyLicenseReceipt(
      tampered,
      publicKeyBase64Url,
      payload.optimusId,
      payload.deviceId,
      now,
    ),
    false,
  );
});

test("expired and future-dated receipts fail closed", async () => {
  const expired = signLicenseReceipt(
    {
      ...payload,
      issuedAt: "2025-09-10T05:00:00.000Z",
      expiresAt: "2026-09-10T05:59:59.000Z",
    },
    privateKeyBase64,
  );
  const future = signLicenseReceipt(
    { ...payload, issuedAt: "2026-09-10T06:06:00.000Z" },
    privateKeyBase64,
  );
  assert.equal(
    await verifyLicenseReceipt(
      expired,
      publicKeyBase64Url,
      payload.optimusId,
      payload.deviceId,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyLicenseReceipt(
      future,
      publicKeyBase64Url,
      payload.optimusId,
      payload.deviceId,
      now,
    ),
    false,
  );
});

test("missing or unrelated public keys never unlock a receipt", async () => {
  const receipt = signLicenseReceipt(payload, privateKeyBase64);
  const unrelated = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" });
  assert.equal(
    await verifyLicenseReceipt(receipt, undefined, payload.optimusId, payload.deviceId, now),
    false,
  );
  assert.equal(
    await verifyLicenseReceipt(
      receipt,
      String(unrelated.x),
      payload.optimusId,
      payload.deviceId,
      now,
    ),
    false,
  );
});
