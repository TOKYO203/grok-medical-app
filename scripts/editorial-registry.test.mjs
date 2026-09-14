import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const [decks, registry] = await Promise.all([
  readJson("../src/content/data/decks.json"),
  readJson("../src/content/data/editorial-registry.json"),
]);

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (value) => new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2));

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label}: doublon détecté`);
}

test("every published Deck has one stable editorial landmark", () => {
  assert.equal(registry.schema_version, 1);
  assert.equal(registry.overlap_policy.default, "forbidden");
  assert.equal(registry.decks.length, decks.length);

  unique(registry.decks.map((deck) => deck.deck_id), "deck_id éditorial");
  unique(registry.decks.map((deck) => deck.editorial_id), "editorial_id");
  unique(registry.decks.map((deck) => deck.question_namespace), "namespace de question");

  for (const deck of decks) {
    const entry = registry.decks.find((candidate) => candidate.deck_id === deck.id);
    assert.ok(entry, `${deck.id}: repère éditorial absent`);
    assert.match(entry.editorial_id, /^[A-Z]{3}-D\d{2}$/);
    assert.ok(entry.scope.trim().length >= 24, `${deck.id}: périmètre éditorial trop vague`);
    assert.ok(entry.next_question_number > 0, `${deck.id}: prochain numéro invalide`);
    assert.ok(
      deck.questions.every((question) => question.id.startsWith(`${entry.question_namespace}-`)),
      `${deck.id}: une question sort de son namespace ${entry.question_namespace}`,
    );
  }
});

test("future Deck numbers remain sequential inside each collection", () => {
  const groups = Map.groupBy(registry.decks, (deck) => deck.code);
  for (const [code, entries] of groups) {
    const sequences = entries.map((entry) => entry.sequence).sort((a, b) => a - b);
    unique(sequences, `${code}/séquences`);
    assert.deepEqual(
      sequences,
      Array.from({ length: sequences.length }, (_, index) => index + 1),
      `${code}: séquence de Deck interrompue`,
    );
  }
});

test("questions cannot silently duplicate another Deck", () => {
  const questions = decks.flatMap((deck) =>
    deck.questions.map((question) => ({ ...question, ref: `${deck.id}/${question.id}`, deck: deck.id })),
  );
  const declaredPairs = new Set(
    registry.declared_overlaps.flatMap((overlap) => [
      `${overlap.canonical_question}|${overlap.related_question}`,
      `${overlap.related_question}|${overlap.canonical_question}`,
    ]),
  );

  for (let left = 0; left < questions.length; left += 1) {
    for (let right = left + 1; right < questions.length; right += 1) {
      const a = questions[left];
      const b = questions[right];
      if (a.deck === b.deck) continue;
      const score = similarity(a.prompt, b.prompt);
      if (score < 0.72) continue;
      assert.ok(
        declaredPairs.has(`${a.ref}|${b.ref}`),
        `${a.ref} répète probablement ${b.ref} (${Math.round(score * 100)} %): déclarer l'angle pédagogique ou réécrire`,
      );
      assert.notEqual(
        normalize(a.prompt),
        normalize(b.prompt),
        `${a.ref} et ${b.ref}: un chevauchement déclaré doit apporter une question différente`,
      );
    }
  }
});

test("declared overlaps are explicit, valid and pedagogically differentiated", () => {
  const refs = new Set(
    decks.flatMap((deck) => deck.questions.map((question) => `${deck.id}/${question.id}`)),
  );
  const allowedRoles = new Set(registry.overlap_policy.allowed_roles);
  for (const overlap of registry.declared_overlaps) {
    assert.match(overlap.concept_id, /^[A-Z][A-Z0-9-]+$/);
    assert.ok(refs.has(overlap.canonical_question), `${overlap.canonical_question}: question canonique absente`);
    assert.ok(refs.has(overlap.related_question), `${overlap.related_question}: question associée absente`);
    assert.ok(allowedRoles.has(overlap.role), `${overlap.concept_id}: rôle de répétition invalide`);
    assert.ok(overlap.distinction.trim().length >= 32, `${overlap.concept_id}: distinction trop vague`);
  }
});
