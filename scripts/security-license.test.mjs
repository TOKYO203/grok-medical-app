/* Garde-fou SÉCURITÉ du contenu Premium (session S1).

   POURQUOI CE TEST EXISTE
   Avant S1, les 133 fiches (110 signes + 23 nosographie) étaient des actifs
   statiques publics : `curl https://…/content/pathologies/paludisme.json`
   répondait 200 à qui connaissait l'URL. Le verrouillage Premium côté React ne
   protégeait rien — il masquait un contenu déjà téléchargé.

   La sécurité repose désormais sur une CHAÎNE, et une chaîne se rompt au
   premier maillon faible :
     clé de licence signée (Ed25519, clé publique seule côté serveur)
       → POST /api/licenses/verify (quota 10/h + nonce anti-replay)
         → JWT HS256 24 h (LICENSE_JWT_SECRET, serveur uniquement)
           → /content/$type/$file (jeton exigé, cache privé)
             → private/content/** (hors dossier publié)

   Ce test verrouille chaque maillon SANS dépendre d'un serveur en marche.
   Les preuves d'exécution (401 / 200 / 401 expiré / 429 rejeu / 429 quota) sont
   dans docs/SECURITY-PREMIUM.md et rejouées par la QA CDP.
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

const verifyRoute = read("src/routes/api.licenses.verify.ts");
const contentRoute = read("src/routes/content.$type.$file.ts");
const guard = read("src/server/content-guard.ts");
const jwt = read("src/server/jwt.ts");
const nonce = read("src/server/replay-guard.ts");
const licenseVerify = read("src/server/license-verify.ts");
const session = read("src/lib/auth/session.ts");
const sessionServer = read("src/lib/auth/session.server.ts");
const assets = read("src/lib/content/protected-assets.server.ts");
const pathologyReader = read("src/lib/pathologies/asset-reader.server.ts");
const pathologyCatalog = read("src/lib/pathologies/catalog.ts");
const signesCatalog = read("src/lib/signes/catalog.ts");
const envExample = read(".env.example");

/* ------------------------------------------------------------------ */
/* 1. Émission du jeton                                                */
/* ------------------------------------------------------------------ */

test("l'endpoint de vérification est limité à 10 requêtes/heure par IP", () => {
  assert.match(verifyRoute, /const RATE_LIMIT_MAX = 10;/);
  assert.match(verifyRoute, /const RATE_LIMIT_WINDOW_MS = 60 \* 60 \* 1000;/);
  // Le quota est consommé AVANT lecture du corps : aucune tentative gratuite.
  const rateIndex = verifyRoute.indexOf("rateLimitRequest(");
  const bodyIndex = verifyRoute.indexOf("request.text()");
  assert.ok(rateIndex !== -1 && bodyIndex !== -1 && rateIndex < bodyIndex, "le quota doit précéder la lecture du corps");
});

test("le nonce anti-replay est exigé puis consommé avant toute vérification", () => {
  assert.match(verifyRoute, /request\.headers\.get\("x-nonce"\)/);
  assert.match(verifyRoute, /NONCE_PATTERN\.test\(nonce\)/);
  assert.match(verifyRoute, /consumeNonce\(nonce\)/);

  const nonceIndex = verifyRoute.indexOf("consumeNonce(nonce)");
  const verifyIndex = verifyRoute.indexOf("verifyLicenseKey(");
  assert.ok(nonceIndex !== -1 && verifyIndex !== -1 && nonceIndex < verifyIndex);

  // Rejeu = 429, panne du backend = 503 (fail closed, jamais d'ouverture).
  assert.match(verifyRoute, /json\(\{ error: "nonce_replayed" \}, 429\)/);
  assert.match(verifyRoute, /license_verification_unavailable" \}, 503\)/);
  assert.match(verifyRoute, /"Cache-Control": "no-store"/);
});

test("l'anti-replay est atomique, borné dans le temps et fail-closed", () => {
  // Redis : `SET … NX EX 300` en UNE requête — deux rejeux simultanés ne
  // peuvent pas réussir tous les deux (un `GET` puis `SET` ne le garantirait pas).
  assert.match(nonce, /NX&EX=\$\{NONCE_TTL_SECONDS\}/);
  assert.match(nonce, /cache: "no-store"/);
  // TTL borné : un nonce oublié ne doit pas rester éternellement en mémoire.
  assert.match(nonce, /NONCE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(nonce, /MAX_MEMORY_ENTRIES/);
  // Fail closed : une panne du backend refuse la demande, elle ne l'ouvre pas.
  assert.match(nonce, /return "unavailable";/);
  assert.doesNotMatch(nonce, /return "fresh";\s*\}\s*\} catch/, "une exception ne doit jamais valider un nonce");
});

