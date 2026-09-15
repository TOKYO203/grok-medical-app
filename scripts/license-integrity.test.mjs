import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [store, proRoute, activationEndpoint, statusEndpoint, revocationBridge, root] = await Promise.all([
  readFile(new URL("../src/state/store.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/pro.tsx", import.meta.url), "utf8"),
  readFile(new URL("../server/api/licenses/activate.ts", import.meta.url), "utf8"),
  readFile(new URL("../server/api/licenses/status.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/license-revocation-bridge.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
]);

test("premium access is restored from signed receipts, not persisted flags", () => {
  assert.match(store, /verifyLicenseReceipt/);
  assert.match(store, /merge: mergePersistedState/);
  assert.match(store, /entitlements: \[freeEntitlement\(\)\]/);
  assert.doesNotMatch(store, /activatePro|grantEntitlement/);
  assert.doesNotMatch(proRoute, /activatePro|grantEntitlement/);
});

test("the activation endpoint signs a device-bound receipt with a server license id", () => {
  assert.match(activationEndpoint, /LICENSE_SIGNING_PRIVATE_KEY/);
  assert.match(activationEndpoint, /signLicenseReceipt/);
  assert.match(activationEndpoint, /device_id is null or device_id = \$2/);
  assert.match(activationEndpoint, /returning id, product, expires_at, activated_at/);
  assert.match(activationEndpoint, /licenseId: license\.id/);
  assert.doesNotMatch(activationEndpoint, /DECK_SIGNING_PRIVATE_KEY/);
});

test("signed licenses are checked for explicit revocation when connectivity returns", () => {
  assert.match(statusEndpoint, /verifyLicenseReceipt/);
  assert.match(statusEndpoint, /revoked_at/);
  assert.match(statusEndpoint, /license-status/);
  assert.match(revocationBridge, /\/api\/licenses\/status/);
  assert.match(revocationBridge, /result\.revoked === true/);
  assert.match(revocationBridge, /window\.addEventListener\("online"/);
  assert.match(revocationBridge, /restoreLicenses/);
  assert.match(root, /<LicenseRevocationBridge \/>/);
});
