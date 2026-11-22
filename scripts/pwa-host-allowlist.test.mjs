/* Garde-fou SÉCURITÉ — x-forwarded-host (audit 2026-11-21).

   POURQUOI CE TEST EXISTE
   server/middleware/grok-pwa.ts utilisait x-forwarded-host sans validation
   pour construire les URL du manifest web et des balises OG injectées dans le
   HTML : un appelant pouvait forgery `start_url`/`scope` vers un domaine
   tiers (phishing de prévisualisation, manifest déporté). Le correctif impose
   un allowlist (Host de la requête, VITE_PUBLIC_HOSTNAME, GROK_GATE_ORIGIN).
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(ROOT, "server/middleware/grok-pwa.ts"), "utf8");

test("requestHost n'utilise x-forwarded-host QUE via un allowlist", () => {
  assert.match(source, /function allowedHosts/, "fonction allowedHosts absente");
  assert.doesNotMatch(
    source,
    /return \(\s*event\.req\.headers\.get\("x-forwarded-host"\) \?\?/,
    "x-forwarded-host est encore utilisé sans validation",
  );
  assert.match(
    source,
    /allowedHosts\(event\)\.has\(forwarded\.toLowerCase\(\)\)/,
    "la validation de x-forwarded-host contre l'allowlist est absente",
  );
  assert.match(source, /VITE_PUBLIC_HOSTNAME/, "VITE_PUBLIC_HOSTNAME absent de l'allowlist");
  assert.match(source, /GROK_GATE_ORIGIN/, "GROK_GATE_ORIGIN absent de l'allowlist");
});

test("le cookie de session admin n'utilise plus SameSite=Lax", () => {
  const adm = readFileSync(join(ROOT, "src/lib/security/admin-auth.server.ts"), "utf8");
  assert.match(adm, /SameSite=Strict/, "cookie admin : SameSite=Strict absent");
  assert.doesNotMatch(adm, /SameSite=Lax/, "cookie admin : SameSite=Lax encore présent");
});