test("la licence est vérifiée avec la clé PUBLIQUE seule", () => {
  assert.match(licenseVerify, /process\.env\.LICENSE_PUBLIC_KEY/);
  assert.match(licenseVerify, /crypto\.subtle\.verify\(\{ name: "Ed25519" \}/);
  // ⚠️ Aucune clé privée dans le chemin serveur.
  assert.doesNotMatch(
    licenseVerify,
    /LICENSE_SIGNING_PRIVATE_KEY/,
    "le vérificateur ne doit jamais lire la clé privée",
  );
  assert.doesNotMatch(licenseVerify, /createPrivateKey/);
});

test("un échec de licence répond 401 générique (anti-énumération)", () => {
  assert.match(verifyRoute, /json\(\{ error: "unauthorized" \}, 401\)/);
  assert.match(
    verifyRoute,
    /inconnue|anti-énumération/,
    "la raison de l'échec doit rester indifférenciée pour l'appelant",
  );
});

/* ------------------------------------------------------------------ */
/* 2. Jeton émis                                                       */
/* ------------------------------------------------------------------ */

test("le JWT est HS256, 24 h, avec un secret obligatoire d'au moins 32 caractères", () => {
  assert.match(jwt, /CONTENT_TOKEN_TTL_SECONDS = 24 \* 60 \* 60/);
  assert.match(jwt, /MIN_SECRET_LENGTH = 32/);
  assert.match(jwt, /alg: "HS256"/);
  assert.match(jwt, /LICENSE_JWT_SECRET/);
  // Aucune valeur par défaut : sans secret, la signature échoue volontairement.
  assert.doesNotMatch(jwt, /LICENSE_JWT_SECRET \?\? "[^"]+"/);
  assert.match(jwt, /algorithms: \["HS256"\]/, "l'algorithme doit être épinglé (pas de `alg: none`)");
});

/* ------------------------------------------------------------------ */
/* 3. Garde du contenu                                                 */
/* ------------------------------------------------------------------ */

test("la route de contenu authentifie AVANT de lire l'actif", () => {
  const authIndex = contentRoute.indexOf("const auth = await authenticate(request)");
  const readIndex = contentRoute.indexOf("readProtectedAsset(family, file)");
  assert.ok(authIndex !== -1, "la route doit appeler authenticate()");
  assert.ok(readIndex !== -1, "la route doit lire l'actif protégé");
  assert.ok(authIndex < readIndex, "la lecture doit être postérieure au contrôle");
  assert.match(contentRoute, /unauthorizedResponse\(\)/);
  assert.match(contentRoute, /contentUnavailableResponse\(\)/);
});

test("les aperçus publics ne divulguent aucun contenu rédigé", () => {
  assert.match(contentRoute, /type === "previews"/);
  // La projection ne reprend que titre / sous-titre / objectif / titres de sections.
  assert.match(contentRoute, /sectionTitles/);
  assert.doesNotMatch(
    contentRoute,
    /previewProjection[\s\S]{0,1200}flashcards/,
    "un aperçu ne doit jamais inclure les flashcards",
  );
});

test("le lecteur serveur des fiches est gardé (aucune porte dérobée via createServerFn)", () => {
  assert.match(pathologyReader, /authenticateCurrentRequest\(\)/);
  const authIndex = pathologyReader.indexOf("authenticateCurrentRequest()");
  const readIndex = pathologyReader.indexOf("readProtectedAsset(");
  assert.ok(authIndex < readIndex, "le contrôle doit précéder la lecture");
  assert.match(guard, /getRequest\(\)/);
  assert.match(guard, /"missing" \| "invalid" \| "unconfigured"/);
});

test("le garde répond 401 JSON et un cache privé", () => {
  assert.match(guard, /function unauthorizedResponse\(\): Response \{\s*return jsonResponse\(\{ error: "unauthorized" \}, 401\);/);
  assert.match(guard, /private, max-age=60/);
  assert.match(guard, /Vary: "Authorization, Cookie"/);
});

/* ------------------------------------------------------------------ */
/* 4. Stockage du contenu                                              */
/* ------------------------------------------------------------------ */

test("les fiches vivent HORS du dossier publié", () => {
  const pathologies = readdirSync(join(ROOT, "private/content/pathologies")).filter((name) =>
    name.endsWith(".json"),
  );
  const signes = readdirSync(join(ROOT, "private/content/signes")).filter((name) =>
    name.endsWith(".json"),
  );
  assert.ok(pathologies.length >= 20, `seulement ${pathologies.length} fiches de nosographie`);
  assert.ok(signes.length >= 100, `seulement ${signes.length} fiches « Signes »`);

  assert.equal(
    existsSync(join(ROOT, "public/content/pathologies")),
    false,
    "public/content/pathologies/ ne doit pas exister (contenu servi sans jeton)",
  );

  const publicSignes = existsSync(join(ROOT, "public/content/signes"))
    ? readdirSync(join(ROOT, "public/content/signes"))
    : [];
  assert.deepEqual(
    publicSignes.filter((name) => name !== "_index.json"),
    [],
    "seul le manifeste _index.json reste public sous public/content/signes/",
  );
});

test("la lecture des actifs privés est centralisée et serveur uniquement", () => {
  assert.match(assets, /import\.meta\.glob\("\/private\/content\/pathologies\/\*\.json"/);
  assert.match(assets, /import\.meta\.glob\("\/private\/content\/signes\/\*\.json"/);
  // `.server.ts` + import dynamique : jamais dans le graphe client.
  assert.match(pathologyReader, /readProtectedAsset\("pathologies"/);
  assert.doesNotMatch(pathologyCatalog, /protected-assets\.server/, "le catalogue client ne doit pas importer le store serveur");
  assert.doesNotMatch(signesCatalog, /protected-assets\.server/);
  assert.doesNotMatch(pathologyCatalog, /readFileSync|node:fs/);
});

/* ------------------------------------------------------------------ */
/* 5. Client                                                           */
/* ------------------------------------------------------------------ */

test("la session de contenu est stockée dans localStorage et envoyée en Bearer", () => {
  assert.match(session, /SESSION_STORAGE_KEY = "optimus_session"/);
  assert.match(session, /headers\.set\("authorization", `Bearer \$\{token\}`\)/);
  assert.match(session, /response\.status === 401 && token\) clearToken\(\)/);
  // Copie en cookie : indispensable au rendu serveur (localStorage y est absent).
  assert.match(session, /document\.cookie = `\$\{SESSION_COOKIE_NAME\}/);
  assert.match(session, /SameSite=Lax/);
});

test("le serveur lit le jeton dans l'en-tête ou dans le cookie, jamais ailleurs", () => {
  assert.match(sessionServer, /bearerTokenFromHeaders/);
  assert.match(sessionServer, /cookieValue\(request\.headers\.get\("cookie"\)/);
});

/* ------------------------------------------------------------------ */
/* 6. Secrets                                                          */
/* ------------------------------------------------------------------ */

test("aucun secret de licence ne peut atteindre le navigateur", () => {
  // La clé privée n'apparaît nulle part dans src/ (ni en clair, ni lue).
  const offenders = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(relative);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
      const source = readFileSync(join(ROOT, relative), "utf8");
      if (/LICENSE_SIGNING_PRIVATE_KEY/.test(source)) offenders.push(relative);
    }
  };
  walk("src");
  // Les routes `api.*` extraient leur handler serveur du bundle client : c'est
  // le seul endroit où la clé privée peut être lue (signature des reçus
  // d'activation). Partout ailleurs — store, composants, libs isomorphes — ce
  // serait une fuite.
  const misplaced = offenders.filter(
    (file) => !/^src\/routes\/api\./.test(file) && !/^src\/server\//.test(file) && !/\.server\.ts$/.test(file),
  );
  assert.deepEqual(
    misplaced,
    [],
    `la clé privée de licence est référencée hors d'un module serveur : ${misplaced.join(", ")}`,
  );

  // Le secret JWT n'est lu que par des modules serveur.
  const jwtReaders = [];
  const walkSecrets = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        walkSecrets(relative);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (!/LICENSE_JWT_SECRET/.test(readFileSync(join(ROOT, relative), "utf8"))) continue;
      jwtReaders.push(relative);
    }
  };
  walkSecrets("src");
  for (const file of jwtReaders) {
    assert.match(
      file,
      /^(src\/server\/|src\/routes\/api\.|.*\.server\.ts$)/,
      `${file} lit LICENSE_JWT_SECRET hors d'un module serveur : le secret pourrait fuiter dans le bundle client`,
    );
  }
  // Aucune variante préfixée VITE_ (inlinée dans le bundle) pour ces secrets.
  assert.doesNotMatch(envExample, /VITE_LICENSE_JWT_SECRET/);
  assert.doesNotMatch(envExample, /VITE_LICENSE_PUBLIC_KEY/);
});

test(".env.example documente les variables du module", () => {
  for (const key of [
    "LICENSE_PUBLIC_KEY",
    "LICENSE_JWT_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]) {
    assert.match(envExample, new RegExp(`^#?\\s*${key}=`, "m"), `${key} absente de .env.example`);
  }
});

/* ------------------------------------------------------------------ */
/* 7. Libellés                                                         */
/* ------------------------------------------------------------------ */

test("les libellés du bandeau Premium existent dans les quatre langues", () => {
  const keys = [
    "content.lockedKicker",
    "content.lockedTitle",
    "content.lockedBody",
    "content.lockedSession",
    "content.unlock",
    "content.preview",
  ];
  for (const locale of ["fr", "en", "es", "pt"]) {
    const catalog = read(`src/i18n/messages/${locale}.ts`);
    for (const key of keys) {
      assert.match(catalog, new RegExp(`"${key.replace(".", "\\.")}"`), `${key} absente de ${locale}`);
    }
  }
});
