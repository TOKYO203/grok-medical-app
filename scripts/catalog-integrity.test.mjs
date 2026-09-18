import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readCatalog = async (name) =>
  JSON.parse(await readFile(new URL(`../src/content/data/${name}.json`, import.meta.url), "utf8"));

const [decks, cases, diagnostics] = await Promise.all([
  readCatalog("decks"),
  readCatalog("cases"),
  readCatalog("diagnostics"),
]);

const COMPETENCIES = new Set([
  "recognize",
  "semiology",
  "diagnostic_orientation",
  "diagnosis",
  "management",
  "clinical_reasoning",
]);

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label}: doublon détecté`);
}

function assertQuestion(question, context) {
  assert.ok(question && typeof question === "object", `${context}: question absente`);
  assert.ok(question.prompt?.trim().length >= 8, `${context}: énoncé trop court`);
  assert.ok(Array.isArray(question.choices), `${context}: choix absents`);
  assert.ok(
    question.choices.length >= 2 && question.choices.length <= 6,
    `${context}: le nombre de choix doit être compris entre 2 et 6`,
  );
  assert.ok(
    question.choices.every((choice) => typeof choice === "string" && choice.trim()),
    `${context}: choix vide`,
  );
  assertUnique(
    question.choices.map((choice) => choice.trim().toLocaleLowerCase("fr")),
    `${context}/choix`,
  );
  assert.ok(Number.isInteger(question.correct), `${context}: index correct non entier`);
  assert.ok(
    question.correct >= 0 && question.correct < question.choices.length,
    `${context}: index correct hors limites`,
  );
  assert.ok(question.explanation?.trim().length >= 8, `${context}: explication trop courte`);
}

function assertSource(source, context) {
  assert.ok(source.title?.trim(), `${context}: titre de source absent`);
  assert.ok(source.citation?.trim(), `${context}: citation absente`);
  if (source.url) {
    assert.match(source.url, /^https:\/\//, `${context}: URL non HTTPS`);
  }
  if (source.doi) {
    assert.match(source.doi, /^10\.\d{4,9}\/[\w.()/:;-]+$/i, `${context}: DOI invalide`);
  }
  if (source.verifiedAt) {
    assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${context}: date invalide`);
    assert.ok(!Number.isNaN(Date.parse(`${source.verifiedAt}T00:00:00Z`)), `${context}: date impossible`);
  }
}

test("catalog identifiers, schemas and access policies remain coherent", () => {
  assertUnique(decks.map((deck) => deck.id), "decks");
  assertUnique(cases.map((clinical) => clinical.id), "cas cliniques");
  assertUnique(diagnostics.map((diagnostic) => diagnostic.id), "démarches");

  for (const deck of decks) {
    assert.match(deck.id, /^[a-z0-9][a-z0-9-]*$/, `${deck.id}: identifiant invalide`);
    assert.equal(deck.deck_id, deck.id, `${deck.id}: deck_id divergent`);
    assert.equal(deck.schema_version ?? deck.schemaVersion, 2, `${deck.id}: schéma non pris en charge`);
    assert.match(deck.version, /^\d+\.\d+\.\d+$/, `${deck.id}: version non sémantique`);
    assert.ok(deck.studyYear >= 1 && deck.studyYear <= 6, `${deck.id}: année d'étude invalide`);
    assert.ok(["free", "pro"].includes(deck.access_policy?.tier), `${deck.id}: accès invalide`);
    assert.match(
      deck.access_policy?.entitlement ?? "",
      /^[A-Z][A-Z0-9_]{2,63}$/,
      `${deck.id}: produit invalide`,
    );
    if (deck.access_policy.tier === "free") {
      assert.equal(deck.access_policy.entitlement, "OPTIMUS_FREE", `${deck.id}: accès gratuit incohérent`);
    } else {
      assert.notEqual(deck.access_policy.entitlement, "OPTIMUS_FREE", `${deck.id}: accès Pro incohérent`);
    }
  }
});

test("every interactive answer remains valid and unambiguous", () => {
  for (const deck of decks) {
    assertUnique(deck.questions.map((question) => question.id), `${deck.id}/questions`);
    for (const question of deck.questions) {
      assertQuestion(question, `${deck.id}/${question.id}`);
      assert.ok(COMPETENCIES.has(question.competency), `${deck.id}/${question.id}: compétence invalide`);
    }
  }
  for (const clinical of cases) {
    clinical.steps.forEach((step, index) => {
      if (step.kind === "question") assertQuestion(step, `${clinical.id}/étape-${index + 1}`);
    });
  }
  for (const diagnostic of diagnostics) {
    assertUnique(diagnostic.steps.map((step) => step.id), `${diagnostic.id}/étapes`);
    diagnostic.steps.forEach((step) => assertQuestion(step, `${diagnostic.id}/${step.id}`));
  }
});

test("medical sources keep valid, transport-safe metadata", () => {
  for (const deck of decks) {
    assert.ok(deck.sources.length > 0, `${deck.id}: sources générales absentes`);
    deck.sources.forEach((source, index) => assertSource(source, `${deck.id}/source-${index + 1}`));
    for (const question of deck.questions) {
      assert.ok(question.sources.length > 0, `${deck.id}/${question.id}: source absente`);
      question.sources.forEach((source, index) =>
        assertSource(source, `${deck.id}/${question.id}/source-${index + 1}`),
      );
    }
  }
  for (const clinical of cases) {
    assert.ok(clinical.sources.length > 0, `${clinical.id}: source absente`);
    clinical.sources.forEach((source, index) =>
      assertSource(source, `${clinical.id}/source-${index + 1}`),
    );
  }
});
