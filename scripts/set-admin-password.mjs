#!/usr/bin/env node
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Usage: node scripts/set-admin-password.mjs <password-min-8>");
  process.exit(1);
}

const ITERATIONS = 210000;
const HASH_BYTES = 32;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, "sha256");
const stored = "pbkdf2$sha256$" + ITERATIONS + "$" + salt.toString("base64") + "$" + hash.toString("base64");

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) {
      const env = readFileSync(f, "utf8");
      for (const line of env.split("\n")) {
        const m = line.match(/^DATABASE_URL=(.+)$/);
        if (m) { dbUrl = m[1].trim().replace(/^["']|["']$/g, ""); break; }
      }
    }
    if (dbUrl) break;
  }
}
if (!dbUrl) { console.error("DATABASE_URL introuvable"); process.exit(1); }

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

await client.query(
  "CREATE TABLE IF NOT EXISTS admin_config (" +
  "key TEXT PRIMARY KEY, " +
  "value TEXT NOT NULL, " +
  "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
);

await client.query(
  "INSERT INTO admin_config (key, value, updated_at) " +
  "VALUES ('admin_password_hash', $1, NOW()) " +
  "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
  [stored]
);

await client.end();

console.log("OK hash insere");
console.log("Prefixe: " + stored.slice(0, 50) + "...");
