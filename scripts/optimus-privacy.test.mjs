import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("total account erasure deletes identity and anonymizes commerce atomically", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    const [
      authSchema,
      pubsSchema,
      reportsSchema,
      textSchema,
      stateSchema,
      purchaseSchema,
      syncSchema,
      erasureSchema,
    ] = await Promise.all([
      read("../migrations/auth/0001_auth.sql"),
      read("../migrations/0003_add_publications_and_surveys.sql"),
      read("../migrations/0005_content_reports.sql"),
      read("../migrations/0006_user_identity_text.sql"),
      read("../migrations/0008_optimus_user_state.sql"),
      read("../migrations/0009_purchase_orders.sql"),
      read("../migrations/0012_optimus_sync_controls.sql"),
      read("../migrations/0016_account_erasure.sql"),
    ]);
    for (const schema of [
      authSchema,
      pubsSchema,
      reportsSchema,
      textSchema,
      stateSchema,
      purchaseSchema,
      syncSchema,
      erasureSchema,
    ]) {
      await db.exec(schema);
    }

    const userId = "user-erasure-total-1";
    const email = "erase-me@example.invalid";
    const supabaseUid = "supabase-uid-1";
    await db.exec(`
      create table profiles (id text primary key, email text, display_name text, stats jsonb);
      create table progressions (
        user_id text, deck_id text, seen jsonb, completed_lessons text[],
        updated_at timestamptz, primary key (user_id, deck_id)
      );
    `);
    await db.query(
      `insert into "user" (id, name, email, "emailVerified") values ($1, 'Effacé', $2, true)`,
      [userId, email],
    );
    await db.query(
      `insert into "session" (id, "expiresAt", token, "updatedAt", "userId")
       values ('sess-1', now() + interval '1 day', 'tok-1', now(), $1)`,
      [userId],
    );
    await db.query(
      `insert into verification (id, identifier, value, "expiresAt")
       values ('ver-1', $1, 'x', now() + interval '1 day')`,
      [email],
    );
    await db.query(
      `insert into optimus_user_state (user_id, optimus_id, state, revision)
       values ($1, 'OM-ERASE', '{"version":1}'::jsonb, 1)`,
      [userId],
    );
    await db.query(`insert into publications (title, created_by) values ('Contenu conservé', $1)`, [userId]);
    await db.query(`insert into surveys (title, created_by) values ('Enquête conservée', $1)`, [userId]);
    await db.query(
      `insert into survey_responses (survey_id, respondent_id, answers)
       select id, $1, '[]'::jsonb from surveys limit 1`,
      [userId],
    );
    await db.query(
      `insert into content_reports (user_id, content_type, content_id, label, issue_type, details, location)
       values ($1, 'deck', 'deck-1', 'Signalement', 'other', 'détails', 'loc')`,
      [userId],
    );
    await db.query(
      `insert into purchase_orders (reference, user_id, client_request_id, optimus_id, offer, specialty,
         deck_number, product, label, amount, status, device_id, device_key_id, device_public_key)
       values ('ORD-1', $1, 'cr-1', 'OM-ERASE', 'deck', 'cardio', 3, 'deck-3', 'Deck 3', 15000,
               'delivered', 'dev-1', 'devkey-1', 'pubkey-1')`,
      [userId],
    );
    await db.query(
      `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
       values ('ORD-1', $1, 'delivered', $2::jsonb)`,
      [userId, JSON.stringify({ deviceId: "dev-1", email, note: "ok" })],
    );
    await db.query(`insert into profiles (id, email) values ($1, $2)`, [supabaseUid, email]);
    await db.query(
      `insert into progressions (user_id, deck_id, seen) values ($1, 'deck-1', '{}'::jsonb)`,
      [supabaseUid],
    );

    const pseudonym = `erased:${createHash("sha256")
      .update(`optimus-account-erasure-v1:${userId}`)
      .digest("hex")}`;
    const counts = await db.query(
      `with del_learning as (
         delete from optimus_user_state where user_id = $1 returning user_id
       ),
       tomb as (
         insert into optimus_sync_controls (user_id, suspended_at, reason)
         values ($1, now(), 'account_erasure')
         on conflict (user_id)
         do update set suspended_at = excluded.suspended_at, reason = excluded.reason
         returning user_id
       ),
       del_survey_responses as (
         delete from survey_responses where respondent_id = $1 returning id
       ),
       detach_publications as (
         update publications set created_by = null where created_by = $1 returning id
       ),
       detach_surveys as (
         update surveys set created_by = null where created_by = $1 returning id
       ),
       del_content_reports as (
         delete from content_reports where user_id = $1 returning id
       ),
       anon_orders as (
         update purchase_orders
            set user_id = $2,
                device_id = null,
                device_key_id = null,
                device_public_key = null
          where user_id = $1
          returning reference
       ),
       anon_order_events as (
         update purchase_order_events
            set actor_user_id = null,
                metadata = metadata - 'deviceId' - 'device_id' - 'optimusId' - 'optimus_id' - 'email'
          where actor_user_id = $1
          returning id
       ),
       del_progressions as (
         delete from progressions
          where user_id in (
            select id from profiles where email = (select email from "user" where id = $1)
          )
          returning deck_id
       ),
       del_profiles as (
         delete from profiles where email = (select email from "user" where id = $1) returning id
       ),
       del_verification as (
         delete from verification
          where identifier = (select email from "user" where id = $1)
          returning id
       ),
       del_user as (
         delete from "user" where id = $1 returning id
       )
       select
         (select count(*)::int from del_learning) as learning_deleted,
         (select count(*)::int from del_survey_responses) as survey_responses_deleted,
         (select count(*)::int from detach_publications) as publications_detached,
         (select count(*)::int from detach_surveys) as surveys_detached,
         (select count(*)::int from del_content_reports) as content_reports_deleted,
         (select count(*)::int from anon_orders) as orders_anonymized,
         (select count(*)::int from anon_order_events) as order_events_anonymized,
         (select count(*)::int from del_verification) as verification_deleted,
         (select count(*)::int from del_user) as user_deleted`,
      [userId, pseudonym],
    );
    assert.equal(counts.rows[0].user_deleted, 1);
    assert.equal(counts.rows[0].orders_anonymized, 1);

    const count = async (sql, params = []) => (await db.query(sql, params)).rows.length;
    assert.equal(await count(`select id from "user" where id = $1`, [userId]), 0);
    assert.equal(await count(`select id from "session" where "userId" = $1`, [userId]), 0);
    assert.equal(await count(`select id from verification where identifier = $1`, [email]), 0);
    assert.equal(await count(`select user_id from optimus_user_state where user_id = $1`, [userId]), 0);
    const tombstone = await db.query(
      `select reason from optimus_sync_controls where user_id = $1`,
      [userId],
    );
    assert.equal(tombstone.rows[0].reason, "account_erasure");
    assert.equal(await count(`select id from survey_responses where respondent_id = $1`, [userId]), 0);
    const pub = await db.query(`select created_by from publications where title = 'Contenu conservé'`);
    assert.equal(pub.rows[0].created_by, null);
    const survey = await db.query(`select created_by from surveys where title = 'Enquête conservée'`);
    assert.equal(survey.rows[0].created_by, null);
    assert.equal(await count(`select id from content_reports where user_id = $1`, [userId]), 0);

    const order = await db.query(
      `select user_id, device_id, device_key_id, device_public_key, amount, status
         from purchase_orders where reference = 'ORD-1'`,
    );
    assert.equal(order.rows[0].user_id, pseudonym);
    assert.equal(order.rows[0].device_id, null);
    assert.equal(order.rows[0].device_key_id, null);
    assert.equal(order.rows[0].device_public_key, null);
    assert.equal(order.rows[0].amount, 15000);
    assert.equal(order.rows[0].status, "delivered");
    const event = await db.query(
      `select actor_user_id, metadata from purchase_order_events where reference = 'ORD-1'`,
    );
    assert.equal(event.rows[0].actor_user_id, null);
    assert.equal(event.rows[0].metadata.email, undefined);
    assert.equal(event.rows[0].metadata.deviceId, undefined);
    assert.equal(event.rows[0].metadata.note, "ok");

    assert.equal(await count(`select id from profiles where id = $1`, [supabaseUid]), 0);
    assert.equal(await count(`select user_id from progressions where user_id = $1`, [supabaseUid]), 0);
  } finally {
    await db.close();
  }
});

test("total account erasure is gated by an explicit typed confirmation", () => {
  assert.match(syncSource, /deleteOptimusAccountEntirely/);
  assert.match(syncSource, /DELETE_MY_ACCOUNT/);
  assert.match(syncSource, /account_erasure/);
  assert.match(syncSource, /middleware\(\[authMiddleware\]\)/);
});
