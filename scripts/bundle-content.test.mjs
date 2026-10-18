/* Garde-fou bundle du contenu de cours (Nosographie / démarches enrichies).

   POURQUOI CE TEST EXISTE
   Une fiche de nosographie pèse ~50 Kio minifiée et le référentiel compte
   240 items. Le contenu est donc chargé À LA DEMANDE (`loadPathologyContent`
   → `import()`), jamais importé statiquement. Si un futur agent ajoute
   `import palu from "@/content/data/pathologies/paludisme.json"` dans un
   composant monté au premier rendu, la fiche revient dans le chunk initial :
   le bundle grossit de 50 Kio PAR FICHE et plus personne ne le voit, parce
   que rien n'échoue — le build reste vert, la page s'affiche.

   CE QUE LE TEST VÉRIFIE
   1. SOURCE (toujours, sans build) : aucun fichier de `src/` n'importe
      statiquement un contenu ; hors du registre `catalog.ts` d'une famille,
      les contenus ne peuvent être atteints que par `import()` dynamique.
   2. LOGIQUE (fixture) : la détection « payload dans le chunk principal »
      est exercée sur un faux dossier d'assets, pour que le garde-fou soit
      testé même quand aucun build n'est disponible (job CI `test`).
   3. ARTEFACT (après `npm run build`) : le chunk principal fait moins de
      700 Kio, ne contient AUCUN payload de contenu, et chaque contenu vit
      dans exactement un chunk séparé (nommé d'après la fiche).

   ⚠️ NOTE SUR LES IDENTIFIANTS
   « DX-THORAX-001 » et « paludisme » apparaissent légitimement dans des
   MANIFESTES chargés en eager (`src/content/data/diagnostics.json`,
   `src/content/data/diagnostic-topics.json`,
   `src/content/data/pathologies/_index.json`) : ce sont des clés de
   navigation, pas du contenu. Un test qui exigerait l'absence de ces seules
   chaînes serait donc faux — et, pire, il passerait au vert alors qu'un
   agent aurait importé la fiche entière sous une autre forme. On vérifie
   donc le PAYLOAD (objectif rédigé, texte de source), ce qui est strictement
   plus fort. Le test vérifie aussi, explicitement, que l'identifiant
   `DX-THORAX-001` n'est pas remonté dans le chunk initial par un import
   statique du catalogue clinique.

   Le dossier d'assets dépend de la cible de déploiement : `.vercel/output/
   static/assets` (Vercel, cas courant ici), `.netlify/static/assets`,
   `.output/public/assets`, `dist/assets`. On réutilise la résolution déjà
   éprouvée par `scripts/performance-budget.mjs` pour ne pas en maintenir
   une deuxième. */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findAssetDirectory } from "./performance-budget.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Plafond du chunk principal demandé par le propriétaire (700 Kio). */
export const MAX_MAIN_CHUNK_BYTES = 700 * 1024;

