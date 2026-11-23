/**
 * Garde-fou SÉCURITÉ — vérification PBKDF2 du mot de passe admin (audit 2026-11-16).
 *
 * /api/admin-verify accepte un hash PBKDF2 stocké dans `admin_config`. Avant le
 * correctif, la vérification tolérait N'IMPORTE quel nombre d'itérations (>= 1)
 * et n'importe quel nom d'algorithme — y compris SHA-1 : un hash dégradé ou
 * malformé en base aurait été validé sans bruit. Le contrat est désormais :
 *   - algorithmes limités à SHA-256 / SHA-384 / SHA-512 ;
 *   - plancher d'itérations ≥ 100 000 (OWASP ; le générateur écrit 210 000) ;
 *   - tout écart => refus (fail closed), sans oracle côté client.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(
  fileURLToPath(new URL("../src/routes/api.admin-verify.ts", import.meta.url)),
  "utf8",
);

/** Source sans commentaires : les interdits sont souvent cités en documentation. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("la vérification PBKDF2 impose un plancher d'itérations", () => {
  assert.match(code, /MIN_PBKDF2_ITERATIONS\s*=\s*100_000/);
  assert.match(code, /iterations\s*<\s*MIN_PBKDF2_ITERATIONS/);
  // L'ancien test `iterations < 1` ne doit plus exister.
  assert.doesNotMatch(code, /iterations\s*<\s*1\b/);
});

test("la vérification PBKDF2 refuse SHA-1 et tout algorithme hors liste", () => {
  assert.match(code, /ALLOWED_PBKDF2_HASHES/);
  assert.doesNotMatch(code, /sha1/i, "SHA-1 ne doit plus être accepté");
  assert.doesNotMatch(code, /hashName\)\s*:\s*hashName/, "plus de pass-through de l'algo reçu");
});

test("le générateur de hash reste aligné sur le vérificateur", () => {
  const generator = readFileSync(
    fileURLToPath(new URL("../scripts/set-admin-password.mjs", import.meta.url)),
    "utf8",
  );
  assert.match(generator, /ITERATIONS\s*=\s*\d{6,}/, "le générateur doit dépasser le plancher");
  assert.match(generator, /sha256/);
});
