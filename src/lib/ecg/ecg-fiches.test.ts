/* Cohérence des fiches ECG avec le moteur — Session 12 (G52).
 * Les fiches de src/content/data/ecg sont gelées : ce test garantit qu'elles
 * restent consommables par le moteur (waveform.ts + deformation.ts) — index
 * aligné, plages admises (bpm clampé 20-240, cycles >= 1), clés de déformation
 * connues, familles de rythme rendables. Précédent Session 5 : COVERED_PRESETS
 * des fiches d'auscultation. Fiches inchangées. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const rootDir = new URL("../../../", import.meta.url).pathname;
const dataDir = join(rootDir, "src/content/data/ecg");

type EcgIndexEntry = { id: string; rhythm: string; file: string };
type EcgIndex = { cases: EcgIndexEntry[] };
type EcgStep = { choices?: unknown[]; correct?: number; explanation?: string };
type EcgFiche = {
  id?: string;
  rhythm?: string;
  source?: { type?: string };
  trace?: { bpm?: number; cycles?: number; deformation?: Record<string, unknown> };
  steps?: EcgStep[];
};

async function readIndex(): Promise<EcgIndex> {
  const raw = await readFile(join(dataDir, "_index.json"), "utf8");
  return JSON.parse(raw) as EcgIndex;
}

async function readFiche(file: string): Promise<EcgFiche> {
  const raw = await readFile(join(dataDir, file), "utf8");
  return JSON.parse(raw) as EcgFiche;
}

const KNOWN_DEFORMATION_KEYS = [
  "rhythm",
  "stElevation",
  "stDepression",
  "wideQrs",
  "tInverted",
  "peakedT",
  "pAbsent",
  "sawTooth",
  "fv",
  "prProgression",
  "pBlockedEvery",
  "rrVariability",
  "rrSeed",
];

test("les 23 fiches de l'index sont cohérentes et pédagogiquement complètes", async () => {
  const index = await readIndex();
  assert.ok(index.cases.length >= 23, "au moins 23 fiches attendues");
  for (const entry of index.cases) {
    const fiche = await readFiche(entry.file);
    assert.equal(fiche.id, entry.id, entry.id + " : id fiche != index");
    assert.equal(fiche.rhythm, entry.rhythm, entry.id + " : rythme fiche != index");
    assert.ok(
      fiche.source?.type !== undefined && fiche.source.type !== "",
      entry.id + " : source.type requis",
    );
    const bpm = fiche.trace?.bpm;
    assert.ok(
      typeof bpm === "number" && bpm >= 20 && bpm <= 240,
      entry.id + " : bpm dans le clamp du moteur",
    );
    const cycles = fiche.trace?.cycles;
    assert.ok(typeof cycles === "number" && cycles >= 1, entry.id + " : cycles >= 1");
    const steps = fiche.steps ?? [];
    assert.ok(steps.length >= 3, entry.id + " : au moins 3 etapes");
    steps.forEach((step, s) => {
      const choices = step.choices ?? [];
      assert.ok(choices.length >= 2, entry.id + " etape " + s + " : au moins 2 choix");
      assert.ok(
        step.correct !== undefined && step.correct >= 0 && step.correct < choices.length,
        entry.id + " etape " + s + " : index de reponse valide",
      );
      assert.ok(
        step.explanation !== undefined && step.explanation !== "",
        entry.id + " etape " + s + " : explication requise",
      );
    });
  }
});

test("les declarations de deformation n'utilisent que des cles connues du moteur", async () => {
  const index = await readIndex();
  for (const entry of index.cases) {
    const fiche = await readFiche(entry.file);
    const def = fiche.trace?.deformation ?? {};
    for (const key of Object.keys(def)) {
      assert.ok(
        (KNOWN_DEFORMATION_KEYS as readonly string[]).includes(key),
        entry.id + " : cle inconnue " + key,
      );
    }
    assert.ok(!("rhythm" in def), entry.id + " : le rythme vit dans la fiche, pas la deformation");
    const pr = def.prProgression;
    assert.ok(
      pr === undefined || pr === "constant" || pr === "wenckebach" || pr === "mobitz2",
      entry.id + " : prProgression invalide",
    );
    const rr = def.rrVariability;
    assert.ok(
      rr === undefined || (typeof rr === "number" && rr > 0 && rr <= 1),
      entry.id + " : rrVariability dans ]0, 1]",
    );
  }
});

test("familles de rythme et spot checks cliniques alignes avec le moteur", async () => {
  const index = await readIndex();
  const fiches = new Map<string, EcgFiche>();
  for (const entry of index.cases) {
    fiches.set(entry.id, await readFiche(entry.file));
  }
  const defOf = (id: string): Record<string, unknown> => fiches.get(id)?.trace?.deformation ?? {};
  const expect = (id: string, key: string, value: unknown): void => {
    assert.deepEqual(defOf(id)[key], value, id + " : " + key);
  };

  for (const entry of index.cases) {
    if (entry.rhythm === "flutter-auriculaire") {
      assert.deepEqual(defOf(entry.id).sawTooth, true, entry.id + " : le flutter impose les dents de scie");
    }
    if (entry.rhythm === "fibrillation-auriculaire") {
      assert.deepEqual(defOf(entry.id).pAbsent, true, entry.id + " : la FA supprime l'onde P");
      assert.ok(typeof defOf(entry.id).rrVariability === "number", entry.id + " : la FA a un RR variable");
      assert.ok(typeof defOf(entry.id).rrSeed === "number", entry.id + " : seed RR deterministe requise");
    }
    if (entry.rhythm === "torsade-de-pointes") {
      assert.deepEqual(defOf(entry.id).wideQrs, true, entry.id + " : torsades = QRS larges");
      assert.ok(typeof defOf(entry.id).rrVariability === "number", entry.id + " : RR variable requise");
    }
    if (entry.rhythm === "tachycardie-ventriculaire") {
      assert.deepEqual(defOf(entry.id).wideQrs, true, entry.id + " : TV = QRS larges");
    }
  }

  expect("ecg-2-4-bav2-mobitz1", "prProgression", "wenckebach");
  expect("ecg-2-3-bav2-mobitz2", "prProgression", "mobitz2");
  expect("ecg-2-3-bav2-mobitz2", "pBlockedEvery", 3);
  expect("ecg-5-3-hyperkaliemie", "peakedT", true);
  expect("ecg-1-2-idm-etalonnage", "stElevation", { V2: 0.35, V3: 0.4, V4: 0.3 });
  expect("ecg-5-1-pericardite", "stDepression", { aVR: 0.12 });
});
