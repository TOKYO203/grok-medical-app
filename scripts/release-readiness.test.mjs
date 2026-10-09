import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [decksRaw, registryRaw, packageRaw, routes] = await Promise.all([
  read("../src/content/data/decks.json"),
  read("../src/content/data/editorial-registry.json"),
  read("../package.json"),
  Promise.all(["soutenir.tsx", "pro.tsx", "achats.tsx", "import.tsx"].map((path) => read(`../src/routes/${path}`))),
]);

const decks = JSON.parse(decksRaw);
const registry = JSON.parse(registryRaw);
const pkg = JSON.parse(packageRaw);

// Le socle V1 = les Decks qui portent un découpage en chapitres (les spirales
// cardio/neuro ajoutées ensuite n'en ont pas : elles ne sont pas « V1 »).
const v1Decks = decks.filter((deck) => Array.isArray(deck.chapters) && deck.chapters.length > 0);

test("every published Deck is registered and usable in the catalogue", () => {
  assert.ok(decks.length >= 10, "La collection doit contenir au moins 10 Decks");
  assert.equal(registry.decks.length, decks.length, "Chaque Deck publié doit avoir un repère éditorial");
  for (const deck of decks) {
    assert.ok(deck.questions.length >= 8, `${deck.id}: moins de 8 questions utilisables`);
    assert.ok(registry.decks.some((entry) => entry.deck_id === deck.id), `${deck.id}: absent du registre`);
  }
});

test("the V1 core catalogue keeps a complete pedagogical path", () => {
  assert.equal(v1Decks.length, 10, "Le socle V1 doit rester à 10 Decks");
  for (const deck of v1Decks) {
    assert.ok(deck.chapters.length >= 3, `${deck.id}: parcours pédagogique incomplet`);
    assert.ok(
      deck.competencies.every((competency) =>
        deck.chapters.some((chapter) => chapter.id === competency),
      ),
      `${deck.id}: une compétence annoncée n'a pas de chapitre`,
    );
  }
});

test("critical commercial screens contain no fake or future action", () => {
  const criticalUi = routes.join("\n");
  assert.doesNotMatch(criticalUi, /\bà venir\b/i);
  assert.doesNotMatch(criticalUi, /\bTODO\b|\bFIXME\b/);
});

test("one release command exercises every mandatory quality gate", () => {
  const command = pkg.scripts?.["release:check"] ?? "";
  for (const gate of ["npm test", "typecheck", "lint", "build"]) {
    assert.match(command, new RegExp(gate.replace(" ", "\\s+")), `release:check ignore ${gate}`);
  }
});
