/**
 * Garde-fou du contrôle d'encaissement (`scripts/payment-readiness.mjs`).
 *
 * Un script d'exploitation qui affiche une clé API dans un terminal finit dans un
 * ticket de support, un screenshot ou un log de CI. On vérifie donc que la sortie
 * ne contient JAMAIS la valeur d'un secret — y compris la clé `anon`, pourtant
 * publique, parce qu'un log se partage et qu'une confusion coûte cher.
 *
 * Le script est exécuté avec de FAUX secrets et une base injoignable : aucune
 * requête Lemon Squeezy réelle n'est émise avec une clé bidon (l'API répondra
 * 401, ce que le script tolère), et aucune écriture n'est possible.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const FAKE = {
  LEMONSQUEEZY_API_KEY: "lemonsqueezy_test_SECRET_A_NE_PAS_AFFICHER_0123456789",
  LEMONSQUEEZY_WEBHOOK_SECRET: "whsec_A_NE_PAS_AFFICHER_9876543210",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_A_NE_PAS_AFFICHER_abcdefghij",
  VITE_SUPABASE_ANON_KEY: "anon_A_NE_PAS_AFFICHER_zyxwvutsrq",
  VITE_SUPABASE_URL: "https://exemple.supabase.co",
  VITE_LEMONSQUEEZY_STORE_SLUG: "exemple-store",
  VITE_LEMONSQUEEZY_VARIANT_ID: "00000000-0000-0000-0000-000000000000",
  // Port fermé : le script doit dégrader proprement, pas planter.
  DATABASE_URL: "postgres://u:p@127.0.0.1:1/base",
};

function run(args = []) {
  const res = spawnSync(process.execPath, ["scripts/payment-readiness.mjs", ...args], {
    encoding: "utf8",
    timeout: 120_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...FAKE,
    },
  });
  return { code: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

test("payment-readiness : n'affiche aucun secret", () => {
  const { stdout, stderr } = run();
  const output = `${stdout}\n${stderr}`;
  for (const [name, value] of Object.entries(FAKE)) {
    if (name === "DATABASE_URL" || name.startsWith("VITE_SUPABASE_URL")) continue;
    assert.ok(!output.includes(value), `${name} apparaît en clair dans la sortie`);
  }
  // Le résumé (longueur + empreinte) doit, lui, être présent : sans lui l'opérateur
  // ne peut pas distinguer « variable absente » de « variable de remplissage ».
  assert.match(stdout, /sha [0-9a-f]{8}/);
  assert.match(stdout, /encaissement : (READY|BLOQUÉ|PRÊT SOUS RÉSERVE)/);
});

test("payment-readiness : signale les variables de remplissage", () => {
  const res = spawnSync(process.execPath, ["scripts/payment-readiness.mjs"], {
    encoding: "utf8",
    timeout: 120_000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, LEMONSQUEEZY_API_KEY: "COLLE_TON_API_KEY" },
  });
  assert.match(res.stdout ?? "", /valeur de remplissage/);
});

test("payment-readiness : --json est machine-lisible et sans secret", () => {
  const { stdout } = run(["--json"]);
  const start = stdout.indexOf("{");
  assert.ok(start >= 0, "aucun JSON émis");
  const payload = JSON.parse(stdout.slice(start));
  assert.ok(Array.isArray(payload.checks) && payload.checks.length > 5);
  assert.ok(["READY", "BLOQUÉ", "PRÊT SOUS RÉSERVE"].includes(payload.verdict));
  for (const c of payload.checks) {
    assert.equal(typeof c.id, "string");
    assert.ok(["ok", "warn", "fail", "skip"].includes(c.status));
  }
  assert.ok(!stdout.includes(FAKE.LEMONSQUEEZY_API_KEY));
});
