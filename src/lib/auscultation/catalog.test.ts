/* Verrous d'intégrité du catalogue Auscultation — QA du module.
 *
 * Le chargeur (catalog.ts) expose missingFicheFiles() /
 * missingPulmonaireFicheFiles(), mais RIEN ne les vérifiait : une fiche
 * indexée "available" mais non enregistrée dans les registres rend
 * getFiche() undefined — « fiche cliquable mais vide », cf. l'avertissement
 * du chargeur. Ce test verrouille la chaîne complète :
 *
 *   manifeste _index.json -> fichier présent -> fiche enregistrée dans
 *   catalog.ts -> preset implémenté par le moteur audio (engine.ts) ->
 *   clés de params connues du moteur -> foyer/zone valide -> source complète.
 *
 * Précédents : phonocardiogram.test.ts (mêmes répertoires de données),
 * ecg-fiches.test.ts (même contrat côté ECG). engine.ts et
 * phonocardiogram.ts n'ont aucun import : chargeables sous
 * node --experimental-strip-types. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { listPresets, listLungPresets } from "./engine.ts";
import { COVERED_PRESETS } from "./phonocardiogram.ts";

const rootDir = new URL("../../../", import.meta.url).pathname;
const dataDir = join(rootDir, "src/content/data/auscultation");
const catalogPath = join(rootDir, "src/lib/auscultation/catalog.ts");

type Manifest = {
  foyers?: Array<{ id: string }>;
  zones?: Array<{ id: string }>;
  sounds: Array<{
    id: string;
    label: string;
    status: string;
    file: string | null;
    foyers?: string[];
    zones?: string[];
  }>;
};

type Fiche = {
  id?: string;
  label?: string;
  audio?: { preset?: string; params?: Record<string, unknown> };
  source?: { type?: string; reference?: string; license?: string };
};

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Clés de SoundParams (engine.ts) — presets cardiaques. */
const HEART_PARAM_KEYS = [
  "bpm", "systoleMs", "diastoleMs", "s1Freq", "s2Freq", "s1Gain", "s2Gain",
  "s1Dur", "s2Dur", "filterFreq", "filterQ", "splitMs", "p2Freq",
  "s3Freq", "s3Gain", "s3Dur", "s3DelayMs",
  "s4Freq", "s4Gain", "s4Dur", "s4DelayMs",
  "murmurFreq", "murmurQ", "murmurGain",
  "rumbleFreq", "rumbleGain", "osFreq", "osGain", "osDelayMs",
  "rubFreq", "rubGain", "rubQ", "bpmMin", "bpmMax",
];

/** Clés de LungParams (engine.ts) — presets pulmonaires. */
const LUNG_PARAM_KEYS = [
  "breathsPerMin", "inspirationMs", "expirationMs",
  "ambientFreq", "ambientQ", "ambientGain",
  "crackleFreq", "crackleQ", "crackleDurMs", "crackleGain", "crackleCount",
  "wheezeFreq", "wheezeQ", "wheezeGain", "wheezeModHz",
  "stridorFreq", "stridorQ", "stridorGain",
];

test("auscultation QA: le moteur audio et le tracé couvrent exactement les mêmes presets", () => {
  const engine = [...listPresets()].sort();
  const trace = [...COVERED_PRESETS].sort();
  assert.deepEqual(
    engine,
    trace,
    "engine.ts et phonocardiogram.ts ne couvrent plus les mêmes presets (derive son/tracé)",
  );
  assert.equal(listPresets().length, 20, "20 presets audio attendus (10 cardiaques + 10 pulmonaires)");
  assert.equal(listLungPresets().length, 10, "10 presets pulmonaires attendus");
});

