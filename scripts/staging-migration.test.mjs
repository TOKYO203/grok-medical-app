import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { stagingConfig, loadMigrations, proveMigration } from "./staging-migration.mjs";

const env = {
  DB_VALIDATION_TARGET: "staging",
  STAGING_CONFIRMATION: "STAGING",
  GITHUB_REF: "refs/heads/release/v1-hardening",
  GITHUB_SHA: "a".repeat(40),
  STAGING_DATABASE_URL:
    "postgresql://postgres.stage01:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
  STAGING_EXPECTED_HOST: "aws-0-eu-central-1.pooler.supabase.com",
  STAGING_EXPECTED_DATABASE: "postgres",
  STAGING_EXPECTED_ROLE: "postgres.stage01",
};
test("target guard rejects unsafe or ambiguous targets without connecting", () => {
  assert.equal(stagingConfig(env).maxOrphans, 0);
  for (const patch of [
    { GITHUB_REF: "refs/heads/main" },
    { STAGING_CONFIRMATION: "STAGING; echo unsafe" },
    { STAGING_EXPECTED_HOST: "aws-0-eu-west-1.pooler.supabase.com" },
    { STAGING_EXPECTED_DATABASE: "production" },
    { STAGING_EXPECTED_ROLE: "owner" },
    { STAGING_MAX_ORPHANS: "-1" },
    { GITHUB_SHA: "main" },
    { STAGING_DATABASE_URL: env.STAGING_DATABASE_URL.replace("verify-full", "disable") },
    { STAGING_DATABASE_URL: env.STAGING_DATABASE_URL + "&options=-csearch_path=evil" },
    { STAGING_DATABASE_URL: env.STAGING_DATABASE_URL.replace(":5432", ":6543") },
    {
      STAGING_DATABASE_URL: env.STAGING_DATABASE_URL.replace(
        "aws-0-eu-central-1.pooler.supabase.com",
        "db-0123456789ab.supabase.co",
      ),
    },
  ])
    assert.throws(() => stagingConfig({ ...env, ...patch }));
});

const migrations = await loadMigrations();

/**
 * Les trois répétitions de migration ci-dessous exigent de VRAIES sémantiques
 * de transaction : un ROLLBACK doit annuler du DDL, et les tables temporaires
 * `ON COMMIT DROP` (preuves d'intégrité de `proveMigration`) doivent vivre
 * jusqu'au COMMIT. PGlite auto-committe chaque `exec()` — y compris à
 * l'intérieur de son API `transaction()` — ces sémantiques y sont donc
 * invérifiables. Ces tests ne tournent que contre un PostgreSQL jetable
 * local (`TEST_POSTGRES_URL`), fourni par la CI via un conteneur de service.
 *
 * `withDb` fournit :
 *   - `h.query(sql, params)` : requête hors transaction (auto-commit) ;
 *   - `h.exec(sql)`          : multi-instructions hors transaction ;
 *   - `h.tx(work)`           : transaction ; `work` reçoit `{ query }`
 *     (protocole simple : multi-instructions sans paramètres autorisées).
 *     La transaction est ANNULÉE si `work` lève.
 */
async function withDb(fn) {
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
    await fn({
      query: (sql, params) => client.query(sql, params),
      exec: (sql) => client.query(sql),
      tx: async (work) => {
        await client.query("BEGIN");
        try {
          const result = await work({ query: (sql, params) => client.query(sql, params) });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      },
    });
  } finally {
    if (client) await client.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
}
async function seedLegacy(h) {
  await h.exec(
    "create table _migrations (name text primary key, applied_at timestamptz default now())",
  );
  for (const m of migrations.filter((m) => m.name < "0006")) {
    await h.exec(m.sql);
    await h.query("insert into _migrations(name) values ($1)", [m.name]);
  }
  const trusted = "11111111-2222-3333-4444-555555555555";
  const orphan = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  await h.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1,'Test','test@example.invalid',true,now(),now())`,
    [trusted],
  );
  for (const id of [trusted, orphan, null]) {
    await h.query(
      "insert into publications(title, body, created_by) values ('Keep content', '{\"content\":\"unchanged\"}', $1)",
      [id],
    );
    const survey = await h.query(
      "insert into surveys(title, created_by) values ('Keep survey', $1) returning id",
      [id],
    );
    await h.query(
      "insert into survey_responses(survey_id, respondent_id, answers) values ($1, $2, '[{\"answer\":42}]')",
      [survey.rows[0].id, id],
    );
  }
}

const rehearsalOptions = { skip: !process.env.TEST_POSTGRES_URL };

test(
  "empty database rehearsal rolls back schema, apply and rerun are valid",
  rehearsalOptions,
  async () =>
    withDb(async (h) => {
      // Une répétition annulée ne laisse AUCUN schéma derrière elle.
      class RollbackSignal extends Error {}
      await assert.rejects(
        h.tx(async (client) => {
          const empty = await proveMigration(client, migrations);
          assert.equal(empty.scenario, "empty-database");
          throw new RollbackSignal("annulation volontaire de la répétition");
        }),
        RollbackSignal,
      );
      assert.equal(
        (await h.query("select to_regclass('public.publications') as name")).rows[0].name,
        null,
      );
      // Application réelle (commitée), puis re-répétition : plus rien à appliquer.
      await h.tx(async (client) => {
        await proveMigration(client, migrations);
      });
      await h.tx(async (client) => {
        const again = await proveMigration(client, migrations);
        assert.deepEqual(again.migrationsApplied, []);
      });
    }),
);

test(
  "legacy upgrade preserves rows, clears only approved orphans and supports non-UUID users",
  rehearsalOptions,
  async () =>
    withDb(async (h) => {
      await seedLegacy(h);
      // Sans budget, les orphelins bloquent toute application (et rien n'est écrit).
      await assert.rejects(
        h.tx(async (client) => {
          await proveMigration(client, migrations);
        }),
        /orphan budget/,
      );
      // Avec budget approuvé : orphelins nettoyés, tout le reste préservé.
      const result = await h.tx(async (client) =>
        proveMigration(client, migrations, { maxOrphans: 3 }),
      );
      assert.equal(result.orphanReferencesCleared, 3);
      assert.equal(result.dataPreserved, true);
      assert.deepEqual(
        result.before.map((t) => t.rows),
        [3, 3, 3],
      );
      await h.exec(`insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ('better-auth-text-id','Text','text@example.invalid',true,now(),now());
    insert into publications(title,created_by) values ('Text author','better-auth-text-id')`);
      await assert.rejects(
        h.query("insert into publications(title,created_by) values ('Fake','unknown')"),
        /foreign key/,
      );
    }),
);

test(
  "unexpected content mutation is caught before commit and can be rolled back",
  rehearsalOptions,
  async () =>
    withDb(async (h) => {
      await seedLegacy(h);
      const changed = migrations.map((m) =>
        m.name === "0006_user_identity_text.sql"
          ? { ...m, sql: m.sql + "\nUPDATE publications SET title = 'corrupted';" }
          : m,
      );
      await assert.rejects(
        h.tx(async (client) => proveMigration(client, changed, { maxOrphans: 3 })),
        /unexpected data change/,
      );
      assert.equal(
        (
          await h.query(
            "select count(*)::int as n from publications where title = 'Keep content'",
          )
        ).rows[0].n,
        3,
      );
      assert.equal(
        (
          await h.query(
            "select data_type from information_schema.columns where table_name='publications' and column_name='created_by'",
          )
        ).rows[0].data_type,
        "uuid",
      );
    }),
);
