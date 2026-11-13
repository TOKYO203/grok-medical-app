/* Garde-fou SÉCURITÉ — cookie de session admin (audit 2026-11-13).

   POURQUOI CE TEST EXISTE
   Avant le correctif, /api/admin-verify posait le cookie de session admin
   (optimus_admin, HMAC valide) MÊME lorsque le mot de passe était erroné.
   Le garde serveur (server/middleware/admin-guard.ts) n'inspecte que ce
   cookie : un attaquant anonyme obtenait donc une session admin valide en
   envoyant n'importe quel mot de passe, et accédait aux pages /admin*.
   Désormais, le cookie n'est posé que lorsque valid est true.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("admin-verify ne pose le cookie de session que si le mot de passe est valide", () => {
  const source = read("src/routes/api.admin-verify.ts");

  const validIdx = source.indexOf("const valid =");
  const guardIdx = source.indexOf("if (!valid)");
  const signIdx = source.indexOf("signAdminSessionToken()");

  assert.ok(validIdx !== -1, "calcul de valid introuvable");
  assert.ok(guardIdx !== -1, "garde if (!valid) absent : le cookie serait posé même en cas d'échec");
  assert.ok(signIdx !== -1, "signature de session introuvable");
  assert.ok(
    validIdx < guardIdx && guardIdx < signIdx,
    "ordre invalide : la signature de session doit intervenir APRÈS le refus if (!valid)",
  );

  // Le bloc de refus doit retourner une réponse sans Set-Cookie.
  const refusalBlock = source.slice(guardIdx, signIdx);
  assert.match(refusalBlock, /return new Response/, "le refus doit retourner une réponse immédiatement");
  assert.doesNotMatch(refusalBlock, /Set-Cookie/, "le refus ne doit pas poser de cookie de session");
});
