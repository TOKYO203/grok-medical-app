import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import test from "node:test";

/* Les items de « Signes & Syndromes » ne sont plus des modules : ce sont des
   ACTIFS STATIQUES (`public/content/signes/<catégorie>.json`) publiés tels
   quels sur le CDN et récupérés par `fetch()`. Le contenu va être produit par
   lots par un autre agent : ce test est le contrat qui l'attend.

   Il verrouille :
   1. le manifeste (`_index.json`) ↔ les fichiers réellement publiés ;
   2. la qualité minimale de chaque item (3 signes, 3 options, index valide) ;
   3. l'unicité des identifiants, y compris entre catégories ;
   4. la politique de cache, déclarée DEUX fois (Cloudflare/Netlify lisent
      `public/_headers`, Vercel lit `routeRules` dans `vite.config.ts`) ;
   5. le retour au bundle : la route ne doit JAMAIS réimporter de contenu ;
   6. la mise au premier plan : /signes ouvre le groupe « S'entraîner » du
      tiroir mobile et la tuile d'accueil est pilotée par un drapeau. */

const contentDir = new URL("../public/content/signes/", import.meta.url);
const routePath = new URL("../src/routes/signes.tsx", import.meta.url);
const catalogPath = new URL("../src/lib/signes/catalog.ts", import.meta.url);
const headersPath = new URL("../public/_headers", import.meta.url);
const viteConfigPath = new URL("../vite.config.ts", import.meta.url);
const legacySourceDir = new URL("../src/content/data/signes/", import.meta.url);

const readJson = (url) => readFile(url, "utf8").then(JSON.parse);

const [index, catalogSource, routeSource, headersSource, viteSource] = await Promise.all([
  readJson(new URL("_index.json", contentDir)),
  readFile(catalogPath, "utf8"),
  readFile(routePath, "utf8"),
  readFile(headersPath, "utf8"),
  readFile(viteConfigPath, "utf8"),
]);

const presentFiles = new Set(
  (await readdir(contentDir)).filter((name) => name.endsWith(".json") && name !== "_index.json"),
);

const availableEntries = index.categories.filter((entry) => entry.status === "available");

/** Catalogues publiés, lus une seule fois (manifeste = source de vérité). */
const catalogs = new Map(
  await Promise.all(
    index.categories.map(async (entry) => [
      entry.id,
      presentFiles.has(entry.file) ? await readJson(new URL(entry.file, contentDir)) : undefined,
    ]),
  ),
);

const CATEGORIES = new Set(["signe", "syndrome", "triade", "tetrade", "symptome"]);
const IMMUTABLE_POLICY = "public, max-age=31536000, immutable";

const normalizePolicy = (value) =>
  value
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(", ");

/** Règles de forme communes au manifeste et à l'agrégat historique. */
function assertItemShape(item, where) {
  assert.equal(typeof item.id, "string", `${where}: id manquant`);
  assert.ok(item.id.length > 0, `${where}: id vide`);
  assert.ok(CATEGORIES.has(item.category), `${where}: catégorie inconnue « ${item.category} »`);
  assert.ok(item.disease?.length > 0, `${where}: maladie vide`);
  assert.ok(item.clinicalCase?.length > 0, `${where}: cas clinique vide`);
  assert.ok(item.question?.length > 0, `${where}: question vide`);
  assert.ok(Array.isArray(item.signs), `${where}: signs n'est pas un tableau`);
  assert.ok(item.signs.length >= 3, `${where}: ${item.signs.length} signe(s), 3 minimum attendus`);
  assert.ok(
    item.signs.every((sign) => typeof sign === "string" && sign.trim().length > 0),
    `${where}: signe vide`,
  );
  assert.ok(Array.isArray(item.options), `${where}: options n'est pas un tableau`);
  assert.ok(item.options.length >= 3, `${where}: ${item.options.length} option(s), 3 minimum attendues`);
  assert.ok(
    item.options.every((option) => typeof option === "string" && option.trim().length > 0),
    `${where}: option vide`,
  );
  assert.ok(Number.isInteger(item.correctIndex), `${where}: correctIndex n'est pas un entier`);
  assert.ok(
    item.correctIndex >= 0 && item.correctIndex < item.options.length,
    `${where}: correctIndex ${item.correctIndex} hors de la plage 0..${item.options.length - 1}`,
  );
}

