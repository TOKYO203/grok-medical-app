/* Garde-fou INTÉGRITÉ du module « Signes & Syndromes ».

   POURQUOI CE TEST EXISTE
   Le contenu n'est plus un module importé : c'est un manifeste canonique
   (`public/content/signes/_index.json`) + une fiche par actif
   (`public/content/signes/<id>.json`), publiés tels quels et récupérés par
   `fetch()`. Rien dans le compilateur ne relie le manifeste aux fichiers :
   une fiche renommée, un id dupliqué entre deux catégories ou un `correctIndex`
   hors plage produirait une page qui s'affiche — avec une fiche manquante ou
   une déduction insoluble. Ce test transforme ces pannes silencieuses en échec
   de CI.

   Il verrouille :
   1. manifeste canonique ↔ fichiers réellement publiés (et <id>.json == id) ;
   2. la forme éditoriale minimale (≥ 3 signes, ≥ 3 options, index valide) ;
   3. l'unicité des ids, y compris ENTRE catégories (le catalogue les fusionne) ;
   4. les sources : au moins une, en HTTPS, avec organisation + titre ;
   5. le cache CDN déclaré des DEUX côtés (Cloudflare/Netlify via `_headers`,
      Vercel via `routeRules`) — sans lui l'architecture perd tout son intérêt ;
   6. l'absence de contenu dans le bundle (aucun import statique de JSON) ;
   7. le mock déplacé hors de `public/` (fixture de test, jamais publiée).
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ASSET_DIR = join(ROOT, "public/content/signes");
const INDEX_PATH = join(ASSET_DIR, "_index.json");

const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
const headersSource = readFileSync(join(ROOT, "public/_headers"), "utf8");
const viteSource = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
const routeSource = readFileSync(join(ROOT, "src/routes/signes.tsx"), "utf8");
const catalogSource = readFileSync(join(ROOT, "src/lib/signes/catalog.ts"), "utf8");

/** Toutes les paires [catégorie, id] du manifeste, dans l'ordre éditorial. */
const entries = Object.entries(index.categories ?? {}).flatMap(([category, ids]) =>
  (Array.isArray(ids) ? ids : []).map((id) => ({ category, id })),
);

const readItem = (id) => JSON.parse(readFileSync(join(ASSET_DIR, `${id}.json`), "utf8"));

test("le manifeste canonique est lisible et non vide", () => {
  assert.equal(index.schemaVersion, 1);
  assert.ok(entries.length >= 10, `manifeste trop pauvre : ${entries.length} fiche(s)`);
  // Le manifeste porte la table des matières, jamais le contenu médical.
  assert.ok(!("items" in index), "le manifeste ne doit pas embarquer les items");
});

test("chaque id du manifeste a son actif <id>.json, et réciproquement", () => {
  const declared = new Set(entries.map((entry) => entry.id));
  const published = readdirSync(ASSET_DIR)
    .filter((name) => name.endsWith(".json") && name !== "_index.json")
    .map((name) => name.replace(/\.json$/, ""));

  for (const id of declared) {
    assert.ok(published.includes(id), `fiche déclarée mais absente : ${id}.json`);
  }
  for (const id of published) {
    assert.ok(declared.has(id), `actif publié mais absent du manifeste : ${id}.json`);
  }
});

test("chaque fiche est cohérente avec la catégorie qui la déclare", () => {
  for (const { category, id } of entries) {
    const item = readItem(id);
    assert.equal(item.id, id, `${id}.json déclare id « ${item.id} »`);
    assert.equal(item.category, category, `${id}.json déclare la catégorie « ${item.category} »`);
  }
});

test("la forme éditoriale minimale est respectée (≥ 3 signes, ≥ 3 options)", () => {
  for (const { id } of entries) {
    const item = readItem(id);

    assert.ok(
      Array.isArray(item.signs) && item.signs.length >= 3,
      `${id} : une triade/tétrade/syndrome demande au moins 3 signes`,
    );
    assert.ok(
      item.signs.every((sign) => typeof sign === "string" && sign.trim().length > 0),
      `${id} : signe vide`,
    );

    assert.ok(
      Array.isArray(item.options) && item.options.length >= 3,
      `${id} : moins de 3 options rend la déduction triviale`,
    );
    assert.equal(
      new Set(item.options).size,
      item.options.length,
      `${id} : options en double (la bonne réponse serait ambiguë)`,
    );
    assert.ok(
      Number.isInteger(item.correctIndex) &&
        item.correctIndex >= 0 &&
        item.correctIndex < item.options.length,
      `${id} : correctIndex hors plage (${item.correctIndex})`,
    );
    // Les fiches éditoriales répondent parfois par le MÉCANISME
    // (« Hyperventilation compensatrice… » pour Kussmaul) : on n'exige donc pas
    // que le libellé de la maladie figure parmi les options, seulement que la
    // bonne réponse soit renseignée.
    assert.ok(item.options[item.correctIndex].trim().length > 0, `${id} : bonne réponse vide`);

    assert.ok(
      typeof item.clinicalCase === "string" && item.clinicalCase.length >= 80,
      `${id} : cas clinique trop court pour être un cas`,
    );
    assert.ok(
      typeof item.question === "string" && item.question.trim().endsWith("?"),
      `${id} : la question de déduction doit être une question`,
    );
  }
});

