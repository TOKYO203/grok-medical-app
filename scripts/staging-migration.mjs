import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { migrationPathsForAuth, pendingMigrations } from "./migration-plan.mjs";
import { validateIdentitySchema } from "./validate-staging-db.mjs";

// All target properties are independently configured in the staging environment.
export function stagingConfig(env) {
  assert.equal(env.DB_VALIDATION_TARGET, "staging", "staging target required");
  assert.equal(env.STAGING_CONFIRMATION, "STAGING", "confirmation required");
  assert.equal(env.GITHUB_REF, "refs/heads/release/v1-hardening", "release branch required");
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/, "commit SHA required");
  let url;
  try {
    url = new URL(env.STAGING_DATABASE_URL);
  } catch {
    throw new Error("invalid staging URL");
  }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "PostgreSQL required");
  assert.match(url.hostname, /^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/, "Neon endpoint required");
  assert.ok(
    !url.hostname.split(".")[0].endsWith("-pooler"),
    "direct endpoint required for session locks",
  );
  assert.equal(url.hostname, env.STAGING_EXPECTED_HOST, "unexpected staging host");
  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    env.STAGING_EXPECTED_DATABASE,
    "unexpected database",
  );
  assert.equal(decodeURIComponent(url.username), env.STAGING_EXPECTED_ROLE, "unexpected role");
  assert.ok(
    env.STAGING_EXPECTED_DATABASE && env.STAGING_EXPECTED_ROLE && url.password,
    "target credentials required",
  );
  assert.ok(!url.hash && (!url.port || url.port === "5432"), "unexpected URL endpoint options");
  for (const [key, value] of url.searchParams) {
    assert.ok(key === "sslmode" && value === "verify-full", "only sslmode=verify-full permitted");
  }
  assert.equal(url.searchParams.get("sslmode"), "verify-full", "verified TLS required");
  const maxOrphans = env.STAGING_MAX_ORPHANS ?? "0";
  assert.match(maxOrphans, /^(0|[1-9][0-9]*)$/, "invalid orphan budget");
  assert.ok(Number.isSafeInteger(Number(maxOrphans)), "invalid orphan budget");
  return {
    connectionString: url.href,
    database: env.STAGING_EXPECTED_DATABASE,
    role: env.STAGING_EXPECTED_ROLE,
    maxOrphans: Number(maxOrphans),
    sha: env.GITHUB_SHA,
  };
}

export async function loadMigrations() {
  const root = new URL("../migrations/", import.meta.url);
  const paths = migrationPathsForAuth(
    await readdir(root),
    (await readdir(new URL("auth/", root))).map((name) => `auth/${name}`),
    true,
  );
  return Promise.all(
    pendingMigrations(paths, []).map(async ({ name, path }) => {
      const sql = await readFile(new URL(path, root), "utf8");
      return { name, sql, sha256: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

const identityTables = [
  ["publications", "created_by"],
  ["surveys", "created_by"],
  ["survey_responses", "respondent_id"],
];

// Caller owns BEGIN/COMMIT/ROLLBACK. No row content leaves this connection.
export async function proveMigration(
  client,
  migrations,
  { maxOrphans = 0, onPreflight = () => {} } = {},
) {
  await client.query("SET LOCAL search_path TO public, pg_temp");
  const tables = (
    await client.query(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    )
  ).rows;
  for (const { tablename } of tables) {
    await client.query(
      `LOCK TABLE public."${tablename.replaceAll('"', '""')}" IN ACCESS EXCLUSIVE MODE`,
    );
  }
  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = (await client.query("select name from _migrations order by name")).rows.map(
    (row) => row.name,
  );
  assert.ok(
    applied.every((name) => migrations.some((m) => m.name === name)),
    "unknown applied migration; review required",
  );
  const pending = migrations.filter((m) => !applied.includes(m.name));
  const clearsOrphans = pending.some((m) => m.name === "0013_user_identity_foreign_keys.sql");
  const existing = new Set(tables.map((t) => t.tablename));
  const before = [];
  let totalOrphans = 0;
  for (const [table, column] of identityTables) {
    if (!existing.has(table)) continue;
    const orphan = existing.has("user")
      ? `t.${column} is not null and not exists (select 1 from "user" u where u.id = t.${column}::text)`
      : `t.${column} is not null`;
    const { rows } = await client.query(
      `select count(*)::int as rows, count(*) filter (where ${orphan})::int as orphans from ${table} t`,
    );
    totalOrphans += rows[0].orphans;
    before.push({ table, ...rows[0] });
    const expectedIdentity = clearsOrphans
      ? `case when ${orphan} then null else t.${column}::text end`
      : `t.${column}::text`;
    await client.query(`CREATE TEMP TABLE evidence_${table} ON COMMIT DROP AS
      select (to_jsonb(t) - '${column}') || jsonb_build_object('${column}', ${expectedIdentity}) as value from ${table} t`);
  }
  onPreflight({ before, totalOrphans, orphanBudget: maxOrphans });
  assert.ok(totalOrphans <= maxOrphans, "orphan budget exceeded; no migrations applied");
  for (const migration of pending) {
    await client.query(migration.sql);
    await client.query("insert into _migrations (name) values ($1)", [migration.name]);
  }
  const schema = await validateIdentitySchema(client);
  for (const { table } of before) {
    const result = await client.query(`select exists (
      (select value from evidence_${table} EXCEPT ALL select to_jsonb(t) from ${table} t)
      UNION ALL
      (select to_jsonb(t) from ${table} t EXCEPT ALL select value from evidence_${table})
    ) as changed`);
    assert.equal(
      result.rows[0].changed,
      false,
      `${table}: unexpected data change; rollback required`,
    );
  }
  return {
    scenario: before.length ? "existing-database" : "empty-database",
    before,
    orphanReferencesCleared: clearsOrphans ? totalOrphans : 0,
    dataPreserved: true,
    ...schema,
    appliedBefore: applied,
    migrationsApplied: pending.map(({ name, sha256 }) => ({ name, sha256 })),
    manifest: migrations.map(({ name, sha256 }) => ({ name, sha256 })),
  };
}
