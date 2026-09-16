#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrationName, migrationPathsForAuth, pendingMigrations } from "./migration-plan.mjs";

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

export async function validateIdentitySchema(client) {
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
  assert.equal(
    identityColumns.rows.length,
    expectedIdentityColumns.size,
    "identity columns are missing",
  );
  for (const row of identityColumns.rows) {
    const key = `${row.table_name}.${row.column_name}`;
    assert.equal(row.data_type, expectedIdentityColumns.get(key), `${key} must be text`);
  }

  const fkResult = await client.query(
    `
      select c.conname, c.convalidated,
             c.conrelid::regclass::text as source_table,
             c.confrelid::regclass::text as target_table,
             c.contype, c.confdeltype,
             (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(num, ord)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num) as source_columns,
             (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(num, ord)
               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.num) as target_columns
        from pg_constraint c
       where conname = any($1::text[])
       order by conname
    `,
    [[...expectedForeignKeys]],
  );
  assert.equal(
    fkResult.rows.length,
    expectedForeignKeys.size,
    "one or more identity foreign keys are missing",
  );
  for (const row of fkResult.rows) {
    assert.equal(row.convalidated, true, `${row.conname} must be validated`);
    const columns = {
      publications_created_by_auth_user_fk: ["publications", "created_by"],
      surveys_created_by_auth_user_fk: ["surveys", "created_by"],
      survey_responses_respondent_auth_user_fk: ["survey_responses", "respondent_id"],
    };
    const [table, column] = columns[row.conname];
    assert.equal(row.source_table, table);
    assert.equal(row.target_table, '"user"');
    assert.equal(row.contype, "f");
    assert.equal(row.confdeltype, "n");
    assert.deepEqual(row.source_columns, [column]);
    assert.deepEqual(row.target_columns, ["id"]);
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
  assert.equal(
    Number(orphanCounts.publication_orphans ?? -1),
    0,
    "publication identity orphans remain",
  );
  assert.equal(Number(orphanCounts.survey_orphans ?? -1), 0, "survey identity orphans remain");
  assert.equal(
    Number(orphanCounts.response_orphans ?? -1),
    0,
    "survey response identity orphans remain",
  );

  return { migrationCount: expected.length, identityOrphans: 0 };
}

async function main() {
  const databaseUrl = process.env.STAGING_DATABASE_URL?.trim();
  if (!databaseUrl || process.env.DB_VALIDATION_TARGET !== "staging") {
    throw new Error("STAGING_DATABASE_URL and DB_VALIDATION_TARGET=staging required");
  }
  const parsedUrl = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(parsedUrl.protocol), "PostgreSQL URL required");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL search_path TO public, pg_temp");
      await validateIdentitySchema(client);
      console.log("[staging-db] identity schema validated");
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    console.error("[staging-db] validation failed; database details suppressed");
    process.exitCode = 1;
  });
}
