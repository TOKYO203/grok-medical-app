/* Garde-fou CACHE des actifs de contenu (fiches de nosographie).

   POURQUOI CE TEST EXISTE
   Les fiches ne sont plus des modules : ce sont des fichiers JSON publiés tels
   quels (`public/content/pathologies/<slug>.json`) et récupérés par `fetch()`.
   Le gain de l'architecture tient ENTIÈREMENT au cache long : sans lui, chaque
   ouverture de fiche re-télécharge ~50 Kio depuis le CDN. Or la politique de
   cache est déclarée DEUX FOIS, parce que les plateformes ne lisent pas le même
   fichier :

   • Cloudflare Pages et Netlify lisent `public/_headers` ;
   • Vercel l'IGNORE et reçoit les règles via `routeRules` Nitro
     (`vite.config.ts`), traduites en routes d'en-têtes dans
     `.vercel/output/config.json`.

   Deux déclarations = deux occasions d'en oublier une, et rien n'échouerait :
   le build resterait vert, la page s'afficherait, seule la performance
   s'effondrerait silencieusement sur une plateforme. Ce test verrouille :

   1. `public/_headers` déclare le cache immutable sur `/content/pathologies/*` ;
   2. `vite.config.ts` déclare la MÊME politique en `routeRules` ;
   3. les deux couvrent le chemin réellement utilisé par le manifeste
      (`PATHOLOGY_ASSET_BASE`), pour qu'un changement de dossier ne laisse pas
      les en-têtes pointer sur une URL morte ;
   4. `_headers` ne fige pas le service worker dans un cache immutable
      (sinon une mise à jour de l'app ne serait jamais servie).
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HEADERS_PATH = join(ROOT, "public/_headers");
const VITE_CONFIG_PATH = join(ROOT, "vite.config.ts");
const MANIFEST_MODULE_PATH = join(ROOT, "src/lib/pathologies/manifest.ts");

const headersSource = readFileSync(HEADERS_PATH, "utf8");
const viteSource = readFileSync(VITE_CONFIG_PATH, "utf8");
const manifestSource = readFileSync(MANIFEST_MODULE_PATH, "utf8");

/** Politique attendue, écrite une seule fois ici : c'est la référence du test. */
const IMMUTABLE_POLICY = "public, max-age=31536000, immutable";

/** Chemin public des fiches, tel que déclaré par le module manifeste. */
function declaredAssetBase() {
  const match = manifestSource.match(/PATHOLOGY_ASSET_BASE\s*=\s*"([^"]+)"/);
  assert.ok(match, "PATHOLOGY_ASSET_BASE introuvable dans src/lib/pathologies/manifest.ts");
  return match[1];
}

/** Normalise une politique `Cache-Control` (espaces, casse). */
const normalizePolicy = (value) =>
  value
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(", ");

