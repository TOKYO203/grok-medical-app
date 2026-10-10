import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

/**
 * Intégrité du catalogue Auscultation — garde-fou symétrique de
 * `ecg-catalog-integrity.test.mjs`. Étape 2/3 : 5 foyers, 10 sons cardiaques,
 * 10 fiches réellement disponibles (chacune adossée à un preset audio implémenté).
 */

const rootDir = new URL("../", import.meta.url).pathname;
const dataDir = join(rootDir, "src/content/data/auscultation");
const catalogPath = join(rootDir, "src/lib/auscultation/catalog.ts");

const index = JSON.parse(await readFile(join(dataDir, "_index.json"), "utf8"));
const catalogSource = await readFile(catalogPath, "utf8");

/** Liste récursive des .json du dossier (hors _index.json). */
async function listJsonFiles(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listJsonFiles(join(dir, entry.name), rel)));
    else if (entry.name.endsWith(".json") && entry.name !== "_index.json") out.push(rel);
  }
  return out;
}

test("index declares 5 foyers and 10 planned sounds", () => {
  assert.equal(index.foyers.length, 5, "attendu 5 foyers");
  assert.equal(index.sounds.length, 10, "attendu 10 sons annoncés");

  const byCategorie = (c) => index.sounds.filter((s) => s.categorie === c).length;
  assert.equal(byCategorie("normal"), 4, "attendu 4 sons normaux");
  assert.equal(byCategorie("valvulopathie"), 4, "attendu 4 valvulopathies");
  assert.equal(byCategorie("pericarde"), 1, "attendu 1 frottement péricardique");
  assert.equal(byCategorie("trouble-rythme"), 1, "attendu 1 trouble du rythme (FA)");
});

test("every sound id is unique and foyers reference declared foyers", () => {
  const ids = index.sounds.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids de sons dupliqués");

  const foyerIds = new Set(index.foyers.map((f) => f.id));
  for (const sound of index.sounds) {
    for (const foyer of sound.foyers) {
      assert.ok(foyerIds.has(foyer), `${sound.id}: foyer inconnu "${foyer}"`);
    }
  }
});

test("available sounds point to a file that exists and is registered in the catalog", async () => {
  const files = new Set(await listJsonFiles(dataDir));
  const available = index.sounds.filter((s) => s.status === "available");

  assert.ok(available.length >= 1, "au moins une fiche disponible attendue");
  for (const sound of available) {
    assert.ok(sound.file, `${sound.id}: fichier manquant`);
    assert.ok(files.has(sound.file), `${sound.id}: fichier introuvable "${sound.file}"`);
    assert.ok(
      catalogSource.includes(`"${sound.file}"`),
      `${sound.id}: "${sound.file}" non enregistré dans catalog.ts`,
    );
  }
});

test("no orphan json file: every file is referenced by an available sound", async () => {
  const files = await listJsonFiles(dataDir);
  const referenced = new Set(
    index.sounds.filter((s) => s.status === "available" && s.file).map((s) => s.file),
  );
  for (const file of files) {
    assert.ok(referenced.has(file), `fichier orphelin: ${file}`);
  }
});

test("all 10 sounds are available and every fiche is coherent with the index", async () => {
  const available = index.sounds.filter((s) => s.status === "available");
  assert.equal(available.length, 10, "attendu 10 fiches disponibles après l'étape 2");

  const foyerIds = new Set(index.foyers.map((f) => f.id));
  const engineSource = await readFile(
    join(rootDir, "src/lib/auscultation/engine.ts"),
    "utf8",
  );

  for (const sound of available) {
    const fiche = JSON.parse(await readFile(join(dataDir, sound.file), "utf8"));

    assert.equal(fiche.id, sound.id, `${sound.id}: id de fiche ≠ id d'index`);
    assert.equal(fiche.categorie, sound.categorie, `${sound.id}: catégorie incohérente`);
    assert.deepEqual(
      [...fiche.foyer].sort(),
      [...sound.foyers].sort(),
      `${sound.id}: foyers de la fiche ≠ foyers de l'index`,
    );

    for (const key of [
      "timing",
      "timbre",
      "irradiation",
      "palpation",
      "audio",
      "manoeuvres",
      "diagnostics_associes",
      "items_programme",
      "pieges",
      "source",
    ]) {
      assert.ok(fiche[key] !== undefined, `${sound.id}: champ "${key}" manquant`);
    }

    assert.ok(
      typeof fiche.audio?.preset === "string" && fiche.audio.preset.length > 0,
      `${sound.id}: preset audio manquant`,
    );
    assert.ok(
      engineSource.includes(`${fiche.audio.preset}:`),
      `${sound.id}: preset "${fiche.audio.preset}" non implémenté dans engine.ts`,
    );
    for (const foyer of fiche.foyer) {
      assert.ok(foyerIds.has(foyer), `${sound.id}: foyer inconnu "${foyer}"`);
    }
  }
});
