// Garde-fous comportementaux du phonocardiogramme — Session 5 (QA auscultation).
// Ces tests importent le module TypeScript : ils s'exécutent dans le lot
// "node --experimental-strip-types --test" de npm test, jamais dans
// scripts/**/*.test.mjs (premier lot, sans flag, incapable de charger un .ts).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { buildCycle, COVERED_PRESETS } from "./phonocardiogram.ts";
import type { PhonoCycle } from "./phonocardiogram.ts";

const rootDir = new URL("../../../", import.meta.url).pathname;
const dataDir = join(rootDir, "src/content/data/auscultation");

type AuscultationIndex = { sounds: Array<{ id: string; status: string; file: string }> };


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
    murmur !== undefined &&
      murmur.startTime <= 1e-9 &&
      murmur.startTime + murmur.duration >= inspiEnd - 1e-9,
    "sibilances: le murmure doit couvrir l'inspiration",
  );
});

test("phono QA: fenêtres de craquements conformes au moteur (scatterCrackles)", () => {
  const params = { inspirationMs: 1400, expirationMs: 2200 };
  const fine = buildCycle("fine_crackles", params);
  const medium = buildCycle("medium_crackles", params);
  const coarse = buildCycle("coarse_crackles", params);
  const inspiEnd = fine.phases[0].end;
  const crackles = (cycle: PhonoCycle) => cycle.events.filter((ev) => ev.kind === "crackle");
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
  assert.ok(gaps.every((g) => g > 0.3), `irregular_fast: RR trop courts (${gaps.join(
)})`);
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
  const index = JSON.parse(await readFile(join(dataDir, "_index.json"), "utf8")) as AuscultationIndex;
  const pulmonaireIndex = JSON.parse(
    await readFile(join(dataDir, "pulmonaire", "_index.json"), "utf8"),
  ) as AuscultationIndex;
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
