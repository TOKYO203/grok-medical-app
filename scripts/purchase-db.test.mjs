import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL("../migrations/0009_purchase_orders.sql", import.meta.url),
  "utf8",
);

test("0009 enforces idempotent purchase requests and immutable order events", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(migration);
    const requestId = "11111111-1111-4111-8111-111111111111";
    const insert = `insert into purchase_orders (
      reference, user_id, client_request_id, optimus_id, offer, specialty,
      deck_number, product, label, amount
    ) values ($1,$2,$3,$4,'deck','neurologie',1,'NEURO_DECK_01','Neurologie · Deck 1/10',3000)`;

    await db.query(insert, ["CMD-TEST-A1B2C3D4", "user-1", requestId, "OM-A1B2C3D4"]);

    await assert.rejects(
      db.query(insert, ["CMD-TEST-E5F6A7B8", "user-1", requestId, "OM-A1B2C3D4"]),
      /unique|duplicate/i,
    );

    await db.query(
      `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
       values ($1,$2,'created',$3::jsonb), ($1,$2,'instructions_requested',$4::jsonb)`,
      [
        "CMD-TEST-A1B2C3D4",
        "user-1",
        JSON.stringify({ amount: 3000 }),
        JSON.stringify({ channelRequested: true }),
      ],
    );
    const events = await db.query(
      "select event_type from purchase_order_events where reference = $1 order by id",
      ["CMD-TEST-A1B2C3D4"],
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), [
      "created",
      "instructions_requested",
    ]);

    await assert.rejects(
      db.query(
        "update purchase_orders set status = 'invented' where reference = $1",
        ["CMD-TEST-A1B2C3D4"],
      ),
      /check|violates/i,
    );
  } finally {
    await db.close();
  }
});
