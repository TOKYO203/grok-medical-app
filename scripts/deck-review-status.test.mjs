import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Garde-fou B13 : le miroir UI deck-review-status.ts doit refléter exactement
// le registre éditorial (statut + date de relecture par deck).
const [registryRaw, moduleRaw] = await Promise.all([
  readFile(new URL("../src/content/data/editorial-registry.json", import.meta.url), "utf8"),
  readFile(new URL("../src/content/deck-review-status.ts", import.meta.url), "utf8"),
]);

const registry = JSON.parse(registryRaw);
const expected = new Map(
  registry.decks.map((deck) => [
    deck.deck_id,
    { status: deck.medical_review?.status, verifiedAt: deck.medical_review?.verified_at ?? null },
  ]),
);

const found = new Map();
const entry =
  /"([a-z0-9-]+)":\s*\{\s*status:\s*"(structural_only|priority_items_reviewed|fully_reviewed)",\s*verifiedAt:\s*(null|"[^"]*")\s*\}/g;
for (const match of moduleRaw.matchAll(entry)) {
  assert.ok(!found.has(match[1]), match[1] + ": doublon dans deck-review-status.ts");
  found.set(match[1], {
    status: match[2],
    verifiedAt: match[3] === "null" ? null : JSON.parse(match[3]),
  });
}

test("deck-review-status.ts reflète exactement le registre éditorial", () => {
  assert.deepEqual([...found.keys()].sort(), [...expected.keys()].sort());
  for (const [deckId, review] of expected) {
    assert.ok(found.has(deckId), deckId + ": statut de revue absent du miroir UI");
    assert.deepEqual(found.get(deckId), review, deckId + ": statut de revue désynchronisé");
  }
});
