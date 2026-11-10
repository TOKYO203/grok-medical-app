/* Garde-fou SÉCURITÉ — cookie de session posé par le serveur (pentest §4).

   POURQUOI CE TEST EXISTE
   Avant le correctif, `session.ts` écrivait le cookie `optimus_session` via
   `document.cookie` : un cookie non HttpOnly, lisible (et modifiable) par
   n'importe quel script exécuté dans la page. Désormais, seuls les endpoints
   serveur qui émettent le jeton (`/api/licenses/verify`,
   `/api/licenses/session`, `/api/licenses/trial-token`) posent le cookie, en
   HttpOnly + Secure + SameSite=Lax, avec un Max-Age aligné sur le TTL du jeton.
   Le client n'écrit plus que `localStorage` (repli hors-ligne explicite) et
   envoie le jeton en en-tête `Authorization`.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("les endpoints de jeton posent un cookie de session HttpOnly", () => {
  for (const file of [
    "src/routes/api.licenses.verify.ts",
    "src/routes/api.licenses.session.ts",
    "src/routes/api.licenses.trial-token.ts",
  ]) {
    const source = read(file);
    assert.match(source, /Set-Cookie/, `${file} : en-tête Set-Cookie absent`);
    assert.match(source, /SameSite=Lax/, `${file} : SameSite=Lax absent`);
    assert.match(source, /HttpOnly/, `${file} : HttpOnly absent`);
    assert.match(source, /Secure/, `${file} : Secure absent`);
    assert.match(source, /Max-Age=/, `${file} : Max-Age absent`);
  }
});

test("le client n'écrit plus le cookie de session", () => {
  const session = read("src/lib/auth/session.ts");
  assert.doesNotMatch(
    session,
    /document\.cookie/,
    "session.ts ne doit plus écrire document.cookie : le cookie HttpOnly est posé par le serveur",
  );
});

test("le serveur lit toujours le jeton dans l'en-tête ou le cookie", () => {
  const sessionServer = read("src/lib/auth/session.server.ts");
  assert.match(sessionServer, /bearerTokenFromHeaders/);
  assert.match(sessionServer, /cookieValue\(request\.headers\.get\("cookie"\)/);
});