test("les ids sont uniques, y compris entre catégories", () => {
  const seen = new Map();
  for (const { category, id } of entries) {
    const previous = seen.get(id);
    assert.equal(previous, undefined, `id dupliqué « ${id} » (${previous} et ${category})`);
    seen.set(id, category);
  }
});

test("chaque fiche porte au moins une source HTTPS vérifiable", () => {
  for (const { id } of entries) {
    const item = readItem(id);
    assert.ok(
      Array.isArray(item.sources) && item.sources.length >= 1,
      `${id} : aucune source (traçabilité éditoriale obligatoire)`,
    );
    for (const source of item.sources) {
      assert.ok(
        typeof source.organization === "string" && source.organization.trim().length > 0,
        `${id} : source sans organisation`,
      );
      assert.ok(
        typeof source.title === "string" && source.title.trim().length > 0,
        `${id} : source sans titre`,
      );
      let url;
      assert.doesNotThrow(() => {
        url = new URL(source.url);
      }, `${id} : URL de source invalide (${source.url})`);
      assert.equal(url.protocol, "https:", `${id} : source non HTTPS (${source.url})`);
    }
  }
});

test("le cache immutable est déclaré des deux côtés (CDN + Vercel)", () => {
  const policy = "public, max-age=31536000, immutable";
  const normalize = (value) =>
    value
      .split(",")
      .map((directive) => directive.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(", ");

  const lines = headersSource.split("\n");
  const start = lines.findIndex((line) => line.trim() === "/content/signes/*");
  assert.notEqual(start, -1, "aucun bloc « /content/signes/* » dans public/_headers");
  const directives = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;
    directives.push(line.trim());
  }
  const cacheControl = directives.find((line) => /^cache-control:/i.test(line));
  assert.ok(cacheControl, "bloc /content/signes/* sans en-tête Cache-Control");
  assert.equal(normalize(cacheControl.split(":").slice(1).join(":")), normalize(policy));

  // Nitro attend un glob `**` ; il le compile en `/content/signes/(.*)` côté Vercel.
  assert.match(
    viteSource,
    /"\/content\/signes\/\*\*"\s*:\s*\{[^}]*"cache-control"\s*:\s*"public, max-age=31536000, immutable"/,
    "routeRules sans cache-control pour /content/signes/** : Vercel servirait les fiches sans cache long",
  );
});

test("le contenu reste hors du bundle (aucun import statique de JSON)", () => {
  assert.doesNotMatch(
    routeSource,
    /from\s+["'][^"']*\.json["']/,
    "src/routes/signes.tsx importe un JSON : le contenu repeserait dans le bundle",
  );
  assert.doesNotMatch(
    catalogSource,
    /from\s+["'][^"']*\.json["']/,
    "src/lib/signes/catalog.ts importe un JSON : le contenu repeserait dans le bundle",
  );
  assert.match(
    catalogSource,
    /fetch\(/,
    "le catalogue doit charger les actifs par fetch() côté navigateur",
  );
  assert.match(
    catalogSource,
    /createServerFn/,
    "le catalogue doit lire le disque côté SSR via createServerFn",
  );
});

test("le mock est une fixture de test, plus jamais un actif publié", () => {
  assert.ok(
    existsSync(join(ROOT, "tests/fixtures/signes-mock.json")),
    "tests/fixtures/signes-mock.json absent : la fixture a été perdue",
  );
  assert.ok(
    !existsSync(join(ASSET_DIR, "mock.json")),
    "mock.json ne doit pas être publié dans public/content/signes/",
  );
  assert.ok(
    !existsSync(join(ROOT, "src/content/data/signes/mock.json")),
    "mock.json ne doit pas revenir dans src/content/data/signes/",
  );

  const fixture = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/signes-mock.json"), "utf8"));
  assert.equal(fixture.schemaVersion, 1);
  assert.ok(Array.isArray(fixture.items) && fixture.items.length >= 1);
  for (const item of fixture.items) {
    assert.ok(Array.isArray(item.signs) && item.signs.length >= 3);
    assert.ok(Array.isArray(item.options) && item.options.length >= 3);
  }

  // Aucun module de l'app ne doit importer la fixture (elle ne doit pas peser
  // dans le bundle) — seuls les tests et scripts ont le droit de la lire.
  const offenders = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(relative);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
      const source = readFileSync(join(ROOT, relative), "utf8");
      if (/signes-mock\.json|data\/signes\/mock\.json/.test(source) && !relative.startsWith("scripts/")) {
        offenders.push(relative);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, [], `la fixture de test est importée par l'application : ${offenders.join(", ")}`);
});
