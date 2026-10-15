import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

/**
 * Intégrité du catalogue Auscultation — garde-fou symétrique de
 * `ecg-catalog-integrity.test.mjs`. Étape 3/3 :
 *   • cœur  : 5 foyers, 10 sons, 10 fiches disponibles ;
 *   • poumon : 8 zones, 10 sons, 10 fiches disponibles.
 * Chaque fiche disponible doit être adossée à un preset audio implémenté.
 */

const rootDir = new URL("../", import.meta.url).pathname;
const dataDir = join(rootDir, "src/content/data/auscultation");
const catalogPath = join(rootDir, "src/lib/auscultation/catalog.ts");

const index = JSON.parse(await readFile(join(dataDir, "_index.json"), "utf8"));
const pulmonaireIndex = JSON.parse(
  await readFile(join(dataDir, "pulmonaire", "_index.json"), "utf8"),
);
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

const allJsonFiles = await listJsonFiles(dataDir);
const cardiaqueFiles = allJsonFiles.filter((f) => f.startsWith("cardiaque/"));
const pulmonaireFiles = allJsonFiles.filter((f) => f.startsWith("pulmonaire/"));

/* ─── Cœur ──────────────────────────────────────────────────────────── */

test("cardiac index declares 5 foyers and 10 planned sounds", () => {
  assert.equal(index.foyers.length, 5, "attendu 5 foyers");
  assert.equal(index.sounds.length, 10, "attendu 10 sons annoncés");

  const byCategorie = (c) => index.sounds.filter((s) => s.categorie === c).length;
  assert.equal(byCategorie("normal"), 4, "attendu 4 sons normaux");
  assert.equal(byCategorie("valvulopathie"), 4, "attendu 4 valvulopathies");
  assert.equal(byCategorie("pericarde"), 1, "attendu 1 frottement péricardique");
  assert.equal(byCategorie("trouble-rythme"), 1, "attendu 1 trouble du rythme (FA)");
});

test("every cardiac sound id is unique and foyers reference declared foyers", () => {
  const ids = index.sounds.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids de sons dupliqués");

  const foyerIds = new Set(index.foyers.map((f) => f.id));
  for (const sound of index.sounds) {
    for (const foyer of sound.foyers) {
      assert.ok(foyerIds.has(foyer), `${sound.id}: foyer inconnu "${foyer}"`);
    }
  }
});