test("public/_headers déclare un cache immutable sur le dossier des fiches", () => {
  const base = declaredAssetBase();
  const expectedBlock = `${base}/*`;
  const lines = headersSource.split("\n");

  const index = lines.findIndex((line) => line.trim() === expectedBlock);
  assert.notEqual(index, -1, `aucun bloc « ${expectedBlock} » dans public/_headers`);

  // Le bloc s'arrête à la prochaine règle (ligne non indentée non vide) : on
  // ne lit QUE ses directives, sinon un en-tête voisin pourrait valider le test.
  const directives = [];
  for (const line of lines.slice(index + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;
    directives.push(line.trim());
  }

  const cacheControl = directives.find((line) => /^cache-control:/i.test(line));
  assert.ok(cacheControl, `bloc « ${expectedBlock} » sans en-tête Cache-Control`);
  assert.equal(normalizePolicy(cacheControl.split(":").slice(1).join(":")), normalizePolicy(IMMUTABLE_POLICY));
});

test("vite.config.ts déclare la même politique pour Vercel (qui ignore _headers)", () => {
  const base = declaredAssetBase();
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Bloc `routeRules` de Nitro : la clé porte le motif `**` (glob) et non `*`.
  const ruleRegex = new RegExp(`"${escaped}/\\*\\*"\\s*:\\s*\\{[^}]*"cache-control"\\s*:\\s*"([^"]+)"`);
  const match = viteSource.match(ruleRegex);
  assert.ok(
    match,
    `aucune routeRule "${base}/**" avec cache-control dans vite.config.ts : ` +
      "Vercel servirait les fiches sans cache long",
  );
  assert.equal(normalizePolicy(match[1]), normalizePolicy(IMMUTABLE_POLICY));
});

test("le test suit le dossier réellement utilisé par le manifeste", async () => {
  const base = declaredAssetBase();
  const directory = join(ROOT, "public", base.replace(/^\//, ""));
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 1, `aucune fiche dans public${base}`);

  const index = JSON.parse(await readFile(join(ROOT, "src/content/data/pathologies/_index.json"), "utf8"));
  const available = index.fiches.filter((entry) => entry.status === "available");
  for (const entry of available) {
    assert.ok(files.includes(entry.file), `${entry.file} déclarée disponible mais absente de public${base}`);
  }
});

test("le service worker n'est pas figé dans un cache immutable", () => {
  const lines = headersSource.split("\n");
  const index = lines.findIndex((line) => line.trim() === "/sw.js");
  assert.notEqual(index, -1, "aucun bloc « /sw.js » dans public/_headers");

  const directives = [];
  for (const line of lines.slice(index + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;
    directives.push(line.trim());
  }
  const cacheControl = directives.find((line) => /^cache-control:/i.test(line));
  assert.ok(cacheControl, "bloc « /sw.js » sans en-tête Cache-Control");
  assert.doesNotMatch(cacheControl, /immutable/i, "un service worker immutable ne pourrait plus jamais être mis à jour");
  assert.match(cacheControl, /no-cache|no-store|max-age=0/i);
});

/* ------------------------------------------------------------------ */
/* 5. ARTEFACT — après `npm run build`                                  */
/* ------------------------------------------------------------------ */

/* Ces deux vérifications ne peuvent être faites sur les sources : elles
   prouvent que la règle SURVIT à la compilation, sur les deux plateformes.
   Le test est ignoré quand aucun build n'est disponible (job CI `test`, qui
   tourne avant `build`) — même stratégie que `scripts/bundle-content.test.mjs`. */

const STATIC_DIR_CANDIDATES = [".vercel/output/static", ".netlify/static", ".output/public", "dist"];
const builtStaticDirectory = STATIC_DIR_CANDIDATES.map((path) => join(ROOT, path)).find((path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
});

test("l'artefact publié contient _headers (Cloudflare Pages / Netlify)", { skip: !builtStaticDirectory }, () => {
  const published = join(builtStaticDirectory, "_headers");
  assert.ok(existsSync(published), `_headers absent de ${builtStaticDirectory} : le cache long serait perdu au déploiement`);
  assert.match(readFileSync(published, "utf8"), /\/content\/pathologies\/\*/);
});

test("l'artefact Vercel contient la règle d'en-têtes traduite depuis routeRules", { skip: !builtStaticDirectory }, () => {
  // `_headers` n'est lu que par Cloudflare Pages et Netlify : sur Vercel, la
  // politique n'existe QUE si Nitro l'a traduite en route d'en-têtes.
  const configPath = join(ROOT, ".vercel/output/config.json");
  if (!existsSync(configPath)) return; // build Netlify/Cloudflare : rien à vérifier ici

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const rule = (config.routes ?? []).find(
    (route) => typeof route.src === "string" && route.src.includes("content/pathologies") && route.headers,
  );
  assert.ok(rule, "aucune route d'en-têtes pour /content/pathologies dans .vercel/output/config.json");
  assert.equal(normalizePolicy(rule.headers["cache-control"] ?? ""), normalizePolicy(IMMUTABLE_POLICY));
});
