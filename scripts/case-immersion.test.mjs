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


const storeSource = await readFile(new URL("../src/state/store.ts", import.meta.url), "utf8");
const migrationsSource = await readFile(
  new URL("../src/state/persist-migrations.ts", import.meta.url),
  "utf8",
);
const casListSource = await readFile(new URL("../src/routes/cas.tsx", import.meta.url), "utf8");

test("la reprise de dossier et l'historique des hypothèses sont persistés", () => {
  for (const anchor of [
    "caseSessions",
    "caseHypotheses",
    "saveCaseSession",
    "recordCaseHypothesis",
    "restoreCaseSessions",
    "restoreCaseHypotheses",
  ]) {
    assert.ok(storeSource.includes(anchor), "store.ts: " + anchor + " manquant");
  }
  for (const anchor of [
    "caseSessions",
    "caseHypotheses",
  ]) {
    assert.ok(migrationsSource.includes(anchor), "persist-migrations.ts: " + anchor + " manquant");
  }
  assert.ok(
    migrationsSource.includes("OPTIMUS_PERSIST_VERSION = 5"),
    "persist-migrations.ts: version 5 attendue pour la persistance des cas",
  );
});

test("la route reprend la session et archive les hypothèses engagées", () => {
  for (const anchor of [
    "data-case-resume",
    "data-case-hypotheses",
    "saveCaseSession",
    "recordCaseHypothesis",
    "caseHypotheses",
    "commitHypothesis",
  ]) {
    assert.ok(caseRouteSource.includes(anchor), "cas.$caseId.tsx: " + anchor + " manquant");
  }
  assert.ok(
    casListSource.includes("data-cas-resume"),
    "cas.tsx: bannière « Reprendre » manquante",
  );
});

test("l'évaluation des hypothèses alimente les stats de calibration", () => {
  for (const anchor of ["assessCaseHypothesis", "CaseHypothesisOutcome"]) {
    assert.ok(storeSource.includes(anchor), "store.ts: " + anchor + " manquant");
  }
  for (const anchor of ["data-case-assessment", "assessCaseHypothesis"]) {
    assert.ok(caseRouteSource.includes(anchor), "cas.$caseId.tsx: " + anchor + " manquant");
  }
  assert.ok(
    casListSource.includes("data-cas-calibration"),
    "cas.tsx: section « Votre calibration » manquante",
  );
});

test("la structure des dossiers reste intègre (invariants d'immersion)", () => {
  for (const clinical of cases) {
    assert.ok(
      clinical.patient && typeof clinical.patient.age === "number",
      clinical.id + ": patient manquant",
    );
    assert.ok(clinical.steps.length >= 5, clinical.id + ": moins de 5 étapes");
    const reveals = clinical.steps.filter((step) => step.kind === "reveal");
    const questions = clinical.steps.filter((step) => step.kind === "question");
    for (const step of reveals) {
      assert.ok(step.title?.trim(), clinical.id + ": reveal sans titre");
      assert.ok(
        step.body?.trim().length >= 40,
        clinical.id + ": reveal sans corps (40 caractères minimum)",
      );
    }
    assert.ok(questions.length >= 3, clinical.id + ": moins de 3 questions");
    for (const step of questions) {
      assert.ok(step.choices?.length >= 3, clinical.id + ": moins de 3 choix");
      assert.ok(
        typeof step.correct === "number" &&
          step.correct >= 0 &&
          step.correct < step.choices.length,
        clinical.id + ": index de réponse invalide",
      );
      assert.ok(
        step.explanation?.trim().length >= 40,
        clinical.id + ": explication trop courte (40 caractères minimum)",
      );
    }
    assert.ok(
      clinical.diagnosis?.trim().length >= 30,
      clinical.id + ": diagnostic trop court (30 caractères minimum)",
    );
    assert.ok(
      clinical.management?.trim().length >= 40,
      clinical.id + ": prise en charge trop courte (40 caractères minimum)",
    );
    assert.ok(clinical.sources?.length >= 1, clinical.id + ": aucune source");
  }
});
