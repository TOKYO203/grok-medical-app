import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration0006 = await readFile(new URL("../migrations/0006_user_identity_text.sql", import.meta.url), "utf8");
const migration0007 = await readFile(new URL("../migrations/0007_api_rate_limits.sql", import.meta.url), "utf8");
const migration0008 = await readFile(new URL("../migrations/0008_optimus_user_state.sql", import.meta.url), "utf8");

test("0006 converts Better Auth identity columns to text without losing existing UUID values", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(`
      create table publications (id uuid primary key, created_by uuid);
      create table surveys (id uuid primary key, created_by uuid);
      create table survey_responses (id uuid primary key, respondent_id uuid);
    `);

    const userId = "11111111-2222-3333-4444-555555555555";
    await db.query("insert into publications (id, created_by) values ($1, $2)", ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", userId]);
    await db.query("insert into surveys (id, created_by) values ($1, $2)", ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", userId]);
    await db.query("insert into survey_responses (id, respondent_id) values ($1, $2)", ["cccccccc-cccc-cccc-cccc-cccccccccccc", userId]);

    await db.exec(migration0006);

    const columns = await db.query(`
      select table_name, column_name, data_type
      from information_schema.columns
      where (table_name = 'publications' and column_name = 'created_by')
         or (table_name = 'surveys' and column_name = 'created_by')
         or (table_name = 'survey_responses' and column_name = 'respondent_id')
      order by table_name, column_name
    `);
    assert.equal(columns.rows.length, 3);
    assert.deepEqual(new Set(columns.rows.map((row) => row.data_type)), new Set(["text"]));

    const publication = await db.query("select created_by from publications limit 1");
    const survey = await db.query("select created_by from surveys limit 1");
    const response = await db.query("select respondent_id from survey_responses limit 1");
    assert.equal(publication.rows[0]?.created_by, userId);
    assert.equal(survey.rows[0]?.created_by, userId);
    assert.equal(response.rows[0]?.respondent_id, userId);
  } finally {
    await db.close();
  }
});

test("0007 provides an atomic shared counter for fixed-window rate limiting", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(migration0007);
    const bucket = "test-bucket";
    const windowStart = new Date(0).toISOString();

    for (let expected = 1; expected <= 3; expected += 1) {
      const result = await db.query(
        `insert into api_rate_limits (bucket_key, window_start, request_count, updated_at)
         values ($1, $2, 1, now())
         on conflict (bucket_key, window_start)
         do update set request_count = api_rate_limits.request_count + 1,
                       updated_at = now()
         returning request_count`,
        [bucket, windowStart],
      );
      assert.equal(Number(result.rows[0]?.request_count), expected);
    }
  } finally {
    await db.close();
  }
});

test("0008 isolates one revisioned Optimus snapshot per authenticated user", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(migration0008);
    const state = JSON.stringify({ version: 1, profile: { optimusId: "OM-A1B2C3D4" } });

    const inserted = await db.query(
      `insert into optimus_user_state (user_id, optimus_id, state)
       values ($1, $2, $3::jsonb)
       returning user_id, optimus_id, revision`,
      ["auth-user-1", "OM-A1B2C3D4", state],
    );
    assert.equal(inserted.rows[0]?.user_id, "auth-user-1");
    assert.equal(inserted.rows[0]?.optimus_id, "OM-A1B2C3D4");
    assert.equal(Number(inserted.rows[0]?.revision), 1);

    const updated = await db.query(
      `update optimus_user_state
          set state = $2::jsonb, revision = revision + 1, updated_at = now()
        where user_id = $1 and revision = 1
        returning revision`,
      ["auth-user-1", state],
    );
    assert.equal(Number(updated.rows[0]?.revision), 2);

    const stale = await db.query(
      `update optimus_user_state
          set revision = revision + 1
        where user_id = $1 and revision = 1
        returning revision`,
      ["auth-user-1"],
    );
    assert.equal(stale.rows.length, 0, "a stale revision must not overwrite the newer snapshot");

    await assert.rejects(
      db.query(
        `insert into optimus_user_state (user_id, optimus_id, state)
         values ($1, $2, $3::jsonb)`,
        ["auth-user-2", "OM-A1B2C3D4", state],
      ),
      /unique|duplicate/i,
    );
  } finally {
    await db.close();
  }
});
