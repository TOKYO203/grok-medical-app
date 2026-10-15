// Canari de diagnostic CI — Session 5 (temporaire).
// Squelette identique au fichier complet (imports node + moteur), un seul
// test trivial : si la CI passe, l'échec venait des corps des tests.
import assert from "node:assert/strict";
import test from "node:test";

import { buildCycle } from "./phonocardiogram.ts";

test("phono QA (canari): le moteur de tracé répond pour un preset normal", () => {
  const cycle = buildCycle("normal_s1s2");
  assert.ok(cycle.events.length >= 2, "cycle normal: B1/B2 attendus");
});
