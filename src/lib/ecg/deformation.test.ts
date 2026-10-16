/* Verrous morphologiques du moteur ECG — Session 12 (G52).
 * Le moteur (deformation.ts) est gelé : ces tests verrouillent son comportement
 * (dérivations sources, progression précordiale, largeurs de gaussiennes, ST)
 * sans le modifier — précédent Session 5 : garde-fous phonocardiogramme. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { baseWave, stOffsetMv } from "./deformation.ts";
import type { EcgDeformation } from "./deformation.ts";

const LEADS = ["I", "II", "V1", "V2", "V3", "V4", "V5", "V6"];

test("les 8 dérivations sources sont finies et les dérivées Einthoven retombent sur DII", () => {
  for (const lead of LEADS) {
    const wave = baseWave(lead);
    for (const part of ["P", "Q", "R", "S", "T"] as const) {
      assert.ok(Number.isFinite(wave[part].a), lead + " : amplitude " + part + " finie");
      assert.ok(Number.isFinite(wave[part].sigma), lead + " : sigma " + part + " fini");
      assert.ok(Number.isFinite(wave[part].mu), lead + " : mu " + part + " fini");
    }
  }
  for (const derived of ["III", "aVR", "aVL", "aVF", "dérivation-inconnue"]) {
    assert.deepEqual(baseWave(derived), baseWave("II"), derived + " doit retomber sur DII");
  }
});

test("progression R précordiale et repolarisation inversée en V1", () => {
  const r = (lead: string) => baseWave(lead).R.a;
  assert.ok(r("V1") < r("V2"), "R croissante de V1 à V2");
  assert.ok(r("V2") < r("V3"), "R croissante de V2 à V3");
  assert.ok(r("V3") < r("V4"), "R croissante de V3 à V4");
  assert.ok(r("V4") < r("V5"), "R croissante de V4 à V5");
  assert.ok(Math.abs(baseWave("V1").S.a) > Math.abs(baseWave("V6").S.a), "|S| décroissante de V1 à V6");
  assert.ok(baseWave("V3").R.a > Math.abs(baseWave("V3").S.a), "zone de transition : R domine S en V3");
  assert.ok(baseWave("V1").T.a < 0, "T inversée en V1");
  assert.ok(baseWave("V6").T.a > 0, "T positive en V6");
});

test("morphologie de référence en DII", () => {
  const d2 = baseWave("II");
  assert.equal(d2.R.a, 1.2, "R dominante en DII");
  assert.ok(d2.P.a > 0 && d2.P.a <= 0.25, "P discrète et positive");
  assert.ok(d2.Q.a < 0, "Q négative");
  assert.ok(d2.S.a < 0, "S négative");
  assert.ok(d2.T.a > 0 && d2.T.a < d2.R.a, "T positive, inférieure à R");
});

test("largeurs de gaussiennes cliniquement bornées sur les 8 sources", () => {
  for (const lead of LEADS) {
    const wave = baseWave(lead);
    assert.ok(wave.R.sigma <= 0.011, lead + " : sigma R resserrée");
    assert.ok(wave.Q.sigma < wave.R.sigma, lead + " : sigma Q plus étroite que sigma R");
    assert.ok(wave.P.sigma <= 0.026, lead + " : sigma P modérée");
    assert.ok(wave.T.sigma <= 0.041, lead + " : sigma T la plus large");
    assert.ok(Math.abs(wave.R.a) > Math.abs(wave.Q.a), lead + " : |R| > |Q|");
  }
});

test("stOffsetMv : sus-décalage moins sous-décalage, 0 sans déformation", () => {
  const mixed: EcgDeformation = { stElevation: { II: 0.2 }, stDepression: { II: 0.05 } };
  const avrOnly: EcgDeformation = { stDepression: { aVR: 0.12 } };
  assert.ok(
    Math.abs(stOffsetMv("II", mixed) - 0.15) < 1e-9,
    "sus-décalage moins sous-décalage en DII (0,2 - 0,05 = 0,15 à l'arrondi IEEE-754 près)",
  );
  assert.equal(stOffsetMv("V1", mixed), 0, "V1 non concernée");
  assert.equal(stOffsetMv("aVR", avrOnly), -0.12, "sous-décalage seul en aVR");
  assert.equal(stOffsetMv("II"), 0, "sans déformation");
  assert.equal(stOffsetMv("II", {}), 0, "déformation vide");
});
