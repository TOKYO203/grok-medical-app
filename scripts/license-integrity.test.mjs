import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [store, proRoute, activationEndpoint] = await Promise.all([
  readFile(new URL("../src/state/store.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/pro.tsx", import.meta.url), "utf8"),
  readFile(new URL("../server/api/licenses/activate.ts", import.meta.url), "utf8"),
]);

test("premium access is restored from signed receipts, not persisted flags", () => {
  assert.match(store, /verifyLicenseReceipt/);
  assert.match(store, /merge: mergePersistedState/);
  assert.match(store, /entitlements: \[freeEntitlement\(\)\]/);
  assert.doesNotMatch(store, /activatePro|grantEntitlement/);
  assert.doesNotMatch(proRoute, /activatePro|grantEntitlement/);
});

test("the activation endpoint signs a device-bound receipt with a dedicated key", () => {
  assert.match(activationEndpoint, /LICENSE_SIGNING_PRIVATE_KEY/);
  assert.match(activationEndpoint, /signLicenseReceipt/);
  assert.match(activationEndpoint, /device_id is null or device_id = \$2/);
  assert.match(activationEndpoint, /receipt/);
  assert.doesNotMatch(activationEndpoint, /DECK_SIGNING_PRIVATE_KEY/);
});
