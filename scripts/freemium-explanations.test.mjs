/**
 * Modèle freemium (chantier 1) — l'explication des decks gratuits ne quitte
 * jamais le serveur, et les projections publiques versionnées ne fuient rien.
 *
 * Garde-fous :
 *  1. `publicDeck` : un deck gratuit garde `correct` (correction immédiate)
 *     mais perd `explanation` ; un deck Pro n'expose aucune question.
 *  2. Les artefacts versionnés `public/data/*.json` sont des PROJECTIONS :
 *     aucune clé `explanation` côté decks, aucun dossier complet côté cas Pro,
 *     aucune grille côté démarches. (Régression §1 détectée le 2026-11-11 :
 *     les copies versionnées étaient restées brutes.)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  projectRoot,
  publicClinicalCase,
  publicDeck,
  publicDiagnostic,
  syncCatalogData,
} from "./sync-catalog-data.mjs";

// Les projections publiques sont GÉNÉRÉES (gitignore) : on les régénère ici
// depuis la source gelée, puis on vérifie qu'elles ne fuient rien.
syncCatalogData({ log: () => {} });

const readJson = (name) => JSON.parse(readFileSync(join(projectRoot(), "public", "data", name), "utf8"));

test("publicDeck : un deck gratuit garde correct mais perd explanation", () => {
  const free = {
    id: "anatomie",
    access_policy: { tier: "free", entitlement: "OPTIMUS_FREE" },
    questions: [
      { id: "an-1", prompt: "Q ?", choices: ["A", "B"], correct: 0, explanation: "Pourquoi." },
      { id: "an-2", prompt: "Q2 ?", choices: ["A", "B"], correct: 1, explanation: "Pourquoi 2." },
    ],
  };
  const projected = publicDeck(free);
  assert.equal(projected.questions.length, 2);
  for (const question of projected.questions) {
    assert.equal(typeof question.correct, "number", "la grille de correction reste locale");
    assert.equal("explanation" in question, false, "l'explication est retirée");
  }
  // Le reste de la question est intact.
  assert.equal(projected.questions[0].prompt, "Q ?");
  assert.deepEqual(projected.questions[0].choices, ["A", "B"]);
});

test("publicDeck : un deck Pro n'expose aucune question, seulement le compteur", () => {
  const pro = {
    id: "cardio",
    access_policy: { tier: "pro", entitlement: "URGENCES_PACK_15" },
    questions: [
      { id: "ca-1", correct: 2, explanation: "Grille Pro." },
      { id: "ca-2", correct: 0, explanation: "Grille Pro 2." },
    ],
  };
  const projected = publicDeck(pro);
  assert.deepEqual(projected.questions, []);
  assert.equal(projected.questionCount, 2);
  assert.equal("correct" in (projected.questions[0] ?? {}), false);
});

test("publicDeck : entrée sans questions (déjà projetée) inchangée", () => {
  const card = { id: "x", access_policy: { tier: "free" }, questions: [] };
  assert.deepEqual(publicDeck(card), card);
});

test("publicClinicalCase : un cas Pro ne garde que le teaser", () => {
  const pro = {
    id: "CARDIO-FA-001",
    title: "Cœur irrégulier",
    specialty: "Cardiologie",
    studyYear: 5,
    difficulty: "advanced",
    summary: "Résumé.",
    patient: { age: 78 },
    steps: [{ kind: "question", correct: 2, explanation: "Grille." }],
    diagnosis: "FA",
    management: "PEC",
    pitfall: "Piège",
    keyTakeaway: "À retenir",
    access: "pro",
  };
  const projected = publicClinicalCase(pro);
  assert.deepEqual(Object.keys(projected).sort(), [
    "access", "difficulty", "id", "related", "specialty", "studyYear", "summary", "title",
  ].sort());
});

test("publicClinicalCase : un cas gratuit reste entier", () => {
  const free = { id: "CAS-FREE", access: "free", steps: [{ kind: "reveal" }], diagnosis: "D" };
  assert.deepEqual(publicClinicalCase(free), free);
});

test("publicDiagnostic : une démarche ne garde que la vignette", () => {
  const projected = publicDiagnostic({
    id: "DX-THORAX-001",
    title: "Douleur thoracique",
    specialty: "Urgences",
    vignette: "Vignette.",
    steps: [{ correct: 1, explanation: "Grille." }],
    synthesis: "Synthèse.",
  });
  assert.deepEqual(Object.keys(projected).sort(), ["id", "specialty", "title", "vignette"]);
});

test("public/data/decks.json généré : aucune explication, grille gratuite intacte", () => {
  const decks = readJson("decks.json");
  assert.ok(Array.isArray(decks) && decks.length > 0);
  for (const deck of decks) {
    const tier = deck.access_policy?.tier;
    if (tier === "pro") {
      assert.deepEqual(deck.questions, [], `deck Pro ${deck.id} : aucune question publique`);
      assert.equal(typeof deck.questionCount, "number");
    } else {
      assert.ok(Array.isArray(deck.questions) && deck.questions.length > 0, `deck gratuit ${deck.id} : questions publiques`);
      for (const question of deck.questions) {
        assert.equal(typeof question.correct, "number", `deck gratuit ${deck.id}/${question.id} : correction locale`);
        assert.equal("explanation" in question, false, `deck gratuit ${deck.id}/${question.id} : explication verrouillée`);
      }
    }
  }
});

test("public/data/cases.json généré : les cas Pro sont des teasers", () => {
  const cases = readJson("cases.json");
  for (const item of cases) {
    if (item.access === "pro") {
      for (const forbidden of ["patient", "steps", "diagnosis", "management", "pitfall", "keyTakeaway"]) {
        assert.equal(forbidden in item, false, `cas Pro ${item.id} : champ ${forbidden} absent`);
      }
    }
  }
});

test("public/data/diagnostics.json généré : vignettes seules", () => {
  const diagnostics = readJson("diagnostics.json");
  assert.ok(Array.isArray(diagnostics) && diagnostics.length > 0);
  const allowed = new Set(["id", "title", "specialty", "vignette"]);
  for (const item of diagnostics) {
    for (const key of Object.keys(item)) {
      assert.ok(allowed.has(key), `démarche ${item.id} : champ public inattendu ${key}`);
    }
    assert.equal("steps" in item, false, `démarche ${item.id} : aucune étape publique`);
  }
});
