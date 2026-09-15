#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every configured deploy — applying pending
 * app migrations from ../migrations to DATABASE_URL. When authentication is
 * enabled it also applies ../migrations/auth so Neon and the PGLite fallback use
 * the same Better Auth schema. Each file is applied in one transaction and
 * recorded by basename in `_migrations`, so copied legacy auth migrations do not
 * run twice.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same applicable files at startup (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { migrationPathsForAuth, pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const authMigrationsDir = join(migrationsDir, "auth");
const authEnabled = process.env.VITE_AUTH_ENABLED !== "false";

async function readEntries(dir) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const rootEntries = await readEntries(migrationsDir);
  const authEntries = authEnabled
    ? (await readEntries(authMigrationsDir)).map((name) => `auth/${name}`)
    : [];
  const migrationPaths = migrationPathsForAuth(rootEntries, authEntries, authEnabled);

  // An app with no applicable schema of its own must not pay for a database connection.
  if (pendingMigrations(migrationPaths, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name, path } of pendingMigrations(migrationPaths, applied)) {
      const text = await readFile(join(migrationsDir, path), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
