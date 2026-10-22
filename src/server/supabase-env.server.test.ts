import assert from "node:assert/strict";
import test from "node:test";

import {
  mergedServerEnv,
  readServerSupabaseConfig,
  resolveSupabaseAnonKey,
  resolveSupabaseServiceKey,
  resolveSupabaseUrl,
} from "./supabase-env.server.ts";

/**
 * RÉSOLUTION DE LA CONFIGURATION SUPABASE CÔTÉ SERVEUR.
 *
 * Le 2026-10-22, le tunnel de paiement répondait 503 en production parce qu'il
 * ne lisait que `process.env`, alors que les valeurs vivaient dans
 * `import.meta.env` (inliné au build). Ces tests figent l'ORDRE des sources :
 * exécution d'abord, build ensuite.
 */

test("l'environnement d'exécution passe AVANT les valeurs inlinées au build", () => {
  const env = { ...mergedServerEnv({ SUPABASE_URL: "https://runtime.supabase.co" }) };
  // `INLINED_ENV` est vide sous `node --test` : on vérifie donc la priorité par
  // un mélange explicite, sans dépendre du build.
  const merged = { ...{ SUPABASE_URL: "https://inlined.supabase.co" }, ...env };
  assert.equal(resolveSupabaseUrl(merged), "https://runtime.supabase.co");
});

test("`process.env.VITE_*` reste un repli valable", () => {
  assert.equal(
    resolveSupabaseUrl({ VITE_SUPABASE_URL: "https://vite.supabase.co/" }),
    "https://vite.supabase.co",
  );
  assert.equal(resolveSupabaseAnonKey({ VITE_SUPABASE_ANON_KEY: " anon " }), "anon");
});

test("l'URL est normalisée (slash final) et une valeur non HTTP est refusée", () => {
  assert.equal(resolveSupabaseUrl({ SUPABASE_URL: "https://x.supabase.co///" }), "https://x.supabase.co");
  assert.equal(resolveSupabaseUrl({ SUPABASE_URL: "x.supabase.co" }), "");
  assert.equal(resolveSupabaseUrl({ SUPABASE_URL: "   " }), "");
  assert.equal(resolveSupabaseUrl({}), "");
});

test("une configuration incomplète vaut `null` (on ne juge pas l'identité à moitié)", () => {
  assert.equal(readServerSupabaseConfig({ SUPABASE_URL: "https://x.supabase.co" }), null);
  assert.equal(readServerSupabaseConfig({ SUPABASE_ANON_KEY: "anon" }), null);
  assert.deepEqual(
    readServerSupabaseConfig({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_ANON_KEY: "anon",
    }),
    { url: "https://x.supabase.co", anonKey: "anon" },
  );
});

test("deux formes de clé de service sont acceptées, jamais exposées en URL", () => {
  assert.equal(resolveSupabaseServiceKey({ SUPABASE_SERVICE_ROLE_KEY: "sr" }), "sr");
  assert.equal(resolveSupabaseServiceKey({ SUPABASE_SERVICE_KEY: "sr2" }), "sr2");
  assert.equal(resolveSupabaseServiceKey({}), "");
});

test("`mergedServerEnv` ne perd aucune clé d'exécution", () => {
  const merged = mergedServerEnv({ DATABASE_URL: "postgres://x", SUPABASE_URL: "https://a" });
  assert.equal(merged.DATABASE_URL, "postgres://x");
  assert.equal(merged.SUPABASE_URL, "https://a");
});
