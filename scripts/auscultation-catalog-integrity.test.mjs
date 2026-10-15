import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { buildCycle, COVERED_PRESETS } from "../src/lib/auscultation/phonocardiogram.ts";

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


/* ─── QA Session 5 : garde-fous comportementaux du phonocardiogramme ─── */

test("phono QA: sibilances — murmure en inspiration, sifflement expiratoire uniquement", () => {
  const params = { inspirationMs: 1400, expirationMs: 2200 };
  const cycle = buildCycle("sibilances", params);
  const inspiEnd = cycle.phases[0].end;

  // Le moteur (breathSibilances) ne siffle qu'à l'expiration : aucun segment
  // continu ne doit mordre sur l'inspiration.
  for (const ev of cycle.events) {
    if (ev.kind === "continuous") {
      assert.ok(
        ev.startTime >= inspiEnd - 1e-9,
        `sibilances: segment continu commençant avant la fin de l'inspiration (${ev.startTime}s)`,
      );
    }
  }
  assert.ok(
    cycle.events.some((ev) => ev.kind === "continuous"),
    "sibilances: sifflement expiratoire manquant",
  );
  const murmur = cycle.events.find((ev) => ev.kind === "breath");
  assert.ok(murmur, "sibilances: murmure vésiculaire manquant");
  assert.ok(
    murmur.startTime <= 1e-9 && murmur.startTime + murmur.duration >= inspiEnd - 1e-9,
    "sibilances: le murmure doit couvrir l'inspiration",
  );
});

test("phono QA: fenêtres de craquements conformes au moteur (scatterCrackles)", () => {
  const params = { inspirationMs: 1400, expirationMs: 2200 };
  const fine = buildCycle("fine_crackles", params);
  const medium = buildCycle("medium_crackles", params);
  const coarse = buildCycle("coarse_crackles", params);
  const inspiEnd = fine.phases[0].end;
  const crackles = (cycle) => cycle.events.filter((ev) => ev.kind === "crackle");
  assert.ok(crackles(fine).length >= 6, "fine_crackles: bouffées trop peu nombreuses");
  assert.ok(crackles(medium).length >= 6, "medium_crackles: bouffées trop peu nombreuses");
  assert.ok(crackles(coarse).length >= 6, "coarse_crackles: bouffées trop peu nombreuses");
  // fins : télé-inspiratoires (jamais avant la mi-inspiration)
  assert.ok(
    crackles(fine).every((ev) => ev.startTime >= inspiEnd * 0.55 - 1e-9),
    "fine_crackles: craquements avant la mi-inspiration (attendus télé-inspiratoires)",
  );
  // moyens : holo-inspiratoires (répartis dans l'inspiration, pas au-delà)
  assert.ok(
    crackles(medium).every((ev) => ev.startTime <= inspiEnd + 1e-9),
    "medium_crackles: craquements au-delà de la fin d'inspiration (attendus holo-inspiratoires)",
  );
  // grossiers : tout le cycle (débordent dans l'expiration)
  assert.ok(
    crackles(coarse).some((ev) => ev.startTime + ev.duration > inspiEnd + 1e-9),
    "coarse_crackles: aucun craquement dans l'expiration (attendus sur tout le cycle)",
  );
});

test("phono QA: craquements pleuraux — exactement deux bouffées miroirs", () => {
  const params = { inspirationMs: 1400, expirationMs: 2200 };
  const cycle = buildCycle("pleural_crackles", params);
  const bursts = cycle.events.filter((ev) => ev.kind === "crackle");
  assert.equal(
    bursts.length,
    2,
    "pleural_crackles: exactement 2 bouffées attendues (moteur breathPleuralCrackles)",
  );
  const [first, second] = bursts;
  const inspiEnd = cycle.phases[0].end;
  const total = cycle.phases[1].end;
  assert.ok(
    first.startTime < inspiEnd,
    "pleural_crackles: la 1re bouffée doit être télé-inspiratoire",
  );
  assert.ok(
    second.startTime >= inspiEnd && second.startTime + second.duration <= total + 1e-9,
    "pleural_crackles: la 2e bouffée doit être télé-expiratoire",
  );
});

test("phono QA: FA (irregular_fast) — trois battements irréguliers, B1 inégaux", () => {
  const cycle = buildCycle("irregular_fast");
  assert.equal(cycle.irregular, true, "irregular_fast: flag irregular attendu");
  const s1s = cycle.events.filter((ev) => ev.kind === "s1");
  assert.ok(s1s.length >= 3, `irregular_fast: au moins 3 B1 par cycle (trouvé ${s1s.length})`);
  const times = s1s.map((ev) => ev.startTime);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  assert.ok(gaps.every((g) => g > 0.3), `irregular_fast: RR trop courts (${gaps.join(", ")})`);
  assert.ok(
    Math.max(...gaps) - Math.min(...gaps) > 0.1,
    "irregular_fast: variabilité RR insuffisante (cycle rendu régulier)",
  );
  const amps = s1s.map((ev) => ev.amplitude);
  assert.ok(
    Math.max(...amps) - Math.min(...amps) > 0.2,
    "irregular_fast: amplitudes B1 trop uniformes (le moteur module B1)",
  );
});

test("phono QA: COVERED_PRESETS couvre tous les presets audio des 20 fiches", async () => {
  const available = [
    ...index.sounds.filter((s) => s.status === "available"),
    ...pulmonaireIndex.sounds.filter((s) => s.status === "available"),
  ];
  assert.ok(available.length >= 20, `attendu 20 fiches disponibles (trouvé ${available.length})`);
  for (const sound of available) {
    const fiche = JSON.parse(await readFile(join(dataDir, sound.file), "utf8"));
    const preset = fiche.audio?.preset;
    assert.ok(
      typeof preset === "string" && (COVERED_PRESETS as readonly string[]).includes(preset),
      `${sound.id}: preset "${preset}" absent de COVERED_PRESETS (tracé non couvert)`,
    );
  }
});
