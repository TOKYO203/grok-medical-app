#!/usr/bin/env node
/**
 * Garde-fou du pentest 2026-11-09 §1/§14/§15 : l'artefact PUBLIC ne doit
 * contenir AUCUN contenu Premium en clair. Le test rejoue la génération sur
 * un workspace tmp à partir de la VRAIE source (src/content/data), puis
 * vérifie :
 *   1. les projections publiques ne portent ni questions Pro, ni dossier
 *      clinique Pro, ni stepper/synthèse de démarche ;
 *   2. chaque item a son actif privé COMPLET (servi sous jeton) ;
 *   3. le code source embarque bien le garde (fetchWithAuth + jeton d'essai,
 *      familles protégées) — sinon la fuite reviendrait par le client ;
 *   4. si un dossier de build existe, les fiches de démarches en ont été
 *      retirées (scripts/strip-demarches-from-dist.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncCatalogData } from "./sync-catalog-data.mjs";
import { DIST_CANDIDATES, stripDemarchesFromDist } from "./strip-demarches-from-dist.mjs";

const CHECKOUT = join(fileURLToPath(import.meta.url), "..", "..");
const CATALOGS = ["decks.json", "cases.json", "diagnostics.json"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readSource = (path) => readFileSync(join(CHECKOUT, path), "utf8");

/** Workspace tmp alimenté par la source RÉELLE du check-out. */
function makeWorkspaceFromRealSource() {
  const root = mkdtempSync(join(tmpdir(), "content-leak-"));
  const srcDir = join(root, "src", "content", "data");
  mkdirSync(srcDir, { recursive: true });
  for (const name of CATALOGS) {
    writeFileSync(join(srcDir, name), readSource(join("src", "content", "data", name)));
  }
  return root;
}

test("les projections publiques issues de la vraie source ne fuient aucun contenu Premium", () => {
  const root = makeWorkspaceFromRealSource();
  try {
    syncCatalogData({ root });
    const decks = readJson(join(root, "public", "data", "decks.json"));
    const cases = readJson(join(root, "public", "data", "cases.json"));
    const diagnostics = readJson(join(root, "public", "data", "diagnostics.json"));

    // §1 — decks Pro : questions retirées, compteur porté, actif privé complet.
    for (const deck of decks) {
      const isPro = deck.access_policy?.tier === "pro";
      if (!isPro) continue;
      assert.equal(deck.questions.length, 0, `deck Pro ${deck.id} : questions en clair dans public/data`);
      const asset = readJson(join(root, "private", "content", "decks", `${deck.id}.json`));
      assert.ok(Array.isArray(asset.questions) && asset.questions.length > 0, `actif privé manquant/vide : ${deck.id}`);
      assert.equal(deck.questionCount, asset.questions.length, `questionCount incohérent : ${deck.id}`);
    }

    // §14 — cas cliniques Pro : dossier complet uniquement côté privé.
    for (const item of cases) {
      if (item.access !== "pro") continue;
      for (const field of ["patient", "steps", "diagnosis", "management", "pitfall", "keyTakeaway"]) {
        assert.equal(item[field], undefined, `cas Pro ${item.id} : ${field} en clair dans public/data`);
      }
      const asset = readJson(join(root, "private", "content", "cases", `${item.id}.json`));
      assert.ok(Array.isArray(asset.steps) && asset.steps.length > 0, `actif privé manquant : cas ${item.id}`);
      assert.equal(typeof asset.diagnosis, "string", `diagnosis absent de l'actif privé : ${item.id}`);
    }

    // §15 — démarches : ni stepper ni synthèse en public, actif complet privé.
    for (const item of diagnostics) {
      assert.equal(item.steps, undefined, `démarche ${item.id} : steps en clair dans public/data`);
      assert.equal(item.synthesis, undefined, `démarche ${item.id} : synthesis en clair dans public/data`);
      const asset = readJson(join(root, "private", "content", "diagnostics", `${item.id}.json`));
      assert.ok(Array.isArray(asset.steps) && asset.steps.length > 0, `actif privé manquant : démarche ${item.id}`);
      assert.equal(typeof asset.synthesis, "string", `synthesis absente de l'actif privé : ${item.id}`);
    }
  } finally {
    rmSync(join(root, "src"), { recursive: true, force: true });
    rmSync(join(root, "public"), { recursive: true, force: true });
    rmSync(join(root, "private"), { recursive: true, force: true });
  }
});

test("le client charge le contenu Premium derrière le garde, avec repli jeton d'essai", () => {
  const catalog = readSource("src/content/catalog.ts");
  assert.ok(catalog.includes("fetchWithAuth"), "catalog.ts doit joindre le jeton via fetchWithAuth");
  assert.ok(catalog.includes("requestTrialToken"), "catalog.ts doit prévoir le repli jeton d'essai");
  assert.ok(catalog.includes("/content/decks/_catalog.json"), "catalog.ts doit viser le catalogue groupé des decks");

  const demarches = readSource("src/lib/demarches/catalog.ts");
  assert.ok(demarches.includes("fetchWithAuth"), "demarches/catalog.ts doit joindre le jeton via fetchWithAuth");

  const guard = readSource("src/lib/content/protected-assets.server.ts");
  for (const family of ["pathologies", "signes", "decks", "cases", "diagnostics", "demarches"]) {
    assert.ok(guard.includes(family), `protected-assets.server.ts doit couvrir la famille ${family}`);
  }
});

test("importer le module de sync ne réécrit pas le dépôt", () => {
  // Incident 2026-11-27 : le garde d'exécution directe comparait le module à
  // `<cwd>/scripts/sync-catalog-data.mjs`, donc il était vrai à CHAQUE import
  // lancé depuis la racine — la suite de tests réécrivait les catalogues du
  // dépôt en parallèle, d'où des échecs intermittents.
  const src = readSource("scripts/sync-catalog-data.mjs");
  assert.ok(
    src.includes("resolve(process.argv[1]) === fileURLToPath(import.meta.url)"),
    "le garde doit comparer process.argv[1] au module",
  );
  assert.ok(
    !src.includes('join(process.cwd(), "scripts", "sync-catalog-data.mjs")'),
    "comparer à cwd rend le garde vrai à chaque import",
  );
});

test("le nettoyage du build retire les fiches de démarches et garde le manifeste", () => {
  // Hermétique : on fabrique un faux artefact dans un dossier temporaire. Le
  // test ne dépend plus de la présence d'un `dist/` ou `.output/` local, donc
  // il ne se « saute » plus silencieusement sur une machine propre (ligne CI-3).
  const root = mkdtempSync(join(tmpdir(), "strip-dist-"));
  try {
    const dir = join(root, "dist", "content", "demarches");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "_index.json"), "{}");
    writeFileSync(join(dir, "fiche-a.json"), "{}");
    writeFileSync(join(dir, "fiche-b.json"), "{}");

    assert.equal(stripDemarchesFromDist({ root }), 2, "les deux fiches doivent être retirées");
    assert.deepEqual(readdirSync(dir), ["_index.json"], "seul le manifeste public reste");

    // Idempotence : rejouer le nettoyage ne doit rien casser ni rien compter.
    assert.equal(stripDemarchesFromDist({ root }), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("le nettoyage couvre les trois sorties de build (Vite, Nitro, Nitro public)", () => {
  assert.deepEqual(DIST_CANDIDATES, ["dist", ".output/public", ".output"]);
});
