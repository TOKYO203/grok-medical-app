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
 * `withDb` fournit un point d'accès uniforme aux deux moteurs :
 *   - `h.query(sql, params)` : requête hors transaction (auto-commit) ;
 *   - `h.exec(sql)`          : multi-instructions hors transaction ;
 *   - `h.tx(work)`           : transaction ; `work` reçoit une connection.
 *     La transaction est ANNULÉE si `work` lève — c'est la sémantique de
 *     répétition (« rehearsal ») : rien ne survit à un échec.
 *
 * PostgreSQL réel (TEST_POSTGRES_URL) : BEGIN/COMMIT/ROLLBACK explicites en
 * protocole simple — le chemin de production.
 *
 * PGlite (CI, sans serveur) : API `db.transaction()`. En dehors de cette API,
 * chaque `exec()` est auto-committé : un « BEGIN » en statement libre ne tient
 * pas, et les tables temporaires `ON COMMIT DROP` (preuves d'intégrité de
 * `proveMigration`) disparaissent immédiatement. C'est pourquoi les trois tests
 * ci-dessous passent TOUS leurs appels à `proveMigration` par `h.tx`.
 */
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
      await fn({
        query: (sql, params) => client.query(sql, params),
        exec: (sql) => client.query(sql),
        tx: async (work) => {
          await client.query("BEGIN");
          try {
            const result = await work((sql, params) => client.query(sql, params));
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
    return;
  }
  const db = new PGlite();
  await db.waitReady;
  try {
    await fn({
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      // PGlite : sans paramètres, on passe par `exec` (protocole simple,
      // multi-instructions) — `query` (protocole étendu) les refuse.
      tx: (work) =>
        db.transaction(async (tx) =>
          work(async (sql, params) => {
            if (params) return tx.query(sql, params);
            const results = await tx.exec(sql);
            return results.at(-1) ?? { rows: [] };
          }),
        ),
    });
  } finally {
    await db.close();
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

test("empty database rehearsal rolls back schema, apply and rerun are valid", async () =>
  withDb(async (h) => {
    // Une répétition annulée ne laisse AUCUN schéma derrière elle.
    class RollbackSignal extends Error {}
    await assert.rejects(
      h.tx(async (query) => {
        const empty = await proveMigration(query, migrations);
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
    await h.tx(async (query) => {
      await proveMigration(query, migrations);
    });
    await h.tx(async (query) => {
      const again = await proveMigration(query, migrations);
      assert.deepEqual(again.migrationsApplied, []);
    });
  }));

test("legacy upgrade preserves rows, clears only approved orphans and supports non-UUID users", async () =>
  withDb(async (h) => {
    await seedLegacy(h);
    // Sans budget, les orphelins bloquent toute application (et rien n'est écrit).
    await assert.rejects(
      h.tx(async (query) => {
        await proveMigration(query, migrations);
      }),
      /orphan budget/,
    );
    // Avec budget approuvé : orphelins nettoyés, tout le reste préservé.
    const result = await h.tx(async (query) =>
      proveMigration(query, migrations, { maxOrphans: 3 }),
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
  }));

test("unexpected content mutation is caught before commit and can be rolled back", async () =>
  withDb(async (h) => {
    await seedLegacy(h);
    const changed = migrations.map((m) =>
      m.name === "0006_user_identity_text.sql"
        ? { ...m, sql: m.sql + "\nUPDATE publications SET title = 'corrupted';" }
        : m,
    );
    await assert.rejects(
      h.tx(async (query) => proveMigration(query, changed, { maxOrphans: 3 })),
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
  }));
