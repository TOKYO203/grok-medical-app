import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { stagingConfig, loadMigrations, proveMigration } from "./staging-migration.mjs";

const env = {
  DB_VALIDATION_TARGET: "staging",
  STAGING_CONFIRMATION: "STAGING",
  GITHUB_REF: "refs/heads/release/v1-hardening",
  GITHUB_SHA: "a".repeat(40),
  STAGING_DATABASE_URL:
    "postgresql://stage:secret@ep-test-123.eu-central-1.aws.neon.tech/staging?sslmode=verify-full",
  STAGING_EXPECTED_HOST: "ep-test-123.eu-central-1.aws.neon.tech",
  STAGING_EXPECTED_DATABASE: "staging",
  STAGING_EXPECTED_ROLE: "stage",
};
test("target guard rejects unsafe or ambiguous targets without connecting", () => {
  assert.equal(stagingConfig(env).maxOrphans, 0);
  for (const patch of [
    { GITHUB_REF: "refs/heads/main" },
    { STAGING_CONFIRMATION: "STAGING; echo unsafe" },
    { STAGING_EXPECTED_HOST: "ep-production.eu-central-1.aws.neon.tech" },
    { STAGING_EXPECTED_DATABASE: "production" },
    { STAGING_EXPECTED_ROLE: "owner" },
    { STAGING_MAX_ORPHANS: "-1" },
    { GITHUB_SHA: "main" },
    { STAGING_DATABASE_URL: env.STAGING_DATABASE_URL.replace("verify-full", "disable") },
    { STAGING_DATABASE_URL: env.STAGING_DATABASE_URL + "&options=-csearch_path=evil" },
    {
      STAGING_DATABASE_URL: env.STAGING_DATABASE_URL.replace("ep-test-123.", "ep-test-123-pooler."),
    },
  ])
    assert.throws(() => stagingConfig({ ...env, ...patch }));
});

const migrations = await loadMigrations();
// PGlite uses exec for multi-statement SQL; production uses pg's simple protocol.
function connection(db) {
  return {
    query: async (sql, params) => {
      if (params) return db.query(sql, params);
      const results = await db.exec(sql);
      return results.at(-1) ?? { rows: [] };
    },
  };
}
async function withDb(fn) {
  if (process.env.TEST_POSTGRES_URL) {
    const url = new URL(process.env.TEST_POSTGRES_URL);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(url.hostname),
      "fixtures require local disposable PostgreSQL",
    );
    const name = `migration_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString: url.href });
    await admin.connect();
    let created = false;
    let client;
    try {
      await admin.query(`CREATE DATABASE ${name}`);
      created = true;
      url.pathname = `/${name}`;
      client = new pg.Client({ connectionString: url.href });
      await client.connect();
      await fn(
        { exec: (sql) => client.query(sql), query: (sql, params) => client.query(sql, params) },
        client,
      );
    } finally {
      if (client) await client.end();
      if (created) await admin.query(`DROP DATABASE ${name}`);
      await admin.end();
    }
    return;
  }
  const db = new PGlite();
  await db.waitReady;
  try {
    await fn(db, connection(db));
  } finally {
    await db.close();
  }
}
async function seedLegacy(db) {
  await db.exec(
    "create table _migrations (name text primary key, applied_at timestamptz default now())",
  );
  for (const m of migrations.filter((m) => m.name < "0006")) {
    await db.exec(m.sql);
    await db.query("insert into _migrations(name) values ($1)", [m.name]);
  }
  const trusted = "11111111-2222-3333-4444-555555555555";
  const orphan = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  await db.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1,'Test','test@example.invalid',true,now(),now())`,
    [trusted],
  );
  for (const id of [trusted, orphan, null]) {
    await db.query(
      "insert into publications(title, body, created_by) values ('Keep content', '{\"content\":\"unchanged\"}', $1)",
      [id],
    );
    const survey = await db.query(
      "insert into surveys(title, created_by) values ('Keep survey', $1) returning id",
      [id],
    );
    await db.query(
      "insert into survey_responses(survey_id, respondent_id, answers) values ($1, $2, '[{\"answer\":42}]')",
      [survey.rows[0].id, id],
    );
  }
}

test("empty database rehearsal rolls back schema, apply and rerun are valid", async () =>
  withDb(async (db, client) => {
    await db.exec("BEGIN");
    const empty = await proveMigration(client, migrations);
    assert.equal(empty.scenario, "empty-database");
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query("select to_regclass('public.publications') as name")).rows[0].name,
      null,
    );
    await db.exec("BEGIN");
    await proveMigration(client, migrations);
    await db.exec("COMMIT; BEGIN");
    const again = await proveMigration(client, migrations);
    assert.deepEqual(again.migrationsApplied, []);
    await db.exec("ROLLBACK");
  }));

test("legacy upgrade preserves rows, clears only approved orphans and supports non-UUID users", async () =>
  withDb(async (db, client) => {
    await seedLegacy(db);
    await db.exec("BEGIN");
    await assert.rejects(proveMigration(client, migrations), /orphan budget/);
    await db.exec("ROLLBACK; BEGIN");
    const result = await proveMigration(client, migrations, { maxOrphans: 3 });
    assert.equal(result.orphanReferencesCleared, 3);
    assert.equal(result.dataPreserved, true);
    assert.deepEqual(
      result.before.map((t) => t.rows),
      [3, 3, 3],
    );
    await db.exec("COMMIT");
    await db.exec(`insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ('better-auth-text-id','Text','text@example.invalid',true,now(),now());
    insert into publications(title,created_by) values ('Text author','better-auth-text-id')`);
    await assert.rejects(
      db.exec("insert into publications(title,created_by) values ('Fake','unknown')"),
      /foreign key/,
    );
  }));

test("unexpected content mutation is caught before commit and can be rolled back", async () =>
  withDb(async (db, client) => {
    await seedLegacy(db);
    const changed = migrations.map((m) =>
      m.name === "0006_user_identity_text.sql"
        ? { ...m, sql: m.sql + "\nUPDATE publications SET title = 'corrupted';" }
        : m,
    );
    await db.exec("BEGIN");
    await assert.rejects(
      proveMigration(client, changed, { maxOrphans: 3 }),
      /unexpected data change/,
    );
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query("select count(*)::int as n from publications where title = 'Keep content'"))
        .rows[0].n,
      3,
    );
    assert.equal(
      (
        await db.query(
          "select data_type from information_schema.columns where table_name='publications' and column_name='created_by'",
        )
      ).rows[0].data_type,
      "uuid",
    );
  }));
