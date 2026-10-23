import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../src/content/data/${path}.json`, import.meta.url), "utf8"));

const [cases, pathologiesIndex, decks] = await Promise.all([
  readJson("cases"),
  readJson("pathologies/_index"),
  readJson("decks"),
]);

const caseRouteSource = await readFile(
  new URL("../src/routes/cas.$caseId.tsx", import.meta.url),
  "utf8",
);

const availablePathologySlugs = new Set(
  pathologiesIndex.fiches
    .filter((entry) => entry.status === "available")
    .map((entry) => entry.slug),
);
const availableDeckIds = new Set(decks.map((deck) => deck.id));

test("chaque dossier expose un piège classique et une clé à retenir", () => {
  for (const clinical of cases) {
    assert.ok(
      clinical.pitfall?.trim().length >= 40,
      clinical.id + ": piège classique absent ou trop court",
    );
    assert.ok(
      clinical.keyTakeaway?.trim().length >= 40,
      clinical.id + ": clé à retenir absente ou trop courte",
    );
  }
});

test("le maillage « Approfondir » ne pointe que vers des contenus publiés", () => {
  for (const clinical of cases) {
    for (const slug of clinical.related?.pathologySlugs ?? []) {
      assert.ok(
        availablePathologySlugs.has(slug),
        clinical.id + ": fiche " + slug + " absente du manifeste des fiches disponibles",
      );
    }
    for (const deckId of clinical.related?.deckIds ?? []) {
      assert.ok(
        availableDeckIds.has(deckId),
        clinical.id + ": deck " + deckId + " introuvable dans le catalogue intégré",
      );
    }
  }
});

test("la route sert la prédiction, le débrief enrichi et le maillage", () => {
  for (const anchor of [
    "data-case-prediction",
    "data-case-pitfall",
    "data-case-takeaway",
    "data-case-hypothesis-recap",
    "data-case-related",
    "clinical.pitfall",
    "clinical.keyTakeaway",
    "pathologyEntry",
    "getBuiltinDeck",
  ]) {
    assert.ok(caseRouteSource.includes(anchor), "cas.$caseId.tsx: " + anchor + " manquant");
  }
});
