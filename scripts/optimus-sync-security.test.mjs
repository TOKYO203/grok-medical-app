import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [serverSync, syncModel, syncBridge, migration] = await Promise.all([
  read("../src/lib/optimus-sync.ts"),
  read("../src/lib/optimus-sync-model.ts"),
  read("../src/components/optimus-sync-bridge.tsx"),
  read("../migrations/0008_optimus_user_state.sql"),
]);

test("cloud sync is scoped only by the verified auth context", () => {
  assert.match(serverSync, /middleware\(\[authMiddleware\]\)/);
  assert.match(serverSync, /context\.userId/);
  assert.doesNotMatch(serverSync, /data\.userId|data\.user_id|snapshot\.userId|snapshot\.user_id/);
  assert.match(serverSync, /where user_id = \$1/);
});

test("device-bound Premium and commercial material is excluded from learning sync", () => {
  for (const forbiddenField of [
    "deviceId",
    "coverDataUrl",
    "licenses",
    "entitlements",
    "importedDecks",
    "privateKey",
    "encryptedDeck",
    "purchases",
  ]) {
    assert.doesNotMatch(syncModel, new RegExp(`^\\s*${forbiddenField}\\s*:`, "m"));
  }
  assert.doesNotMatch(syncModel, /const\s+purchaseSchema\b/);
  assert.doesNotMatch(syncBridge, /^\s*purchases\s*:/m);
  assert.match(syncBridge, /deviceId: current\.profile\.deviceId/);
  assert.match(syncBridge, /tier: current\.profile\.tier/);
  assert.match(syncBridge, /coverDataUrl: current\.profile\.coverDataUrl/);
});

test("optimistic revisions prevent stale device overwrites", () => {
  assert.match(serverSync, /and revision = \$4/);
  assert.match(serverSync, /revision = revision \+ 1/);
  assert.match(serverSync, /conflict: true/);
  assert.match(syncBridge, /mergeOptimusSnapshots/);
  assert.match(migration, /revision bigint NOT NULL DEFAULT 1/);
});

test("account switching does not merge another user's local state", () => {
  assert.match(syncBridge, /owner && !sameOwner/);
  assert.match(syncBridge, /resetLocal\(\)/);
  assert.match(syncBridge, /optimus\.sync\.user-id/);
});
