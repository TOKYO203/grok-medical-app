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

test("the V1 learning catalogue has ten usable, registered Decks", () => {
  assert.equal(decks.length, 10, "La collection V1 doit contenir exactement 10 Decks");
  assert.equal(registry.decks.length, decks.length);
  for (const deck of decks) {
    assert.ok(deck.questions.length >= 8, `${deck.id}: moins de 8 questions utilisables`);
    assert.ok(deck.chapters.length >= 3, `${deck.id}: parcours pédagogique incomplet`);
    assert.ok(
      deck.competencies.every((competency) =>
        deck.chapters.some((chapter) => chapter.id === competency),
      ),
      `${deck.id}: une compétence annoncée n'a pas de chapitre`,
    );
    assert.ok(registry.decks.some((entry) => entry.deck_id === deck.id), `${deck.id}: absent du registre`);
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
