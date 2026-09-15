import assert from "node:assert/strict";
import test from "node:test";
import type { Deck } from "../core/types.ts";
import {
  assertImportedDeckStorageBudget,
  importedDeckByteSize,
  MAX_IMPORTED_DECK_BYTES,
} from "./imported-deck-storage.ts";

function deck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: "personal-cardio",
    deck_id: "personal-cardio",
    schema_version: 2,
    version: "1.0.0",
    title: "Deck personnel",
    subtitle: "",
    subject: "Cardiologie",
    specialty: "Cardiologie",
    studyYear: 5,
    difficulty: "intermediate",
    competencies: ["diagnosis"],
    icon: "book",
    questions: [
      {
        id: "q-1",
        prompt: "Quel examen confirme ce diagnostic dans ce contexte clinique ?",
        choices: ["ECG", "Radiographie"],
        correct: 0,
        explanation: "L'ECG est l'examen initial attendu dans ce scénario.",
        sources: [{ title: "Référence", citation: "Guide clinique." }],
        difficulty: "base",
        competency: "diagnosis",
      },
    ],
    sources: [],
    access_policy: { tier: "free", entitlement: "OPTIMUS_FREE" },
    chapters: [],
    imported: true,
    ...overrides,
  };
}

test("a normal imported deck fits the IndexedDB storage budget", () => {
  const candidate = deck();
  assert.ok(importedDeckByteSize(candidate) > 0);
  assert.doesNotThrow(() => assertImportedDeckStorageBudget([candidate]));
});

test("an imported deck larger than 4 MiB is rejected before IndexedDB write", () => {
  const candidate = deck({ subtitle: "x".repeat(MAX_IMPORTED_DECK_BYTES) });
  assert.ok(importedDeckByteSize(candidate) > MAX_IMPORTED_DECK_BYTES);
  assert.throws(
    () => assertImportedDeckStorageBudget([candidate]),
    /imported_deck_invalid_size/,
  );
});
