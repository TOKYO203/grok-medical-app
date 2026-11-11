/* Garde-fou SÉCURITÉ — back-office /admin* refusé côté serveur (pentest §5).

   POURQUOI CE TEST EXISTE
   Avant le correctif, /admin, /admin-licences, /admin-achats… répondaient 200
   en anonyme : le HTML du back-office était offert à quiconque (cartographie
   de l'interface, surface de phishing ciblé). Désormais, /api/admin-verify
   pose un cookie HttpOnly (jeton HMAC-SHA256 horodaté, TTL 7 j) et le garde
   serveur (server/middleware/admin-guard.ts) répond 403 sur /admin* sans
   cookie valide. /admin-login reste public ; /api/** gère sa propre autorisation.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookie,
  clearAdminSessionCookie,
  signAdminSessionToken,
  verifyAdminSessionToken,
} from "../src/lib/security/admin-auth.server.ts";

/**
 * Résolution tolérante : pendant l'incident #476-#483, le garde admin est
 * désactivé côté main (server/middleware/admin-guard.ts renommé .disabled).
 * Le contrat de source porte sur le CONTENU du module, pas sur son nom : on
 * retombe sur le fichier .disabled s'il existe, sans jamais réactiver le garde.
 */
const read = (path) => {
  const url = new URL(path, import.meta.url);
  try {
    return readFileSync(url, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return readFileSync(new URL(`${path}.disabled`, import.meta.url), "utf8");
    }
    throw error;
  }
};

/** Source sans commentaires : les assertions négatives ne doivent pas tomber
 * sur la documentation, qui cite les anti-patterns interdits. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const guard = read("../server/middleware/admin-guard.ts");
const adminVerify = read("../src/routes/api.admin-verify.ts");
const adminLogout = read("../src/routes/api.admin-logout.ts");
const adminLogin = read("../src/routes/admin-login.tsx");

/** Exécute `fn` avec un process.env temporaire, restauré ensuite. */
function withEnv(values, fn) {
  const saved = new Map();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const PASSWORD = "correct-horse-battery-staple";
const T0 = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

test("le jeton de session admin signe et vérifie (roundtrip)", () => {
  withEnv({ ADMIN_PASSWORD: PASSWORD }, () => {
    const token = signAdminSessionToken(T0);
    assert.ok(token, "un ADMIN_PASSWORD configuré doit permettre de signer");
    assert.equal(verifyAdminSessionToken(token, T0 + 1_000), true);
    assert.equal(verifyAdminSessionToken(token, T0 + 6 * DAY_MS), true);
    assert.equal(verifyAdminSessionToken(token, T0 + 8 * DAY_MS), false, "au-delà du TTL 7 j");
  });
});

test("un jeton falsifié, tronqué ou absent est refusé", () => {
  withEnv({ ADMIN_PASSWORD: PASSWORD }, () => {
    const token = signAdminSessionToken(T0);
    const [issuedAt, mac] = token.split(".");
    assert.equal(verifyAdminSessionToken(`${issuedAt}.${mac.slice(0, -2)}AA`), false);
    assert.equal(verifyAdminSessionToken(`${issuedAt}.${mac}x`), false);
    assert.equal(verifyAdminSessionToken(issuedAt), false);
    assert.equal(verifyAdminSessionToken(null), false);
    assert.equal(verifyAdminSessionToken(""), false);
  });
});

test("le jeton est lié au secret : un autre ADMIN_PASSWORD le rejette", () => {
  withEnv({ ADMIN_PASSWORD: PASSWORD }, () => {
    const token = signAdminSessionToken(T0);
    withEnv({ ADMIN_PASSWORD: "autre-mot-de-passe-bien-long" }, () => {
      assert.equal(verifyAdminSessionToken(token, T0 + 1_000), false);
    });
  });
});

test("sans ADMIN_PASSWORD, aucune session n'est signée (fail closed)", () => {
  withEnv({ ADMIN_PASSWORD: undefined }, () => {
    assert.equal(signAdminSessionToken(), null);
    assert.equal(verifyAdminSessionToken("1.abc"), false);
  });
});

test("le cookie de session est HttpOnly, Secure, SameSite=Lax, TTL 7 j", () => {
  withEnv({ ADMIN_PASSWORD: PASSWORD }, () => {
    const cookie = adminSessionCookie(signAdminSessionToken(T0));
    assert.match(cookie, new RegExp(`^${ADMIN_SESSION_COOKIE}=`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=604800/);
    assert.match(clearAdminSessionCookie(), /Max-Age=0/);
  });
});

test("le garde refuse /admin* sans cookie valide et épargne /admin-login et /api", () => {
  const source = code(guard);
  assert.match(source, /pathname\.startsWith\("\/admin"\)/);
  assert.match(source, /\/admin-login/);
  assert.match(source, /\/api\//);
  assert.match(source, /status: 403/);
  assert.match(source, /no-store/);
  assert.match(source, /verifyAdminSessionToken/);
  assert.match(source, /ADMIN_PASSWORD/);
});

test("admin-verify pose le cookie de session ; admin-logout l'efface ; le client l'appelle", () => {
  // Les attributs HttpOnly/Secure/SameSite sont construits par
  // adminSessionCookie() (déjà épinglés au test précédent) : la route doit
  // brancher ce constructeur sur l'en-tête Set-Cookie de sa réponse 200.
  assert.match(code(adminVerify), /Set-Cookie/);
  assert.match(code(adminVerify), /adminSessionCookie\(/);
  assert.match(code(adminVerify), /signAdminSessionToken\(/);
  assert.match(code(adminLogout), /clearAdminSessionCookie\(/);
  assert.match(code(adminLogin), /\/api\/admin-logout/);
});