test("le manifeste pointe vers des fichiers publiés et annonce le bon volume", () => {
  assert.ok(Array.isArray(index.categories) && index.categories.length >= 1, "manifeste vide");
  assert.equal(index.schemaVersion, 1, "schemaVersion inattendu");

  const ids = index.categories.map((entry) => entry.id);
  const files = index.categories.map((entry) => entry.file);
  assert.equal(new Set(ids).size, ids.length, "id de catégorie en double dans le manifeste");
  assert.equal(new Set(files).size, files.length, "fichier en double dans le manifeste");

  for (const entry of index.categories) {
    assert.ok(CATEGORIES.has(entry.id), `catégorie inconnue dans le manifeste : ${entry.id}`);
    assert.ok(entry.label?.length > 0, `${entry.id}: libellé vide`);
    assert.match(entry.file, /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/, `${entry.id}: nom de fichier invalide`);
    assert.equal(
      entry.file,
      `${entry.id}.json`,
      `${entry.id}: le chargeur fetch « /content/signes/<catégorie>.json » — le fichier doit porter le nom de l'id`,
    );
    assert.ok(["available", "planned"].includes(entry.status), `${entry.id}: statut invalide`);

    if (entry.status === "planned") continue;

    assert.ok(presentFiles.has(entry.file), `${entry.id}: déclarée disponible mais ${entry.file} est absent`);
    const catalog = catalogs.get(entry.id);
    assert.ok(catalog, `${entry.id}: actif illisible`);
    assert.equal(catalog.schemaVersion, 1, `${entry.id}: schemaVersion inattendu`);
    assert.ok(catalog.items.length >= 1, `${entry.id}: catalogue vide`);
    if (typeof entry.count === "number") {
      assert.equal(entry.count, catalog.items.length, `${entry.id}: count du manifeste divergent`);
    }
  }
});

test("chaque item publié respecte les minimums du raisonnement inversé", () => {
  const seen = new Map();

  for (const entry of availableEntries) {
    const catalog = catalogs.get(entry.id);
    for (const item of catalog.items) {
      const where = `${entry.file} / ${item.id}`;
      assertItemShape(item, where);
      assert.equal(item.category, entry.id, `${where}: item rangé dans une autre catégorie`);

      // Un item qui ne dit pas ce qu'il révèle est un item mort : la maladie
      // doit apparaître dans les options, sinon la déduction est insoluble.
      assert.ok(
        item.options.includes(item.disease),
        `${where}: la maladie révélée ne figure pas parmi les options`,
      );

      // Les options sont un QCM : deux fois le même libellé = deux bonnes
      // réponses possibles du point de vue de l'utilisateur.
      assert.equal(new Set(item.options).size, item.options.length, `${where}: options en double`);

      assert.equal(seen.has(item.id), false, `id d'item en double : ${item.id} (${where} et ${seen.get(item.id)})`);
      seen.set(item.id, where);
    }
  }
});

test("l'agrégat historique mock.json reste un fixture valide (transitoire)", async () => {
  // Conservé volontairement : c'est la démo servie tant que le contenu réel
  // n'est pas publié, et la référence de forme pour les tests. Il disparaîtra
  // quand les catégories définitives seront complètes.
  assert.ok(presentFiles.has("mock.json"), "mock.json a été supprimé : mettre à jour ce test");
  const mock = await readJson(new URL("mock.json", contentDir));
  assert.equal(mock.schemaVersion, 1, "mock.json: schemaVersion inattendu");
  assert.ok(mock.items.length >= 1, "mock.json: aucun item");

  for (const item of mock.items) {
    assertItemShape(item, `mock.json / ${item.id}`);
    assert.ok(item.options.includes(item.disease), `mock.json / ${item.id}: maladie hors des options`);
  }
});