/** Familles de contenu chargées à la demande. */
const CONTENT_FAMILIES = [
  {
    name: "fiches de nosographie",
    dir: join(ROOT, "src/content/data/pathologies"),
    /** Unique point d'entrée autorisé vers les fichiers de la famille. */
    registry: join(ROOT, "src/lib/pathologies/catalog.ts"),
    /** Exigence stricte : ce registre ne doit charger qu'en `import()`. */
    lazilyLoaded: true,
  },
  {
    name: "démarches enrichies",
    dir: join(ROOT, "src/content/data/demarches"),
    registry: join(ROOT, "src/lib/demarches/catalog.ts"),
    /**
     * Le registre des démarches importe encore son JSON statiquement : le
     * contenu atterrit dans le chunk de la route `/demarche/$id` (46 Kio), pas
     * dans le chunk initial. La règle stricte ne s'applique donc qu'aux fiches
     * — cf. LIMITATION en fin de fichier.
     */
    lazilyLoaded: false,
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
        lazilyLoaded: family.lazilyLoaded,
        file,
        id,
        sentinels: payloadSentinels(content),
        markdown: readFileSync(join(family.dir, file), "utf8"),
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
 * @param {{id: string, file: string, sentinels: string[]}[]} contents
 * @returns {{
 *   mainChunk: string,
 *   mainChunkBytes: number,
 *   placements: {id: string, chunk: string, chunks: string[]}[],
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
    const chunksWithPayload = chunks
      .filter((chunk) => content.sentinels.every((sentinel) => chunk.text.includes(sentinel)))
      .map((chunk) => chunk.name);

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
    return { id: content.id, chunk: chunksWithPayload[0] ?? main.name, chunks: chunksWithPayload };
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

test("aucun module de src/ n'importe statiquement un contenu de cours", async () => {
  const contents = await loadContents();
  assert.ok(contents.length >= 1, "aucun contenu trouvé dans src/content/data/{pathologies,demarches}");

  // Les registres (`catalog.ts`) sont le point d'entrée UNIQUE autorisé : ils
  // décident du découpage. Tout autre module doit passer par eux.
  const allowedRegistries = new Set(CONTENT_FAMILIES.map((family) => resolve(family.registry)));

  const offenders = [];
  for (const file of await sourceFiles(join(ROOT, "src"))) {
    if (allowedRegistries.has(resolve(file))) continue;
    const source = await readFile(file, "utf8");
    for (const content of contents) {
      if (!source.includes(content.file)) continue;
      // Import statique : `import x from "…/<file>.json"` (pas `import(`).
      const staticImport = new RegExp(
        `import\\s+(?:[\\w*{][^;]*?from\\s+)?["'\`][^"'\`]*${content.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`,
      );
      if (staticImport.test(source)) {
        offenders.push(`${file.replace(ROOT + "/", "")} importe statiquement ${content.file}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "un contenu de cours est importé statiquement : il reviendrait dans le bundle des pages concernées.\n" +
      "Utiliser le chargeur à la demande (import() dans catalog.ts) — cf. NOSO-2 dans docs/DECISIONS.md.\n" +
      offenders.join("\n"),
  );
});

test("le registre des fiches de nosographie ne charge les contenus que par import()", async () => {
  const family = CONTENT_FAMILIES.find((entry) => entry.lazilyLoaded);
  const source = await readFile(family.registry, "utf8");
  const staticJsonImports = [...source.matchAll(/import\s+(\w+)\s+from\s+["'][^"']*\.json["']/g)].map(
    (match) => match[0],
  );
  // Seul le manifeste `_index.json` a le droit d'être statique : il alimente
  // `/programme` sans télécharger de contenu.
  for (const statement of staticJsonImports) {
    assert.match(
      statement,
      /_index\.json/,
      `import statique de contenu dans catalog.ts : ${statement}\n` +
        "Chaque fiche doit passer par LOADERS et import().",
    );
  }
  assert.match(source, /import\(/, "catalog.ts doit garder au moins un import() de contenu");
});

/* ------------------------------------------------------------------ */
/* 2. Logique de détection — exercée sur une fixture                    */
/* ------------------------------------------------------------------ */

test("la détection signale un payload présent dans le chunk principal", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  writeFileSync(join(assets, "index-aaa.js"), `const main=1;const leak=${JSON.stringify(sentinel)};`);
  writeFileSync(join(assets, "fiche-bbb.js"), `const lazy=${JSON.stringify(sentinel)};`);
  writeFileSync(join(assets, "styles-ccc.css"), ".a{color:red}");

  const report = analyseAssets(assets, [{ id: "fiche", file: "fiche.json", sentinels: [sentinel] }]);
  assert.ok(
    report.violations.some((violation) => violation.includes("DANS le chunk principal")),
    `aucune violation détectée : ${JSON.stringify(report.violations)}`,
  );
  assert.ok(report.violations.some((violation) => violation.includes("dupliqué")));
});

test("la détection accepte un contenu isolé dans son propre chunk", () => {
  const root = mkdtempSync(join(tmpdir(), "optimus-bundle-"));
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  const sentinel = "Objectif rédigé de la fiche, suffisamment long pour être unique.";
  // Le chunk principal est le plus gros : c'est la définition utilisée.
  writeFileSync(join(assets, "index-aaa.js"), `const main="${"x".repeat(4096)}";`);
  writeFileSync(join(assets, "paludisme-bbb.js"), `const lazy=${JSON.stringify(sentinel)};`);

  const report = analyseAssets(assets, [{ id: "paludisme", file: "paludisme.json", sentinels: [sentinel] }]);
  assert.deepEqual(report.violations, [], report.violations.join("\n"));
  assert.equal(report.placements[0].chunk, "paludisme-bbb.js");
});

/* ------------------------------------------------------------------ */
/* 3. Garde-fou ARTEFACT — après `npm run build`                        */
/* ------------------------------------------------------------------ */

const assetDirectory = findAssetDirectory(ROOT);
const noBuild = !assetDirectory;

test("le chunk principal ne contient aucun contenu et reste sous 700 Kio", { skip: noBuild }, async () => {
  const contents = await loadContents();
  const report = analyseAssets(assetDirectory, contents);

  assert.deepEqual(report.violations, [], report.violations.join("\n"));

  assert.ok(
    report.mainChunkBytes < MAX_MAIN_CHUNK_BYTES,
    `chunk principal ${report.mainChunk} : ${(report.mainChunkBytes / 1024).toFixed(1)} Kio ≥ 700 Kio`,
  );

  // Chaque contenu doit avoir SON chunk, distinct du chunk principal.
  for (const placement of report.placements) {
    assert.notEqual(
      placement.chunk,
      report.mainChunk,
      `${placement.id} : contenu dans le chunk principal`,
    );
    assert.equal(placement.chunks.length, 1, `${placement.id} : contenu dans plusieurs chunks`);
  }

  // Les fiches se découpent par fichier : le chunk porte le nom du slug.
  for (const placement of report.placements) {
    if (!contents.find((content) => content.id === placement.id)?.lazilyLoaded) continue;
    assert.match(
      basename(placement.chunk),
      new RegExp(`^${placement.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[-.]`),
      `${placement.id} : chunk « ${placement.chunk} » non nommé d'après la fiche`,
    );
  }
});
