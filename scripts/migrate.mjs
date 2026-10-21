#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every configured deploy — applying pending
 * app migrations from ../migrations to DATABASE_URL. When authentication is
 * enabled it also applies ../migrations/auth so Supabase and the PGLite fallback use
 * the same Better Auth schema. Each file is applied in one transaction and
 * recorded by basename in `_migrations`, so copied legacy auth migrations do not
 * run twice.
 *
 * No DATABASE_URL anywhere (local / preview builds) -> skip; the PGLite fallback
 * applies the same applicable files at startup (see src/lib/db.ts).
 *
 * ⚠️ DATABASE_URL is read from `.env.local` too, not just from the process.
 * `vite.config.ts` injects non-`VITE_` variables from `.env.local` into
 * `process.env` for the SERVER at runtime, so a workspace with
 * `DATABASE_URL=postgres://…` runs on that Postgres — while this script, being
 * a plain node process, used to see nothing and print "skipping". Migrations
 * were therefore never applied to the database the app actually used: the
 * schema silently lagged behind, and the symptom was a runtime
 * `relation "…" does not exist` long after a green build. Reading the same
 * files here removes that divergence.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { migrationPathsForAuth, pendingMigrations } from "./migration-plan.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Minimal `.env` reader (no dependency, no interpolation).
 *
 * Deliberately dumb: values are taken VERBATIM after the first `=` (a DSN may
 * contain `%`, `@`, `#`, quotes or `$`), comments and blank lines are dropped,
 * and matching surrounding quotes are stripped. `${VAR}` interpolation is NOT
 * performed — a connection string is data, not a template.
 *
 * @param {string} text
 * @returns {Array<[string, string]>}
 */
export function parseEnvFile(text) {
  const entries = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1);
    if (quoted) value = value.slice(1, -1);
    entries.push([key, value]);
  }
  return entries;
}

/**
 * `.env.local` is NOT loaded here on purpose: the platform injects production
 * credentials into the process, and a checked-out `.env.local` must never
 * override them. Precedence: process env first, then local files.
 */
if (!process.env.DATABASE_URL?.trim()) {
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = await readFile(join(projectRoot, file), "utf8");
    } catch {
      continue; // fichier absent : ce n'est pas une erreur
    }
    for (const [key, value] of parseEnvFile(text)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    if (process.env.DATABASE_URL?.trim()) {
      console.log(`[migrate] DATABASE_URL lu depuis ${file}`);
      break;
    }
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(projectRoot, "migrations");
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
