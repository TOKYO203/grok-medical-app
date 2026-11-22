/* Garde-fou SÉCURITÉ — CSP par hash + révocation admin (audit 2026-11-21).

   1. server/middleware/security-headers.ts calcule la CSP script-src par
      hash des scripts inline réellement servis (production) et n'active
      plus jamais 'unsafe-inline' en production.
   2. src/lib/security/admin-auth.server.ts doit vérifier la borne
      ADMIN_SESSION_NOT_BEFORE avant d'accepter un jeton de session.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("la CSP de production interdit les scripts inline hors allowlist", () => {
  const sh = read("server/middleware/security-headers.ts");
  assert.match(sh, /inlineScriptHashes/, "calcul des hash de scripts inline absent");
  assert.match(sh, /contentSecurityPolicy\(scriptSrc\(/, "CSP par réponse non branchée");
  assert.doesNotMatch(sh, /scriptSrc\(\): string/, "ancienne fonction figée encore présente");
  assert.match(sh, /if \(!isProduction\(\)\) sources\.push\("'unsafe-inline'"\)/,
    "'unsafe-inline' doit être conditionné hors production");
});

test("les jetons de session admin révoqués sont refusés", () => {
  const adm = read("src/lib/security/admin-auth.server.ts");
  assert.match(adm, /ADMIN_SESSION_NOT_BEFORE/, "variable de révocation absente");
  assert.match(adm, /issuedAt < adminSessionNotBefore\(\)\) return false/, "refus avant borne non appliqué");
});
