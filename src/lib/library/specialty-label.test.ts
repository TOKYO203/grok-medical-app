import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalSpecialty,
  isCompositeSpecialty,
  primarySpecialty,
  specialtyCodeFromLabel,
} from "./specialty-label.ts";

test("canonicalSpecialty recognises the five premium families", () => {
  assert.deepEqual(canonicalSpecialty("Cardiologie"), { code: "CARDIO", label: "Cardiologie" });
  assert.deepEqual(canonicalSpecialty("Neurologie"), { code: "NEURO", label: "Neurologie" });
  assert.deepEqual(canonicalSpecialty("Infectiologie"), {
    code: "INFECTIO",
    label: "Infectiologie",
  });
  assert.deepEqual(canonicalSpecialty("Urgences"), { code: "URGENCES", label: "Urgences" });
  assert.deepEqual(canonicalSpecialty("Dermatologie"), { code: "DERMATO", label: "Dermatologie" });
  assert.equal(canonicalSpecialty("Outils"), null);
});

test("primarySpecialty keeps simple labels untouched", () => {
  assert.equal(primarySpecialty("Cardiologie"), "Cardiologie");
  assert.equal(primarySpecialty("  Neurologie  "), "Neurologie");
  assert.equal(primarySpecialty("Fondamentaux & Sémiologie"), "Fondamentaux & Sémiologie");
  assert.equal(primarySpecialty("Outils"), "Outils");
});

test("primarySpecialty groups composite labels on the specialty that unlocks them", () => {
  // Aligné sur specialtyCode/specialtyPackProduct et l'ordre de priorité corrigé
  // par 2e8acd7ca1 (cardio > neuro > dermato > infectio > urgences) :
  // « Dermatologie · Infectiologie » est débloquée par le pack Dermatologie
  // → rangée sous Dermatologie.
  assert.equal(primarySpecialty("Urgences / Cardiologie"), "Cardiologie");
  assert.equal(primarySpecialty("Infectiologie / Urgences"), "Infectiologie");
  assert.equal(primarySpecialty("Dermatologie · Infectiologie"), "Dermatologie");
  assert.equal(primarySpecialty("Pneumologie|Infectiologie"), "Infectiologie");
});

test("primarySpecialty never returns a label containing a separator", () => {
  for (const raw of ["Urgences / Cardiologie", "Infectiologie / Urgences", "A / B / C"]) {
    assert.doesNotMatch(primarySpecialty(raw), /[/·|]/);
  }
});

test("specialtyCodeFromLabel matches the historical specialtyCode mapping", () => {
  assert.equal(specialtyCodeFromLabel("Cardiologie"), "CARDIO");
  assert.equal(specialtyCodeFromLabel("Urgences / Cardiologie"), "CARDIO");
  assert.equal(specialtyCodeFromLabel("Urgences"), "URGENCES");
  assert.equal(specialtyCodeFromLabel("Thérapeutique"), "THÉRAPEUTIQUE");
});

test("isCompositeSpecialty flags only multi-specialty labels", () => {
  assert.equal(isCompositeSpecialty("Urgences / Cardiologie"), true);
  assert.equal(isCompositeSpecialty("Cardiologie"), false);
});
