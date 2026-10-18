/* Garde-fou INTÉGRITÉ du module « Signes & Syndromes ».

   POURQUOI CE TEST EXISTE
   Le contenu n'est plus un module importé : c'est un manifeste canonique
   PUBLIC (`public/content/signes/_index.json`) + une fiche par actif
   (`private/content/signes/<id>.json`), cette dernière étant servie UNIQUEMENT
   contre un jeton de contenu (session Sécurité Premium S1). Rien dans le
   compilateur ne relie le manifeste aux fichiers :
   une fiche renommée, un id dupliqué entre deux catégories ou un `correctIndex`
   hors plage produirait une page qui s'affiche — avec une fiche manquante ou
   une déduction insoluble. Ce test transforme ces pannes silencieuses en échec
   de CI.

   Il verrouille :
   1. manifeste canonique ↔ fichiers réellement publiés (et <id>.json == id) ;
   2. la forme éditoriale minimale (≥ 3 signes, ≥ 3 options, index valide) ;
   3. l'unicité des ids, y compris ENTRE catégories (le catalogue les fusionne) ;
   4. les sources : au moins une, en HTTPS, avec organisation + titre ;
   5. les fiches SORTIES du dossier publié, et un cache JAMAIS public sur les
      routes protégées (un cache public resservirait le 200 d'un client
      autorisé à un visiteur anonyme — le défaut que S1 corrige) ;
   6. l'absence de contenu dans le bundle (aucun import statique de JSON) ;
   7. le mock déplacé hors de `public/` (fixture de test, jamais publiée).
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Fiches : PRIVÉES (hors dossier publié, servies sous jeton). */
const ASSET_DIR = join(ROOT, "private/content/signes");
/** Manifeste : PUBLIC (listage d'ids, aucun contenu médical). */
const PUBLIC_INDEX_PATH = join(ROOT, "public/content/signes/_index.json");
const INDEX_PATH = PUBLIC_INDEX_PATH;

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

test("les fiches ne sont jamais mises en cache publiquement (ni CDN, ni Vercel)", () => {
  // ⚠️ Assertion INVERSÉE par rapport à l'architecture « actif statique » : une
  // fiche protégée ne doit avoir AUCUNE règle de cache public, sans quoi le
  // CDN resservirait à un anonyme la réponse 200 d'un client licencié.
  assert.doesNotMatch(
    headersSource,
    /^\/content\/signes\/\*$/m,
    "public/_headers déclare encore un cache public pour /content/signes/*",
  );
  assert.doesNotMatch(
    viteSource,
    /"\/content\/signes\/\*\*"\s*:\s*\{[^}]*public, max-age=31536000/,
    "routeRules déclare encore un cache public pour /content/signes/**",
  );
  // La protection, elle, doit être déclarée : le garde répond en privé.
  const guardSource = readFileSync(join(ROOT, "src/server/content-guard.ts"), "utf8");
  assert.match(guardSource, /private, max-age=60/);
  assert.match(guardSource, /Vary: "Authorization, Cookie"/);
});

test("le format du cache public reste connu (garde-fou de forme)", () => {
  const policy = "public, max-age=31536000, immutable";
  const normalize = (value) =>
    value
      .split(",")
      .map((directive) => directive.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(", ");

  assert.equal(normalize(policy), "immutable, max-age=31536000, public");
  // Le service worker, lui, ne doit jamais être figé (déjà couvert par
  // scripts/content-assets-cache.test.mjs).
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
    /fetchWithAuth\(/,
    "le catalogue doit charger les actifs protégés avec fetchWithAuth() (jeton joint)",
  );
  assert.match(
    catalogSource,
    /SIGNES_CATALOG_URL/,
    "le catalogue doit passer par l'endpoint groupé /content/signes/_catalog.json",
  );
});

test("le mock est une fixture de test, plus jamais un actif publié", () => {
  assert.ok(
    existsSync(join(ROOT, "tests/fixtures/signes-mock.json")),
    "tests/fixtures/signes-mock.json absent : la fixture a été perdue",
  );
  assert.ok(
    !existsSync(join(ASSET_DIR, "mock.json")),
    "mock.json ne doit pas être publié dans private/content/signes/",
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

/* ------------------------------------------------------------------ */
/* TUILE D'ACCUEIL — le module est annoncé, pas encore ouvert           */
/* ------------------------------------------------------------------ */

const homeSource = readFileSync(join(ROOT, "src/routes/index.tsx"), "utf8");

test("la tuile d'accueil est OUVERTE (SIGNES_READY=true) — 10 fiches prêtes", () => {
  assert.match(
    homeSource,
    /const SIGNES_READY = true;/,
    "SIGNES_READY doit valoir true : la banque de 10 fiches est présentable",
  );

  // La tuile est branchée sur le drapeau : la passer à true suffit à l'ouvrir.
  assert.match(
    homeSource,
    /signesState=\{SIGNES_READY \? "ready" : "soon"\}/,
    "la tuile doit dériver son état du drapeau SIGNES_READY",
  );
});

test("l'état « Bientôt » n'est pas un lien : le clic ne peut rien faire", () => {
  const soon = homeSource.slice(
    homeSource.indexOf('if (signesState === "soon")'),
    homeSource.indexOf("<Link to={to}", homeSource.indexOf('if (signesState === "soon")')),
  );
  assert.ok(soon.length > 0, "branche « soon » introuvable dans QuickAction");
  assert.match(soon, /<div/, "l'état « soon » doit être un <div>");
  assert.doesNotMatch(soon, /<Link/, "l'état « soon » ne doit contenir AUCUN lien");
  assert.match(soon, /aria-disabled="true"/, "l'état « soon » doit être aria-disabled");
  assert.match(soon, /data-signes-card="soon"/, "l'état « soon » doit être marquable en QA");
  assert.match(soon, /cursor-not-allowed/, "l'état « soon » doit signaler visuellement l'inactivité");
  assert.match(homeSource, /soonLabel=\{t\("dash\.soon"\)\}/, "le badge doit être traduit");
});

test("les libellés de la tuile existent dans les quatre langues", () => {
  for (const locale of ["fr", "en", "es", "pt"]) {
    const catalog = readFileSync(join(ROOT, `src/i18n/messages/${locale}.ts`), "utf8");
    for (const key of ["dash.signesDetail", "dash.soon"]) {
      assert.ok(catalog.includes(`"${key}":`), `${locale} : clé manquante ${key}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* NAVIGATION — le module passe au premier plan                        */
/* ------------------------------------------------------------------ */

const navigationSource = readFileSync(join(ROOT, "src/lib/navigation.ts"), "utf8");

test("/signes ouvre le groupe « S'entraîner », /examen le ferme", () => {
  const trainStart = navigationSource.indexOf('labelKey: "nav.group.train"');
  assert.notEqual(trainStart, -1, "groupe nav.group.train introuvable");
  const train = navigationSource.slice(trainStart, navigationSource.indexOf('labelKey: "nav.group.tools"'));
  const targets = [...train.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]);

  assert.ok(targets.length >= 5, `groupe « train » incomplet : ${targets.join(", ")}`);
  assert.equal(targets[0], "/signes", "le raisonnement inversé doit ouvrir le groupe");
  assert.equal(targets[1], "/ecg", "Cas ECG reste juste après /signes");
  assert.equal(targets[targets.length - 1], "/examen", "l'examen blanc reste le dernier entraînement");
});
