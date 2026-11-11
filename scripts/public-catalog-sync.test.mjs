import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { projectRoot, syncCatalogData } from "./sync-catalog-data.mjs";

/**
 * `public/data/*.json` est un DÉRIVÉ de `src/content/data/*.json`, servi à
 * l'app par fetch("/data/…") — cf. src/content/catalog.ts. Un retard de la
 * copie publique sur la source affiche des chapitres « En préparation » en
 * production alors que le contenu existe : c'est le bug du lot des 43
 * démarches (source à 245 Ko / 43 cas, copie publique restée à ~6 cas).
 * Ce test verrouille le contrat du resynchroniseur, sur des espaces de
 * travail temporaires : la suite ne doit jamais réécrire le check-out.
 *
 * ⚠️ `decks.json` et `cases.json` sont des cas à part depuis les correctifs du
 * pentest : ils ne sont pas recopiés tels quels mais SPLITÉS (index public sans
 * le contenu fermé + actifs dans `private/content/`). Les contrats sont testés
 * séparément, exprès : un deck premium ou un dossier fermé publié en clair est
 * le défaut qu'on cherche à rendre impossible.
 */
const COPIED_CATALOGS = ["diagnostics.json"];
const SPLIT_CATALOGS = ["decks.json", "cases.json"];
const CATALOGS = [...SPLIT_CATALOGS, ...COPIED_CATALOGS];

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "catalog-sync-"));
  const srcDir = join(root, "src", "content", "data");
  const destDir = join(root, "public", "data");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(destDir, { recursive: true });
  for (const name of CATALOGS) {
    const source = join(projectRoot(), "src", "content", "data", name);
    writeFileSync(join(srcDir, name), readFileSync(source, "utf8"));
  }
  return { root, srcDir, destDir };
}

test("resynchronise une copie publique périmée depuis la source", () => {
  const { root, srcDir, destDir } = makeWorkspace();
  // Copies publiques volontairement périmées : un préfixe de la source.
  for (const name of CATALOGS) {
    const text = readFileSync(join(srcDir, name), "utf8");
    writeFileSync(join(destDir, name), text.slice(0, Math.floor(text.length / 2)));
  }

  const synced = syncCatalogData({ root });
  assert.deepEqual(synced.sort(), [...CATALOGS].sort());

  // Cas / démarches : copie à l'octet.
  for (const name of COPIED_CATALOGS) {
    assert.equal(
      readFileSync(join(destDir, name), "utf8"),
      readFileSync(join(srcDir, name), "utf8"),
      `${name} doit être resynchronisé octet pour octet`,
    );
    // Écriture atomique : aucun fichier temporaire ne traîne à côté de la copie.
    assert.equal(existsSync(`${join(destDir, name)}.catalog-sync-tmp`), false);
  }

  // Decks : index SANS les questions premium + actifs protégés.
  const published = JSON.parse(readFileSync(join(destDir, "decks.json"), "utf8"));
  const leaked = published.filter(
    (deck) => (deck.access_policy?.tier ?? "free") !== "free" && deck.questions.length > 0,
  );
  assert.deepEqual(leaked.map((deck) => deck.id), [], "questions premium publiées par le sync");
  assert.ok(
    existsSync(join(root, "private", "content", "decks")),
    "les actifs protégés doivent être écrits par le sync",
  );

  // Cas : index en TEASER + dossiers protégés.
  const publishedCases = JSON.parse(readFileSync(join(destDir, "cases.json"), "utf8"));
  const leakedCases = publishedCases.filter(
    (clinical) =>
      (clinical.access ?? "pro") !== "free" &&
      ((clinical.steps?.length ?? 0) > 0 || clinical.diagnosis !== undefined),
  );
  assert.deepEqual(leakedCases.map((clinical) => clinical.id), [], "dossiers fermés publiés par le sync");
  assert.ok(
    existsSync(join(root, "private", "content", "cases")),
    "les dossiers protégés doivent être écrits par le sync",
  );
});

test("est idempotent : une copie à jour n'est pas réécrite", () => {
  const { root } = makeWorkspace();
  // Première passe : la copie publique brute de la source doit être splitée.
  syncCatalogData({ root });
  assert.deepEqual(syncCatalogData({ root }), []);
});

test("préserve la copie quand la source est absente (repli explicite)", () => {
  const { root, destDir } = makeWorkspace();
  syncCatalogData({ root });
  const before = readFileSync(join(destDir, "diagnostics.json"), "utf8");
  assert.deepEqual(syncCatalogData({ root: join(root, "absent") }), []);
  assert.equal(readFileSync(join(destDir, "diagnostics.json"), "utf8"), before);
});
