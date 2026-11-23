/* Garde-fou SÉCURITÉ — session admin (audit 2026-11-14).

   POURQUOI CE TEST EXISTE
   Avant le correctif, `/api/admin-verify` posait le cookie de session admin
   (`optimus_admin`) INCONDITIONNELLEMENT dès que ADMIN_PASSWORD était
   configuré — y compris sur une réponse `{ valid: false }`. N'importe quel
   visiteur anonyme obtenait donc un cookie de session admin VALIDE avec un
   corps quelconque, et le garde serveur (`server/middleware/admin-guard.ts`)
   lui ouvrait toutes les pages /admin* : contournement complet de
   l'authentification du back-office.

   Le correctif : le cookie n'est posé QUE lorsque `valid === true`. Ce test
   statique verrouille les deux invariants :
     1. la pose du cookie est bien dans la branche `if (valid)` ;
     2. la lecture publique des publications ne fait plus `select *` (elle
        projetterait `created_by`, identifiant interne d'éditeur).
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("admin-verify ne pose le cookie de session QUE si le mot de passe est validé", () => {
  const source = read("src/routes/api.admin-verify.ts");
  const guardIndex = source.indexOf("if (valid) {");
  assert.notEqual(guardIndex, -1, "la branche conditionnelle `if (valid)` est absente");
  const cookieIndex = source.indexOf('headers["Set-Cookie"] = adminSessionCookie(');
  assert.notEqual(cookieIndex, -1, "la pose du cookie de session admin est absente");
  assert.ok(
    cookieIndex > guardIndex,
    "le cookie de session admin doit être posé à l'intérieur de `if (valid)`",
  );
  // Aucune seconde pose du cookie hors de la branche validée.
  assert.equal(
    source.indexOf('headers["Set-Cookie"] = adminSessionCookie(', cookieIndex + 1),
    -1,
    "une seconde pose du cookie existe hors de la branche validée",
  );
});

test("les lectures publiques des publications ne divulguent pas created_by", () => {
  for (const file of [
    "server/api/publications.ts",
    "server/api/publications/[slug].ts",
  ]) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /select\s+\*\s+from\s+publications/i,
      `${file} : la lecture publique ne doit pas faire select * (fuite de created_by)`,
    );
    assert.match(source, /PUBLIC_COLUMNS/, `${file} : projection de colonnes explicite absente`);
    assert.doesNotMatch(
      source.match(/const PUBLIC_COLUMNS =[\s\S]*?;/)?.[0] ?? "",
      /created_by/,
      `${file} : PUBLIC_COLUMNS ne doit pas contenir created_by`,
    );
  }
});
