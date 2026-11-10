#!/usr/bin/env node
/**
 * Orchestrateur du sous-ensemble « sécurité » des tests.
 *
 * Un test ne passe QUE si son processus sort en code 0 — pas d'exception tolérée
 * pour 255 ou pour une sortie bavarde : c'est exactement le genre de passe-droit
 * qui transforme une suite rouge en suite verte.
 *
 * Usage : node scripts/run-security-suite.mjs
 * Sortie : 0 si tout passe, 2 si au moins un test échoue.
 */
import { spawn } from "node:child_process";

const BIN = process.execPath;
const TESTS = [
  "scripts/secret-hygiene.test.mjs",
  "scripts/admin-auth-hardening.test.mjs",
  "scripts/security-regressions.test.mjs",
  "scripts/api-security.test.mjs",
  "scripts/security-hardening.test.mjs",
  "scripts/security-license.test.mjs",
  "scripts/content-assets-cache.test.mjs",
  "scripts/bundle-content.test.mjs",
  "scripts/content-risk-audit.mjs",
  "src/server/jwt.test.ts",
  "src/server/license-verify.test.ts",
  "src/server/replay-guard.test.ts",
];

function runFile(file) {
  const args = file.endsWith(".ts")
    ? ["--test", "--test-timeout=20000", file]
    : ["--test", file];
  return new Promise((resolve) => {
    const child = spawn(BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (out += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (err += chunk));
    child.on("error", (error) => {
      resolve({ file, code: 1, out, err: `${err}\n${error.message}` });
    });
    child.on("close", (code) => resolve({ file, code: code ?? 1, out, err }));
  });
}

const results = [];
for (const file of TESTS) results.push(await runFile(file));

const failed = results.filter((r) => r.code !== 0);

console.log("===== SECURITY SUITE =====");
for (const r of results) {
  console.log(`[${r.code === 0 ? "PASS" : "FAIL"}] ${r.file} (exit ${r.code})`);
  if (r.code !== 0) {
    console.log("STDOUT:", r.out.trim().slice(0, 800));
    console.log("STDERR:", r.err.trim().slice(0, 800));
  }
}
console.log("==========================");

if (failed.length > 0) {
  console.log(`${failed.length}/${results.length} test(s) en échec.`);
  process.exitCode = 2;
} else {
  console.log(`${results.length}/${results.length} test(s) passés.`);
}
