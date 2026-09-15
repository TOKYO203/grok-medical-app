import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [activationMigration, purchaseMigration, verificationMigration] = await Promise.all([
  read("../migrations/0004_activation_keys.sql"),
  read("../migrations/0009_purchase_orders.sql"),
  read("../migrations/0010_purchase_verification.sql"),
]);

async function setupDb() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(activationMigration);
  await db.exec(purchaseMigration);
  await db.exec(verificationMigration);
  return db;
}

const insertOrder = `insert into purchase_orders (
  reference, user_id, client_request_id, optimus_id, offer, specialty,
  deck_number, product, label, amount
) values ($1,$2,$3,$4,'deck','neurologie',1,'NEURO_DECK_01','Neurologie · Deck 1/10',3000)`;

test("purchase migrations preserve request idempotency and ordered audit states", async () => {
  const db = await setupDb();
  try {
    const requestId = "11111111-1111-4111-8111-111111111111";
    await db.query(insertOrder, ["CMD-TEST-A1B2C3D4", "user-1", requestId, "OM-A1B2C3D4"]);

    await assert.rejects(
      db.query(insertOrder, ["CMD-TEST-E5F6A7B8", "user-1", requestId, "OM-A1B2C3D4"]),
      /unique|duplicate/i,
    );

    await db.query(
      `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
       values ($1,$2,'created',$3::jsonb), ($1,$2,'instructions_requested',$4::jsonb),
              ($1,$2,'payment_verified',$5::jsonb)`,
      [
        "CMD-TEST-A1B2C3D4",
        "user-1",
        JSON.stringify({ amount: 3000 }),
        JSON.stringify({ provider: "TEST" }),
        JSON.stringify({ verified: true }),
      ],
    );
    const events = await db.query(
      "select event_type from purchase_order_events where reference = $1 order by id",
      ["CMD-TEST-A1B2C3D4"],
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), [
      "created",
      "instructions_requested",
      "payment_verified",
    ]);

    await assert.rejects(
      db.query("update purchase_orders set status = 'invented' where reference = $1", [
        "CMD-TEST-A1B2C3D4",
      ]),
      /check|violates/i,
    );
  } finally {
    await db.close();
  }
});

test("one Mobile Money transaction reference cannot be replayed across orders", async () => {
  const db = await setupDb();
  try {
    await db.query(insertOrder, [
      "CMD-TEST-A1B2C3D4",
      "user-1",
      "11111111-1111-4111-8111-111111111111",
      "OM-A1B2C3D4",
    ]);
    await db.query(insertOrder, [
      "CMD-TEST-E5F6A7B8",
      "user-2",
      "22222222-2222-4222-8222-222222222222",
      "OM-E5F6A7B8",
    ]);

    await db.query(
      `update purchase_orders
          set payment_provider = 'MVOLA', payment_reference = 'TXN-UNIQUE-001'
        where reference = $1`,
      ["CMD-TEST-A1B2C3D4"],
    );

    await assert.rejects(
      db.query(
        `update purchase_orders
            set payment_provider = 'MVOLA', payment_reference = 'TXN-UNIQUE-001'
          where reference = $1`,
        ["CMD-TEST-E5F6A7B8"],
      ),
      /unique|duplicate/i,
    );
  } finally {
    await db.close();
  }
});

test("one proof digest cannot be reused and linked activation keys can be revoked", async () => {
  const db = await setupDb();
  try {
    await db.query(insertOrder, [
      "CMD-TEST-A1B2C3D4",
      "user-1",
      "11111111-1111-4111-8111-111111111111",
      "OM-A1B2C3D4",
    ]);
    await db.query(insertOrder, [
      "CMD-TEST-E5F6A7B8",
      "user-2",
      "22222222-2222-4222-8222-222222222222",
      "OM-E5F6A7B8",
    ]);
    const digest = "a".repeat(64);
    await db.query("update purchase_orders set proof_digest = $2 where reference = $1", [
      "CMD-TEST-A1B2C3D4",
      digest,
    ]);
    await assert.rejects(
      db.query("update purchase_orders set proof_digest = $2 where reference = $1", [
        "CMD-TEST-E5F6A7B8",
        digest,
      ]),
      /unique|duplicate/i,
    );

    await db.query(
      `insert into activation_keys (key_hash, optimus_id, product, purchase_reference)
       values ($1,$2,$3,$4)`,
      ["b".repeat(64), "OM-A1B2C3D4", "NEURO_DECK_01", "CMD-TEST-A1B2C3D4"],
    );
    const revoked = await db.query(
      `update activation_keys set revoked_at = now()
        where purchase_reference = $1 and revoked_at is null
        returning revoked_at`,
      ["CMD-TEST-A1B2C3D4"],
    );
    assert.equal(revoked.rows.length, 1);
    assert.ok(revoked.rows[0]?.revoked_at);
  } finally {
    await db.close();
  }
});
