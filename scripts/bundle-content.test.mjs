/* Garde-fou bundle du contenu de cours (Nosographie / démarches enrichies).

   POURQUOI CE TEST EXISTE
   Une fiche de nosographie pèse ~50 Kio et le référentiel compte 240 items.
   Deux architectures ont été essayées :
   1. import statique → la fiche entre dans le chunk initial (rejeté) ;
   2. import() dynamique → un chunk séparé, mais chaque fiche reste un fichier
      JAVASCRIPT compilé, compté dans le budget de bundle (mesuré : 2 fiches =
      81 Kio dans dist/assets/). À 43 fiches, l'approche plafonne.
   3. Actifs statiques publics (`public/content/**`, 2026-10-18) → zéro octet
      dans le bundle client, mais le CDN sert la fiche à qui connaît l'URL ;
   4. ARCHITECTURE RETENUE (session Sécurité Premium S1) : le contenu vit dans
      `private/content/**` et est compilé dans le bundle SERVEUR ; il ne sort
      que par `/content/$type/$file`, sous jeton de contenu. Zéro octet dans le
      bundle CLIENT, rien dans le dossier publié, et les 40 fiches suivantes
      n'ajoutent AUCUN JavaScript côté navigateur.

   CE QUE LE TEST VÉRIFIE
   1. SOURCE (toujours, sans build) : aucun module de `src/` n'importe (de
      façon statique OU dynamique) un fichier de contenu, et le catalogue des
      fiches ne contient plus aucun `import() de JSON`.
   2. LOGIQUE (fixtures) : la détection « payload dans un chunk JS » est
      exercée sur de faux dossiers d'assets, pour que le garde-fou soit testé
      même quand aucun build n'est disponible (job CI `test`).
   3. ARTEFACT (après `npm run build`) : AUCUNE fiche n'est publiée dans le
      dossier statique (session Sécurité Premium S1 — elles seraient servies
      sans jeton), aucun chunk JS ne contient son payload ni ne porte son nom,
      et le chunk principal reste sous 700 Kio.

   ⚠️ NOTE SUR LES IDENTIFIANTS
   « paludisme » ou « DX-THORAX-001 » apparaissent légitimement dans des
   MANIFESTES chargés en eager (`src/content/data/pathologies/_index.json`,
   `diagnostics.json`…) : ce sont des clés de navigation, pas du contenu. On
   vérifie donc le PAYLOAD (objectif rédigé, texte de source), ce qui est
   strictement plus fort qu'une recherche d'identifiant.

   Le dossier statique dépend de la cible de déploiement : `.vercel/output/
   static` (cas courant ici), `.netlify/static`, `.output/public`, `dist`. La
   résolution est partagée avec `scripts/performance-budget.mjs`. */

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findAssetDirectory, findStaticDirectory } from "./performance-budget.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Plafond du chunk principal demandé par le propriétaire (700 Kio). */
export const MAX_MAIN_CHUNK_BYTES = 700 * 1024;

/**
 * Dossier du contenu protégé, HORS du dossier publié.
 * (Avant S1 : `public/content/pathologies`, servi par le CDN sans aucun jeton.)
 */
const CONTENT_ASSET_PATH = "private/content/pathologies";

/**
 * Familles de contenu.
 *
 * `servedAs` décide de la règle :
 * • `asset`  — fichier JSON statique : le payload ne doit apparaître dans AUCUN
 *   chunk JS et le fichier doit être publié tel quel dans le dossier statique ;
 * • `module` — contenu encore importé par le registre (limitation connue des
 *   démarches) : le payload doit rester hors du chunk initial, dans un chunk
 *   unique nommé d'après la fiche.
 */
const CONTENT_FAMILIES = [
  {
    name: "fiches de nosographie",
    // Contenu PRIVÉ : compilé dans le bundle serveur, jamais dans un chunk client.
    dir: join(ROOT, CONTENT_ASSET_PATH),
    /** Unique point d'entrée autorisé vers les actifs de la famille. */
    registry: join(ROOT, "src/lib/pathologies/catalog.ts"),
    servedAs: "asset",
    /** Servi sous jeton par `/content/$type/$file` : rien dans le statique. */
    published: false,
  },
  {
    name: "démarches enrichies",
    dir: join(ROOT, "src/content/data/demarches"),
    registry: join(ROOT, "src/lib/demarches/catalog.ts"),
    /**
     * Le registre des démarches importe encore son JSON statiquement : le
     * contenu atterrit dans le chunk de la route `/demarche/$id` (46 Kio), pas
     * dans le chunk initial. La règle stricte « actif statique » ne s'applique
     * donc qu'aux fiches — cf. LIMITATION en fin de fichier.
     */
    servedAs: "module",
  },
];

