import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [stateMigration, privacyMigration, syncSource, bridgeSource] = await Promise.all([
  read("../migrations/0008_optimus_user_state.sql"),
  read("../migrations/0012_optimus_sync_controls.sql"),
  read("../src/lib/optimus-sync.ts"),
  read("../src/components/optimus-sync-bridge.tsx"),
]);

test("cloud learning erasure deletes the snapshot and leaves a durable tombstone", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(stateMigration);
    await db.exec(privacyMigration);
    await db.query(
      `insert into optimus_user_state (user_id, optimus_id, state, revision)
       values ($1,$2,$3::jsonb,1)`,
      ["user-privacy-1", "OM-PRIVACY", JSON.stringify({ version: 1 })],
    );

    await db.query(
      `with deleted as (
         delete from optimus_user_state where user_id = $1 returning user_id
       )
       insert into optimus_sync_controls (user_id, suspended_at, reason)
       values ($1, now(), 'user_erasure')
       on conflict (user_id)
       do update set suspended_at = excluded.suspended_at, reason = excluded.reason`,
      ["user-privacy-1"],
    );

    const state = await db.query(
      "select user_id from optimus_user_state where user_id = $1",
      ["user-privacy-1"],
    );
    const control = await db.query(
      "select reason from optimus_sync_controls where user_id = $1",
      ["user-privacy-1"],
    );
    assert.equal(state.rows.length, 0);
    assert.equal(control.rows[0]?.reason, "user_erasure");
  } finally {
    await db.close();
  }
});

test("privacy export is authenticated and omits device private material", () => {
  assert.match(syncSource, /exportOptimusAccountData/);
  assert.match(syncSource, /middleware\(\[authMiddleware\]\)/);
  assert.match(syncSource, /purchase_orders/);
  assert.match(syncSource, /content_reports/);
  assert.match(syncSource, /survey_responses/);
  assert.doesNotMatch(syncSource, /device_private_key/);
  assert.match(syncSource, /clés privées d'appareil ne quittent jamais l'appareil/);
});

test("all devices stop pushing after a user erasure until explicit resume", () => {
  assert.match(syncSource, /syncSuspended:\s*true/);
  assert.match(syncSource, /resumeOptimusCloudSync/);
  assert.match(syncSource, /RESUME_OPTIMUS_SYNC/);
  assert.match(bridgeSource, /remote\.syncSuspended/);
  assert.match(bridgeSource, /result\.suspended/);
  assert.match(bridgeSource, /stopForUserErasure/);
});