test("available cardiac sounds point to a file that exists and is registered in the catalog", () => {
  const files = new Set(cardiaqueFiles);
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

test("no orphan cardiac json: every cardiaque file is referenced by an available sound", () => {
  const referenced = new Set(
    index.sounds.filter((s) => s.status === "available" && s.file).map((s) => s.file),
  );
  for (const file of cardiaqueFiles) {
    assert.ok(referenced.has(file), `fichier orphelin: ${file}`);
  }
});

test("all 10 cardiac sounds are available and every fiche is coherent with the index", async () => {
  const available = index.sounds.filter((s) => s.status === "available");
  assert.equal(available.length, 10, "attendu 10 fiches disponibles après l'étape 2");

  const foyerIds = new Set(index.foyers.map((f) => f.id));
  const engineSource = await readFile(join(rootDir, "src/lib/auscultation/engine.ts"), "utf8");

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

/* ─── Poumon ────────────────────────────────────────────────────────── */

test("pulmonary index declares 8 zones and 10 planned sounds", () => {
  assert.equal(pulmonaireIndex.zones.length, 8, "attendu 8 zones");
  assert.equal(pulmonaireIndex.sounds.length, 10, "attendu 10 sons pulmonaires");

  const byCategorie = (c) => pulmonaireIndex.sounds.filter((s) => s.categorie === c).length;
  assert.equal(byCategorie("normal"), 2, "attendu 2 sons normaux");
  assert.equal(byCategorie("craquement"), 4, "attendu 4 craquements");
  assert.equal(byCategorie("continu"), 2, "attendu 2 bruits continus");
  assert.equal(byCategorie("souffle"), 2, "attendu 2 souffles");

  const zoneIds = new Set(pulmonaireIndex.zones.map((z) => z.id));
  for (const expected of ["trachee", "sommet-d", "sommet-g", "base-d", "base-g", "diffus"]) {
    assert.ok(zoneIds.has(expected), `zone attendue manquante: ${expected}`);
  }
});

test("every pulmonary sound id is unique and zones reference declared zones", () => {
  const ids = pulmonaireIndex.sounds.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids de sons pulmonaires dupliqués");

  const zoneIds = new Set(pulmonaireIndex.zones.map((z) => z.id));
  for (const sound of pulmonaireIndex.sounds) {
    for (const zone of sound.zones) {
      assert.ok(zoneIds.has(zone), `${sound.id}: zone inconnue "${zone}"`);
    }
  }
});

test("available pulmonary sounds point to a file that exists and is registered in the catalog", () => {
  const files = new Set(pulmonaireFiles);
  const available = pulmonaireIndex.sounds.filter((s) => s.status === "available");

  assert.equal(available.length, 10, "attendu 10 fiches pulmonaires disponibles");
  for (const sound of available) {
    assert.ok(sound.file, `${sound.id}: fichier manquant`);
    assert.ok(files.has(sound.file), `${sound.id}: fichier introuvable "${sound.file}"`);
    assert.ok(
      catalogSource.includes(`"${sound.file}"`),
      `${sound.id}: "${sound.file}" non enregistré dans catalog.ts`,
    );
  }
});

test("no orphan pulmonary json: every pulmonaire file is referenced by an available sound", () => {
  const referenced = new Set(
    pulmonaireIndex.sounds.filter((s) => s.status === "available" && s.file).map((s) => s.file),
  );
  for (const file of pulmonaireFiles) {
    assert.ok(referenced.has(file), `fichier orphelin: ${file}`);
  }
});

test("all 10 pulmonary fiches are coherent with the index and their preset is implemented", async () => {
  const available = pulmonaireIndex.sounds.filter((s) => s.status === "available");
  assert.equal(available.length, 10, "attendu 10 fiches pulmonaires disponibles");

  const zoneIds = new Set(pulmonaireIndex.zones.map((z) => z.id));
  const engineSource = await readFile(join(rootDir, "src/lib/auscultation/engine.ts"), "utf8");

  for (const sound of available) {
    const fiche = JSON.parse(await readFile(join(dataDir, sound.file), "utf8"));

    assert.equal(fiche.id, sound.id, `${sound.id}: id de fiche ≠ id d'index`);
    assert.equal(fiche.categorie, sound.categorie, `${sound.id}: catégorie incohérente`);
    assert.deepEqual(
      [...fiche.zone].sort(),
      [...sound.zones].sort(),
      `${sound.id}: zones de la fiche ≠ zones de l'index`,
    );

    for (const key of [
      "timing",
      "timbre",
      "frequence",
      "localisation",
      "variations",
      "pathologies_associees",
      "diagnostics_differentiels",
      "audio",
      "items_programme",
      "pieges",
      "source",
    ]) {
      assert.ok(fiche[key] !== undefined, `${sound.id}: champ "${key}" manquant`);
    }

    for (const key of ["phase", "moment", "caractere", "schema"]) {
      assert.ok(
        typeof fiche.timing?.[key] === "string" && fiche.timing[key].length > 0,
        `${sound.id}: timing.${key} manquant`,
      );
    }

    assert.ok(Array.isArray(fiche.variations) && fiche.variations.length > 0, `${sound.id}: variations vides`);
    for (const variation of fiche.variations) {
      assert.ok(variation.manoeuvre && variation.effet, `${sound.id}: variation incomplète`);
    }

    assert.ok(
      typeof fiche.audio?.preset === "string" && fiche.audio.preset.length > 0,
      `${sound.id}: preset audio manquant`,
    );
    assert.ok(
      engineSource.includes(`${fiche.audio.preset}:`),
      `${sound.id}: preset "${fiche.audio.preset}" non implémenté dans engine.ts`,
    );
    for (const zone of fiche.zone) {
      assert.ok(zoneIds.has(zone), `${sound.id}: zone inconnue "${zone}"`);
    }
  }
});

test("nomenclature: pulmonary fiches use « craquements », never « crépitants »", async () => {
  const available = pulmonaireIndex.sounds.filter((s) => s.status === "available");
  for (const sound of available) {
    const raw = await readFile(join(dataDir, sound.file), "utf8");
    assert.ok(!/crépitant/i.test(raw), `${sound.id}: terme obsolète « crépitant » présent`);
  }
});
