/* Garde-fou CACHE & CONFIDENTIALITÉ des actifs de contenu.

   POURQUOI CE TEST EXISTE (réécrit en session « Sécurité Premium S1 »)
   Les fiches étaient des actifs PUBLICS (`public/content/**`) et ce test
   verrouillait leur cache long des deux côtés (Cloudflare/Netlify via
   `_headers`, Vercel via `routeRules` Nitro). Depuis S1, elles vivent dans
   `private/content/**` et sont servies par le worker sous jeton : la propriété
   à protéger a changé de sens.

   Ce qui doit être vrai maintenant — et que rien dans le compilateur ne
   garantit :
   1. AUCUNE règle de cache PUBLIC ne subsiste sur `/content/pathologies/*` ou
      `/content/signes/*` (`_headers`, `routeRules`, `_redirects`) : un CDN qui
      garde la réponse d'un client licencié la resservirait à un anonyme ;
   2. le garde pose lui-même `private` + `Vary: Authorization, Cookie` ;
   3. `_redirects` ne réécrit plus `/content/**` (une réécriture 200 passait
      avant la fonction et pouvait contourner le garde) ;
   4. les APERÇUS publics gardent un cache court et borné ;
   5. le service worker n'est pas figé en `immutable` ;
   6. l'ARTEFACT publié ne contient AUCUNE fiche (sinon le déploiement les
      servirait en clair, quel que soit le code applicatif).
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HEADERS_PATH = join(ROOT, "public/_headers");
const REDIRECTS_PATH = join(ROOT, "public/_redirects");
const VITE_CONFIG_PATH = join(ROOT, "vite.config.ts");
const GUARD_PATH = join(ROOT, "src/server/content-guard.ts");

const headersSource = readFileSync(HEADERS_PATH, "utf8");
const redirectsSource = readFileSync(REDIRECTS_PATH, "utf8");
const viteSource = readFileSync(VITE_CONFIG_PATH, "utf8");
const guardSource = readFileSync(GUARD_PATH, "utf8");

/** Chemins dont le contenu est servi SOUS JETON. */
const PROTECTED_PATHS = ["/content/pathologies", "/content/signes"];

test("aucune règle de cache public ne subsiste sur le contenu protégé (_headers)", () => {
  for (const base of PROTECTED_PATHS) {
    assert.doesNotMatch(
      headersSource,
      new RegExp(`^${base}/\\*$`, "m"),
      `public/_headers déclare encore un bloc « ${base}/* » : une règle de cache ` +
        "CDN s'appliquerait au contenu protégé",
    );
  }
  assert.doesNotMatch(
    headersSource,
    /immutable/,
    "public/_headers ne doit plus contenir de cache `immutable` sur le contenu",
  );
});

test("aucune routeRule publique ne subsiste sur le contenu protégé (Vercel)", () => {
  for (const base of PROTECTED_PATHS) {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.doesNotMatch(
      viteSource,
      new RegExp(`"${escaped}/\\*\\*"`),
      `vite.config.ts déclare encore une routeRule pour ${base}/**`,
    );
  }
});

test("le garde de contenu impose un cache privé et un Vary correct", () => {
  assert.match(
    guardSource,
    /"Cache-Control": status === 200 \? "private, max-age=60" : "no-store"/,
    "le 200 d'un contenu protégé doit être `private` (sinon cache partagé)",
  );
  assert.match(
    guardSource,
    /Vary: "Authorization, Cookie"/,
    "sans `Vary: Authorization`, un cache peut servir la réponse d'un client à un autre",
  );
  assert.match(guardSource, /X-Content-Type-Options": "nosniff"/);
});

test("_redirects ne réécrit plus /content/** (contournement du garde)", () => {
  const rules = redirectsSource
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const rule of rules) {
    assert.doesNotMatch(
      rule,
      /^\/content\//,
      `règle « ${rule} » : une réécriture 200 de /content/** s'exécute avant la fonction serveur`,
    );
  }
});