test("plus aucun contenu de signes n'est chargé comme module", async () => {
  const stray = (await readdir(legacySourceDir).catch(() => [])).filter((name) => name.endsWith(".json"));
  assert.deepEqual(stray, [], `contenu resté dans src/content/data/signes/ : ${stray.join(", ")}`);

  assert.match(catalogSource, /SIGNES_ASSET_BASE\s*=\s*"\/content\/signes"/, "base d'actifs inattendue");
  assert.match(catalogSource, /export async function loadSignesContent/, "loadSignesContent absent du catalogue");

  assert.doesNotMatch(
    routeSource,
    /@\/content\/data\/signes|mock\.json/,
    "/signes réimporte du contenu : le module repèserait dans le bundle",
  );
  assert.match(routeSource, /loadSignesCatalog/, "/signes ne passe pas par le chargeur d'actifs");
});

test("le cache CDN des signes est déclaré côté _headers ET côté routeRules", () => {
  const base = catalogSource.match(/SIGNES_ASSET_BASE\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(base, "SIGNES_ASSET_BASE introuvable dans src/lib/signes/catalog.ts");

  // 1. Cloudflare Pages / Netlify
  const lines = headersSource.split("\n");
  const headerIndex = lines.findIndex((line) => line.trim() === `${base}/*`);
  assert.notEqual(headerIndex, -1, `aucun bloc « ${base}/* » dans public/_headers`);
  const directives = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;
    directives.push(line.trim());
  }
  const cacheControl = directives.find((line) => /^cache-control:/i.test(line));
  assert.ok(cacheControl, `bloc « ${base}/* » sans Cache-Control`);
  assert.equal(normalizePolicy(cacheControl.split(":").slice(1).join(":")), normalizePolicy(IMMUTABLE_POLICY));

  // 2. Vercel, qui ignore _headers
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = viteSource.match(new RegExp(`"${escaped}/\\*\\*"\\s*:\\s*\\{[^}]*"cache-control"\\s*:\\s*"([^"]+)"`));
  assert.ok(rule, `aucune routeRule "${base}/**" dans vite.config.ts`);
  assert.equal(normalizePolicy(rule[1]), normalizePolicy(IMMUTABLE_POLICY));
});

test("la tuile d'accueil est pilotée par le drapeau SIGNES_READY", async () => {
  const home = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");

  // Le drapeau existe et pilote l'état de la tuile (sa VALEUR est éditoriale :
  // le contenu arrive par lots, on ne la fige pas dans un test).
  assert.match(home, /const SIGNES_READY = (?:true|false);/, "drapeau SIGNES_READY absent de l'accueil");
  assert.match(
    home,
    /signesState=\{SIGNES_READY \? "ready" : "soon"\}/,
    "la tuile /signes n'est pas branchée sur SIGNES_READY",
  );

  // État « bientôt » : un <div aria-disabled>, jamais un lien → aucun clic ne
  // peut naviguer. C'est la garantie structurelle, pas seulement visuelle.
  assert.match(home, /<div\s+data-signes-card="soon"\s+aria-disabled="true"/, "la tuile désactivée n'est pas un div inerte");
  assert.match(home, /aria-disabled="true"/, "tuile désactivée sans aria-disabled");
});


test("/signes ouvre le groupe « S'entraîner » du tiroir mobile", async () => {
  const navigation = await readFile(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");
  const afterTrain = navigation.split('labelKey: "nav.group.train"')[1] ?? "";
  assert.ok(afterTrain.length > 0, "groupe nav.group.train introuvable");
  // On ne lit QUE le bloc du groupe : le suivant commence à tools.
  const trainBlock = afterTrain.split('labelKey: "nav.group.tools"')[0];
  const targets = [...trainBlock.matchAll(/to:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.ok(targets.length >= 5, "le groupe S'entraîner a perdu des entrées");
  assert.equal(targets[0], "/signes", "/signes doit être la PREMIÈRE entrée du groupe");
  assert.equal(targets.at(-1), "/examen", "/examen doit rester la dernière entrée du groupe");
  assert.equal(new Set(targets).size, targets.length, "cible en double dans le groupe");
});