/** Champs de contenu qui n'existent QUE dans le JSON de la fiche. */
function payloadSentinels(content) {
  const sentinels = [];
  for (const value of [content.objective, content.subtitle]) {
    if (typeof value === "string" && value.trim().length >= 40) sentinels.push(value.trim());
  }
  const citation = content.sources?.find((source) => typeof source.citation === "string")?.citation;
  if (citation && citation.trim().length >= 30) sentinels.push(citation.trim());
  if (sentinels.length === 0) {
    throw new Error(`aucun marqueur de payload exploitable (slug: ${content.slug ?? "?"})`);
  }
  return sentinels;
}

/** Contenus réels du dépôt (tout fichier de données hors manifeste). */
async function loadContents() {
  const contents = [];
  for (const family of CONTENT_FAMILIES) {
    const files = (await readdir(family.dir)).filter(
      (name) => name.endsWith(".json") && name !== "_index.json",
    );
    for (const file of files) {
      const content = JSON.parse(await readFile(join(family.dir, file), "utf8"));
      const id = content.slug ?? content.diagnosticId ?? file;
      contents.push({
        family: family.name,
        servedAs: family.servedAs,
        file,
        id,
        sentinels: payloadSentinels(content),
      });
    }
  }
  return contents;
}

/* ------------------------------------------------------------------ */
/* Analyse d'un dossier d'assets — logique pure, réutilisée par la QA  */
/* ------------------------------------------------------------------ */

/**
 * Analyse les chunks JS d'un dossier d'assets.
 *
 * @param {string} assetDirectory dossier contenant les `.js` du client
 * @param {{id: string, file: string, servedAs: "asset" | "module", sentinels: string[]}[]} contents
 * @returns {{
 *   mainChunk: string,
 *   mainChunkBytes: number,
 *   placements: {id: string, file: string, chunk: string | null, chunks: string[]}[],
 *   violations: string[],
 * }}
 */
export function analyseAssets(assetDirectory, contents, maxMainChunkBytes = MAX_MAIN_CHUNK_BYTES) {
  const chunks = readdirSync(assetDirectory)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      bytes: statSync(join(assetDirectory, name)).size,
      text: readFileSync(join(assetDirectory, name), "utf8"),
    }))
    .sort((a, b) => b.bytes - a.bytes);

  if (chunks.length === 0) {
    throw new Error(`aucun chunk JS dans ${assetDirectory}`);
  }

  // « Chunk principal » = le plus gros JS du client. C'est la définition
  // demandée, et c'est aussi celle qui attrape un import statique ajouté
  // depuis un module du graphe initial (racine, Shell, store).
  const main = chunks[0];
  const violations = [];

  if (main.bytes > maxMainChunkBytes) {
    violations.push(
      `chunk principal ${main.name} : ${(main.bytes / 1024).toFixed(1)} Kio > ${(maxMainChunkBytes / 1024).toFixed(0)} Kio`,
    );
  }

  const placements = contents.map((content) => {
    const containsPayload = (chunk) => content.sentinels.every((sentinel) => chunk.text.includes(sentinel));
    const chunksWithPayload = chunks.filter(containsPayload).map((chunk) => chunk.name);

    // Actif statique : le contenu ne doit exister dans AUCUN chunk JS.
    if (content.servedAs === "asset") {
      if (chunksWithPayload.length > 0) {
        violations.push(
          `${content.file} : actif statique présent dans ${chunksWithPayload.length} chunk(s) JS (${chunksWithPayload.join(", ")}) — un import de JSON est revenu dans le graphe`,
        );
      }
      const slugChunk = chunks.find((chunk) => basename(chunk.name).startsWith(`${content.id}-`));
      if (slugChunk) {
        violations.push(
          `${content.file} : un chunk JS porte le nom de la fiche (${slugChunk.name}) — le contenu est encore compilé au lieu d'être servi comme actif`,
        );
      }
      return { id: content.id, file: content.file, chunk: null, chunks: chunksWithPayload };
    }

    if (main.text.includes(content.sentinels[0])) {
      violations.push(
        `${content.file} : le contenu est DANS le chunk principal (${main.name}) — import statique au lieu du chargement à la demande`,
      );
    }
    if (chunksWithPayload.length === 0) {
      violations.push(
        `${content.file} : contenu introuvable dans les chunks produits (le chargeur est-il branché ?)`,
      );
    }
    if (chunksWithPayload.length > 1) {
      violations.push(
        `${content.file} : contenu dupliqué dans ${chunksWithPayload.length} chunks (${chunksWithPayload.join(", ")}) — il est importé plusieurs fois`,
      );
    }
    if (chunksWithPayload.length === 1 && chunksWithPayload[0] === main.name) {
      violations.push(`${content.file} : le contenu est son propre chunk principal — découpage inopérant`);
    }
    return { id: content.id, file: content.file, chunk: chunksWithPayload[0] ?? main.name, chunks: chunksWithPayload };
  });

  // Identifiant de la démarche pilote : il doit rester hors du chunk initial.
  // (Il vit légitimement dans `catalog-*.js`, chargé par les pages qui lisent
  // le catalogue clinique — pas dans le chunk partagé du premier rendu.)
  if (main.text.includes("DX-THORAX-001")) {
    violations.push(
      `DX-THORAX-001 est remonté dans le chunk principal (${main.name}) : un module du graphe initial importe le catalogue clinique statiquement`,
    );
  }

  return { mainChunk: main.name, mainChunkBytes: main.bytes, placements, violations };
}

