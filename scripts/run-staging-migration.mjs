#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { stagingConfig, loadMigrations, proveMigration } from "./staging-migration.mjs";

const output = new URL("../artifacts/staging-migration.json", import.meta.url);
const report = { schemaVersion: 1, status: "failed", committed: false };
try {
  assert.ok(
    process.argv.slice(2).every((arg) => arg === "--apply"),
    "unknown option",
  );
  report.phase = "target-guard";
  const config = stagingConfig(process.env);
  const apply = process.argv.includes("--apply");
  Object.assign(report, {
    commit: config.sha,
    mode: apply ? "apply" : "rehearsal",
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  });
  const migrations = await loadMigrations();
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 60000,
  });
  try {
    report.phase = "connect";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      const identity = (await client.query("select current_database() as db, current_user as role"))
        .rows[0];
      assert.equal(identity.db, config.database, "connected database mismatch");
      assert.equal(identity.role, config.role, "connected role mismatch");
      const lock = await client.query("select pg_try_advisory_xact_lock(781241617) as acquired");
      assert.equal(lock.rows[0].acquired, true, "another staging validation is running");
      report.phase = "migration-and-preservation";
      Object.assign(
        report,
        await proveMigration(client, migrations, {
          ...config,
          onPreflight: (evidence) => Object.assign(report, { preflight: evidence }),
        }),
      );
      report.phase = "transaction-finish";
      await client.query(apply ? "COMMIT" : "ROLLBACK");
      report.committed = apply;
      report.status = "passed";
      report.phase = "complete";
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error("staging validation failed");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
} catch {
  // Database errors can contain row values, identifiers or credentials.
  report.status = "failed";
  console.error(
    "[staging-db] Failed. Check target configuration, orphan budget and migration compatibility. Database details suppressed.",
  );
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[staging-db] ${report.status}; committed=${report.committed}`);
}