test("les aperçus publics gardent un cache court et borné", () => {
  assert.match(
    viteSource,
    /"\/content\/previews\/\*\*"\s*:\s*\{[^}]*"cache-control"\s*:\s*"public, max-age=60, s-maxage=300"/,
    "les aperçus doivent rester cacheables (cache court), sinon chaque page verrouillée les re-demande",
  );
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
  assert.doesNotMatch(
    cacheControl,
    /immutable/i,
    "un service worker immutable ne pourrait plus jamais être mis à jour",
  );
  assert.match(cacheControl, /no-cache|no-store|max-age=0/i);
});

/* ------------------------------------------------------------------ */
/* ARTEFACT — après `npm run build`                                     */
/* ------------------------------------------------------------------ */

const STATIC_DIR_CANDIDATES = [".vercel/output/static", ".netlify/static", ".output/public", "dist"];
const builtStaticDirectory = STATIC_DIR_CANDIDATES.map((path) => join(ROOT, path)).find((path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
});

/**
 * Blocs de `_headers` → `{ path, directives }`, commentaires `#` ignorés.
 *
 * ⚠️ Le test lisait auparavant le fichier BRUT et interdisait le motif
 * `/content/(pathologies|signes)/*` n'importe où — y compris dans le
 * commentaire d'avertissement qui explique précisément pourquoi la règle ne
 * doit pas exister. Le garde-fou criait donc au loup sur sa propre
 * documentation. Ce qui est une faute, c'est une RÈGLE qui rend le contenu
 * protégé cacheable publiquement : on analyse les règles.
 */
function parseHeaderRules(source) {
  const rules = [];
  let current = null;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (!rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      current = { path: line, directives: [] };
      rules.push(current);
      continue;
    }
    if (current) current.directives.push(line);
  }
  return rules;
}

const PROTECTED_PATH = /^\/(content\/(pathologies|signes)\/?\*?|content\/\$type)/;

test("l'artefact publié ne rend pas le contenu protégé cacheable (Cloudflare Pages / Netlify)", { skip: !builtStaticDirectory }, () => {
  const published = join(builtStaticDirectory, "_headers");
  assert.ok(existsSync(published), `_headers absent de ${builtStaticDirectory}`);

  const offenders = parseHeaderRules(readFileSync(published, "utf8"))
    .filter((rule) => PROTECTED_PATH.test(rule.path))
    .flatMap((rule) =>
      rule.directives
        .filter((directive) => /^cache-control:/i.test(directive))
        .filter((directive) => /\bpublic\b/i.test(directive))
        .map((directive) => `${rule.path} → ${directive}`),
    );

  assert.deepEqual(
    offenders,
    [],
    "l'artefact publié déclare un cache PUBLIC sur le contenu protégé : " +
      "un CDN resservirait la réponse d'un client licencié à un visiteur anonyme.\n" +
      offenders.join("\n"),
  );
});

test("le déploiement ne publie AUCUNE fiche de contenu", { skip: !builtStaticDirectory }, () => {
  for (const relativePath of ["content/pathologies", "content/signes"]) {
    const directory = join(builtStaticDirectory, relativePath);
    if (!existsSync(directory)) continue;
    const files = readdirSync(directory).filter((name) => name.endsWith(".json"));
    // `_index.json` (manifeste public) est le seul fichier toléré.
    const leaked = files.filter((name) => name !== "_index.json");
    assert.deepEqual(
      leaked,
      [],
      `${relativePath} publie ${leaked.length} fiche(s) en clair (ex. ${leaked[0]}) : ` +
        "elles seraient accessibles sans jeton, quel que soit le code applicatif",
    );
  }
});

test("le déploiement Vercel ne déclare pas de cache public pour le contenu", { skip: !builtStaticDirectory }, () => {
  const configPath = join(ROOT, ".vercel/output/config.json");
  if (!existsSync(configPath)) return; // build Netlify/Cloudflare : rien à vérifier ici

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const offenders = (config.routes ?? []).filter(
    (route) =>
      typeof route.src === "string" &&
      /content\/(pathologies|signes)/.test(route.src) &&
      route.headers &&
      /public/.test(String(route.headers["cache-control"] ?? "")),
  );
  assert.deepEqual(
    offenders.map((route) => route.src),
    [],
    "des routes d'en-têtes publiques visent le contenu protégé sur Vercel",
  );
});