/* ------------------------------------------------------------------ */
/* 1. Garde-fou SOURCE — disponible même sans artefact de build        */
/* ------------------------------------------------------------------ */

async function sourceFiles(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "content" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(absolute)));
    else if (/\.(?:ts|tsx|mts|js|mjs|jsx)$/.test(entry.name)) out.push(absolute);
  }
  return out;
}

/** Échappe un nom de fichier pour l'utiliser dans une RegExp. */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("aucun module de src/ n'importe un contenu de cours (statique ou dynamique)", async () => {
  const contents = await loadContents();
  assert.ok(contents.length >= 1, "aucun contenu trouvé (pathologies / démarches)");

  // Les registres (`catalog.ts`) historiques restent les seuls points d'entrée
  // tolérés pour la famille encore chargée en module (démarches).
  const allowedRegistries = new Set(CONTENT_FAMILIES.map((family) => resolve(family.registry)));

  const offenders = [];
  for (const file of await sourceFiles(join(ROOT, "src"))) {
    const source = await readFile(file, "utf8");
    for (const content of contents) {
      if (!source.includes(content.file)) continue;
      if (content.servedAs === "module" && allowedRegistries.has(resolve(file))) continue;

      const name = escapeRegExp(content.file);
      // Import statique : `import x from "…/<file>.json"`.
      const staticImport = new RegExp(`import\\s+(?:[\\w*{][^;]*?from\\s+)?["'\`][^"'\`]*${name}["'\`]`);
      // Import dynamique : `import("…/<file>.json")` — interdit AUSSI pour les
      // actifs statiques : le bundle recompilerait la fiche en chunk JS.
      const dynamicImport = new RegExp(`import\\s*\\([^)]*${name}[^)]*\\)`);
      if (staticImport.test(source) || dynamicImport.test(source)) {
        offenders.push(`${file.replace(ROOT + "/", "")} importe ${content.file}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "un contenu de cours est importé en module JS par un fichier du graphe client.\n" +
      "Les fiches vivent dans private/content/pathologies/ et ne se lisent que côté serveur, " +
      "sous jeton — cf. SEC-PREM-1/SEC-PREM-6 dans docs/DECISIONS.md.\n" +
      offenders.join("\n"),
  );
});

test("le registre des fiches n'importe plus aucun JSON de contenu", async () => {
  const family = CONTENT_FAMILIES.find((entry) => entry.servedAs === "asset");
  const source = await readFile(family.registry, "utf8");
  const jsonImports = [...source.matchAll(/import\s*(?:\(|[^;]*?from)\s*["'][^"']*\.json["']/g)].map(
    (match) => match[0],
  );
  assert.deepEqual(
    jsonImports,
    [],
    `import de JSON dans catalog.ts : ${jsonImports.join(" | ")}\n` +
      "Les fiches sont des actifs statiques : seul le manifeste (module pur) reste en import.",
  );

  // Le manifeste garde le droit d'importer `_index.json` : c'est un index de
  // navigation, pas du contenu.
  const manifestSource = await readFile(join(ROOT, "src/lib/pathologies/manifest.ts"), "utf8");
  const manifestJsonImports = [...manifestSource.matchAll(/import\s+(\w+)\s+from\s+["'][^"']*\.json["']/g)];
  assert.equal(manifestJsonImports.length, 1, "manifest.ts doit importer exactement _index.json");
  assert.match(manifestJsonImports[0][0], /_index\.json/);
});

test("les fiches protégées vivent dans private/ et plus dans public/", async () => {
  const contents = await loadContents();
  const assets = contents.filter((content) => content.servedAs === "asset");
  assert.ok(assets.length >= 1, "aucune fiche protégée trouvée");

  assert.equal(
    existsSync(join(ROOT, "public/content/pathologies")),
    false,
    "public/content/pathologies/ existe encore : le CDN servirait les fiches sans jeton",
  );

  for (const asset of assets) {
    const absolute = join(ROOT, CONTENT_ASSET_PATH, asset.file);
    assert.ok(existsSync(absolute), `${asset.file}: actif absent de ${CONTENT_ASSET_PATH}/`);
    const raw = readFileSync(absolute, "utf8");
    assert.ok(
      asset.sentinels.every((sentinel) => raw.includes(sentinel)),
      `${asset.file}: l'actif publié ne contient pas le payload attendu`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* 2. Logique de détection — exercée sur des fixtures                   */
/* ------------------------------------------------------------------ */

test("la détection signale un actif statique compilé dans un chunk JS", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  writeFileSync(join(assets, "index-aaa.js"), `const main="${"x".repeat(4096)}";`);
  writeFileSync(join(assets, "fiche-bbb.js"), `const lazy=${JSON.stringify(sentinel)};`);

  const report = analyseAssets(assets, [
    { id: "fiche", file: "fiche.json", servedAs: "asset", sentinels: [sentinel] },
  ]);
  assert.ok(
    report.violations.some((violation) => violation.includes("actif statique présent")),
    `aucune violation détectée : ${JSON.stringify(report.violations)}`,
  );
});

test("la détection accepte un actif statique absent de tous les chunks", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  writeFileSync(join(assets, "index-aaa.js"), `const url="/content/pathologies/fiche.json";`);
  writeFileSync(join(assets, "route-bbb.js"), `const lazy=${"0".repeat(1024)};`);

  const report = analyseAssets(assets, [
    { id: "fiche", file: "fiche.json", servedAs: "asset", sentinels: [sentinel] },
  ]);
  assert.deepEqual(report.violations, [], report.violations.join("\n"));
  assert.equal(report.placements[0].chunk, null);
});

test("la détection signale un payload présent dans le chunk principal (contenu modularisé)", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  writeFileSync(join(assets, "index-aaa.js"), `const main=1;const leak=${JSON.stringify(sentinel)};`);
  writeFileSync(join(assets, "fiche-bbb.js"), `const lazy=${JSON.stringify(sentinel)};`);

  const report = analyseAssets(assets, [
    { id: "fiche", file: "fiche.json", servedAs: "module", sentinels: [sentinel] },
  ]);
  assert.ok(
    report.violations.some((violation) => violation.includes("DANS le chunk principal")),
    `aucune violation détectée : ${JSON.stringify(report.violations)}`,
  );
  assert.ok(report.violations.some((violation) => violation.includes("dupliqué")));
});

test("la détection accepte un contenu isolé dans son propre chunk (contenu modularisé)", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  // Le chunk principal est le plus gros : c'est la définition utilisée.
  writeFileSync(join(assets, "index-aaa.js"), `const main="${"x".repeat(4096)}";`);
  writeFileSync(join(assets, "paludisme-bbb.js"), `const lazy=${JSON.stringify(sentinel)};`);

  const report = analyseAssets(assets, [
    { id: "paludisme", file: "paludisme.json", servedAs: "module", sentinels: [sentinel] },
  ]);
  assert.deepEqual(report.violations, [], report.violations.join("\n"));
  assert.equal(report.placements[0].chunk, "paludisme-bbb.js");
});

/* ------------------------------------------------------------------ */
/* 3. Garde-fou ARTEFACT — après `npm run build`                        */
/* ------------------------------------------------------------------ */

const assetDirectory = findAssetDirectory(ROOT);
const staticDirectory = findStaticDirectory(ROOT);
const noBuild = !assetDirectory;
const noStatic = !staticDirectory;

test("le chunk principal ne contient aucun contenu et reste sous 700 Kio", { skip: noBuild }, async () => {
  const contents = await loadContents();
  const report = analyseAssets(assetDirectory, contents);

  assert.deepEqual(report.violations, [], report.violations.join("\n"));

  assert.ok(
    report.mainChunkBytes < MAX_MAIN_CHUNK_BYTES,
    `chunk principal ${report.mainChunk} : ${(report.mainChunkBytes / 1024).toFixed(1)} Kio ≥ 700 Kio`,
  );

  // Chaque contenu modularisé (démarches) garde SON chunk, distinct du principal.
  for (const placement of report.placements) {
    if (placement.chunk === null) continue;
    assert.notEqual(
      placement.chunk,
      report.mainChunk,
      `${placement.id} : contenu dans le chunk principal`,
    );
    assert.equal(placement.chunks.length, 1, `${placement.id} : contenu dans plusieurs chunks`);
  }
});

test(
  "AUCUNE fiche du contenu protégé n'est publiée dans le dossier statique",
  { skip: noStatic },
  async () => {
    const contents = await loadContents();
    const assets = contents.filter((content) => content.servedAs === "asset");
    assert.ok(assets.length >= 1, "aucune fiche protégée trouvée");

    // ⚠️ Le cœur de la session S1 : un fichier publié est servi par le CDN
    // AVANT tout code applicatif, donc sans jeton. On vérifie l'absence, pas la
    // présence — c'est l'inverse de l'ancienne assertion.
    const leakedDirectory = join(staticDirectory, "content/pathologies");
    if (existsSync(leakedDirectory)) {
      const leaked = readdirSync(leakedDirectory).filter(
        (name) => name.endsWith(".json") && name !== "_index.json",
      );
      assert.deepEqual(
        leaked,
        [],
        `${leaked.length} fiche(s) publiée(s) en clair (ex. ${leaked[0]}) dans ${leakedDirectory}`,
      );
    }

    // Et le contenu doit rester hors de TOUT chunk client (le worker les a).
    for (const asset of assets) {
      assert.ok(
        asset.sentinels.length > 0,
        `${asset.file}: aucun marqueur de payload exploitable`,
      );
    }
  },
);

test(
  "aucun chunk JS ne référence un actif de contenu comme module",
  { skip: noBuild },
  () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "src/content/data/pathologies/_index.json"), "utf8"),
    );

    // Un import de JSON laisserait dans le chunk une référence du type
    // `…/content/pathologies/<slug>.json` sans fetch — la seule forme
    // légitime est l'URL publique construite par `PATHOLOGY_ASSET_BASE`.
    const chunkFiles = readdirSync(assetDirectory).filter((name) => name.endsWith(".js"));
    const offenders = [];
    for (const file of chunkFiles) {
      const text = readFileSync(join(assetDirectory, file), "utf8");
      for (const entry of manifest.fiches) {
        if (text.includes(`content/pathologies/${entry.file}"`)) {
          offenders.push(`${file} : référence ${entry.file}`);
        }
      }
      if (/["'][^"']*\.json["']\s*\)/.test(text) && text.includes("content/pathologies")) {
        offenders.push(`${file} : import() de JSON sous content/pathologies`);
      }
    }
    assert.deepEqual(offenders, [], offenders.join("\n"));
  },
);

/* ------------------------------------------------------------------ */
/* LIMITATION ASSUMÉE                                                   */
/* ------------------------------------------------------------------ */

/*
 * Les DÉMARCHES enrichies (`src/content/data/demarches/*.json`) sont encore
 * importées statiquement par `src/lib/demarches/catalog.ts` : leur contenu vit
 * dans le chunk de la route `/demarche/$id`, jamais dans le chunk initial. Le
 * coût est borné (une démarche pilote), mais la même migration vers des actifs
 * statiques est la suite logique si le catalogue de démarches s'étoffe.
 */
