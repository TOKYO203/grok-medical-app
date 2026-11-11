#!/usr/bin/env node
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// Le mot de passe est lu, par ordre de préférence :
//   1. l'argument CLI (compatibilité) — visible dans `ps`, à éviter ;
//   2. la variable d'environnement ADMIN_PASSWORD ;
//   3. l'entrée standard (recommandé : `printf '%s' "$PWD_SECRET" | node scripts/set-admin-password.mjs`).
// Audit 2026-11 (faille F7) : ne plus imposer le passage par argv.
async function resolvePassword() {
  if (process.argv[2]) return process.argv[2];
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  return undefined;
}

const password = await resolvePassword();
if (!password || password.length < 8) {
  console.error(
    "Usage: node scripts/set-admin-password.mjs <password-min-8>\n" +
      "   ou: ADMIN_PASSWORD=… node scripts/set-admin-password.mjs\n" +
      "   ou: printf '%s' "$SECRET" | node scripts/set-admin-password.mjs",
  );
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

// TLS est activé uniquement pour les hôtes Supabase gérés, décidé sur le
// HOSTNAME PARSÉ — jamais sur une sous-chaîne de l'URL brute, qu'une URL
// contrôlée par un attaquant pourrait placer n'importe où (identifiants,
// query, domaine lookalike). Signalement CodeQL « incomplete URL substring
// sanitization » corrige en conséquence.
const dbHostname = (() => {
  try {
    return new URL(dbUrl).hostname;
  } catch {
    return "";
  }
})();
const isManagedSupabase =
  dbHostname.endsWith(".pooler.supabase.com") ||
  dbHostname.endsWith(".supabase.co") ||
  dbHostname === "pooler.supabase.com" ||
  dbHostname === "supabase.co";

const client = new pg.Client({
  connectionString: dbUrl,
  // Kept as an explicit opt-out variable only: silently disabling certificate
  // validation let a network attacker read or rewrite the admin password hash
  // in flight. Validation is on by default; PSQL_INSECURE_TLS=1 is the
  // deliberate escape hatch for a self-signed local database.
  ssl: isManagedSupabase
    ? { rejectUnauthorized: process.env.PSQL_INSECURE_TLS !== "1" }
    : undefined,
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