test("auscultation QA: chaque son disponible est jouable, traçable et complet", async () => {
  const cardiaque = (await readJson(join(dataDir, "_index.json"))) as Manifest;
  const pulmonaire = (await readJson(join(dataDir, "pulmonaire", "_index.json"))) as Manifest;
  const presets = listPresets();
  const foyers = new Set((cardiaque.foyers ?? []).map((f) => f.id));
  const zones = new Set((pulmonaire.zones ?? []).map((z) => z.id));

  const cardiaqueAvailable = cardiaque.sounds.filter((s) => s.status === "available");
  const pulmonaireAvailable = pulmonaire.sounds.filter((s) => s.status === "available");
  assert.ok(cardiaqueAvailable.length >= 10, "au moins 10 fiches cardiaques disponibles");
  assert.ok(pulmonaireAvailable.length >= 10, "au moins 10 fiches pulmonaires disponibles");

  for (const entry of [...cardiaqueAvailable, ...pulmonaireAvailable]) {
    if (!entry.file) throw new Error(entry.id + " : son disponible sans fichier");
    const fiche = (await readJson(join(dataDir, entry.file))) as Fiche;
    assert.equal(fiche.id, entry.id, entry.id + " : id fiche != index");
    assert.equal(fiche.label, entry.label, entry.id + " : label fiche != index");
    const preset = fiche.audio?.preset;
    assert.ok(
      typeof preset === "string" && presets.includes(preset),
      entry.id + ' : preset "' + String(preset) + '" non implémenté par le moteur audio',
    );
    for (const f of entry.foyers ?? []) {
      assert.ok(foyers.has(f), entry.id + " : foyer inconnu " + f);
    }
    for (const z of entry.zones ?? []) {
      assert.ok(zones.has(z), entry.id + " : zone inconnue " + z);
    }
    assert.ok(
      fiche.source?.type !== undefined && fiche.source?.type !== "" &&
        fiche.source?.reference !== undefined && fiche.source?.reference !== "" &&
        fiche.source?.license !== undefined && fiche.source?.license !== "",
      entry.id + " : source (type/reference/license) requise",
    );
  }
});

test("auscultation QA: la fiche de chaque son disponible est enregistrée dans catalog.ts", async () => {
  const src = await readFile(catalogPath, "utf8");
  const cardiaque = (await readJson(join(dataDir, "_index.json"))) as Manifest;
  const pulmonaire = (await readJson(join(dataDir, "pulmonaire", "_index.json"))) as Manifest;
  for (const manifest of [cardiaque, pulmonaire]) {
    for (const entry of manifest.sounds.filter((s) => s.status === "available" && s.file)) {
      assert.ok(
        src.includes('"' + entry.file + '":'),
        entry.id + " : " + entry.file +
          " absent des registres FICHES_BY_FILE / PULMONAIRE_FICHES_BY_FILE (fiche cliquable mais vide)",
      );
    }
  }
});

test("auscultation QA: les params des fiches n'utilisent que des clés connues du moteur", async () => {
  const cardiaque = (await readJson(join(dataDir, "_index.json"))) as Manifest;
  const pulmonaire = (await readJson(join(dataDir, "pulmonaire", "_index.json"))) as Manifest;
  const lungPresetIds = listLungPresets();
  const known = [...HEART_PARAM_KEYS, ...LUNG_PARAM_KEYS];
  for (const manifest of [cardiaque, pulmonaire]) {
    for (const entry of manifest.sounds.filter((s) => s.status === "available" && s.file)) {
      const fiche = (await readJson(join(dataDir, entry.file as string))) as Fiche;
      const preset = fiche.audio?.preset ?? "";
      const isLung = lungPresetIds.includes(preset);
      const expectedKeys = isLung ? LUNG_PARAM_KEYS : HEART_PARAM_KEYS;
      for (const [key, value] of Object.entries(fiche.audio?.params ?? {})) {
        assert.ok(
          known.includes(key),
          entry.id + " : cle de params inconnue du moteur : " + key +
            " (silencieusement ignoree par mergeParams/mergeLungParams)",
        );
        assert.ok(
          expectedKeys.includes(key),
          entry.id + " : cle " + key + " inattendue pour un preset " +
            (isLung ? "pulmonaire" : "cardiaque") + " (" + preset + ")",
        );
        assert.ok(
          typeof value === "number" && Number.isFinite(value),
          entry.id + " : param " + key + " doit etre un nombre fini",
        );
      }
    }
  }
});
