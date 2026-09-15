#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  migrationName,
  migrationPathsForAuth,
  pendingMigrations,
} from "./migration-plan.mjs";

const databaseUrl = process.env.STAGING_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[staging-db] STAGING_DATABASE_URL is required.");
  process.exit(2);
}
if (process.env.DB_VALIDATION_TARGET !== "staging") {
  console.error("[staging-db] DB_VALIDATION_TARGET=staging is required as an explicit safety guard.");
  process.exit(2);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("[staging-db] STAGING_DATABASE_URL is not a valid URL.");
  process.exit(2);
}
if (!new Set(["postgres:", "postgresql:"]).has(parsedUrl.protocol)) {
  console.error("[staging-db] expected a PostgreSQL connection URL.");
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "migrations");
const authDir = join(migrationsDir, "auth");

async function readEntries(dir) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function expectedMigrationNames() {
  const rootEntries = await readEntries(migrationsDir);
  const authEntries = (await readEntries(authDir)).map((name) => `auth/${name}`);
  const selected = migrationPathsForAuth(rootEntries, authEntries, true);
  return pendingMigrations(selected, []).map(({ name }) => migrationName(name));
}

const expectedIdentityColumns = new Map([
  ["publications.created_by", "text"],
  ["surveys.created_by", "text"],
  ["survey_responses.respondent_id", "text"],
]);
const expectedForeignKeys = new Set([
  "publications_created_by_auth_user_fk",
  "surveys_created_by_auth_user_fk",
  "survey_responses_respondent_auth_user_fk",
]);

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");

    const migrationTable = await client.query(
      "select to_regclass('public._migrations')::text as table_name",
    );
    assert.equal(migrationTable.rows[0]?.table_name, "_migrations", "_migrations table is missing");

    const expected = await expectedMigrationNames();
    const appliedResult = await client.query("select name from _migrations order by name");
    const applied = new Set(appliedResult.rows.map((row) => String(row.name)));
    const missing = expected.filter((name) => !applied.has(name));
    assert.deepEqual(missing, [], `missing staging migrations: ${missing.join(", ")}`);

    const authColumn = await client.query(`
      select data_type
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'user'
         and column_name = 'id'
    `);
    assert.equal(authColumn.rows[0]?.data_type, "text", 'Better Auth "user"."id" must be text');

    const identityColumns = await client.query(`
      select table_name, column_name, data_type
        from information_schema.columns
       where table_schema = 'public'
         and ((table_name = 'publications' and column_name = 'created_by')
           or (table_name = 'surveys' and column_name = 'created_by')
           or (table_name = 'survey_responses' and column_name = 'respondent_id'))
       order by table_name, column_name
    `);
    assert.equal(identityColumns.rows.length, expectedIdentityColumns.size, "identity columns are missing");
    for (const row of identityColumns.rows) {
      const key = `${row.table_name}.${row.column_name}`;
      assert.equal(row.data_type, expectedIdentityColumns.get(key), `${key} must be text`);
    }

    const fkResult = await client.query(`
      select conname, convalidated
        from pg_constraint
       where conname = any($1::text[])
       order by conname
    `, [[...expectedForeignKeys]]);
    assert.equal(fkResult.rows.length, expectedForeignKeys.size, "one or more identity foreign keys are missing");
    for (const row of fkResult.rows) {
      assert.equal(row.convalidated, true, `${row.conname} must be validated`);
    }

    const orphanResult = await client.query(`
      select
        (select count(*)::int from publications p
          where p.created_by is not null
            and not exists (select 1 from "user" u where u."id" = p.created_by)) as publication_orphans,
        (select count(*)::int from surveys s
          where s.created_by is not null
            and not exists (select 1 from "user" u where u."id" = s.created_by)) as survey_orphans,
        (select count(*)::int from survey_responses r
          where r.respondent_id is not null
            and not exists (select 1 from "user" u where u."id" = r.respondent_id)) as response_orphans
    `);
    const orphanCounts = orphanResult.rows[0] ?? {};
    assert.equal(Number(orphanCounts.publication_orphans ?? -1), 0, "publication identity orphans remain");
    assert.equal(Number(orphanCounts.survey_orphans ?? -1), 0, "survey identity orphans remain");
    assert.equal(Number(orphanCounts.response_orphans ?? -1), 0, "survey response identity orphans remain");

    await client.query("ROLLBACK");
    console.log(
      `[staging-db] OK — ${expected.length} migrations present; Better Auth ids/text relations/FKs validated; 0 identity orphans.`,
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the validation error.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[staging-db] validation failed:", error?.message || error);
  process.exit(1);
});
