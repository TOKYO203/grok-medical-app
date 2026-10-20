/* Verrous comportementaux de l'analyseur ECG (issue #39).
 * analyzeEcg n'était couvert par aucun test : les branches BAV I / PR court /
 * axe gauche-droite-extrême / FV — précisément celles que l'issue #39 a
 * rouvertes — n'avaient aucune preuve. Import direct rendu possible par
 * l'extension explicite "./analysis.ts" (précédent : deformation.test.ts) ;
 * les imports "@/core/ecg" sont `import type`, donc effacés à l'exécution. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeEcg } from "./analyzeEcg.ts";
import type { EcgDiagnosis } from "./analyzeEcg.ts";
import type { EcgTraceParams } from "@/core/ecg";

/** Trace sinusale de référence (mêmes ondes que waveform.ts / normal-001). */
function trace(over: Partial<EcgTraceParams> = {}): EcgTraceParams {
  return {
    bpm: 75,
    cycles: 6,
    waves: {
      P: { mu: -0.18, a: 0.15, sigma: 0.025 },
      Q: { mu: -0.02, a: -0.15, sigma: 0.008 },
      R: { mu: 0, a: 1.2, sigma: 0.01 },
      S: { mu: 0.03, a: -0.35, sigma: 0.01 },
      T: { mu: 0.25, a: 0.3, sigma: 0.04 },
    },
    ...over,
  };
}

/** Trace dont seule la position de l'onde P change (dérivation du PR). */
function traceWithPMu(pMu: number): EcgTraceParams {
  const base = trace();
  return { ...base, waves: { ...base.waves, P: { ...base.waves.P, mu: pMu } } };
}

const codes = (d: EcgDiagnosis): string[] => d.alertes.map((a) => a.code);

test("trace sinusale de référence : aucune alerte, PR 180 ms, axe normal", () => {
  const d = analyzeEcg(trace());
  assert.equal(d.fc, 75);
  assert.equal(d.rythme, "sinusal");
  assert.deepEqual(d.pr, { valueMs: 180, status: "normal" });
  assert.deepEqual(d.qrs, { dureeMs: 90, status: "fin" });
  assert.equal(d.axe.status, "normal");
  assert.equal(d.axe.degres, 37); // atan2(0.72, 0.96) sur le repli sans axisAmplitudes
  assert.deepEqual(d.alertes, []);
});

test("PR piloté par la fiche : prIntervalMs 240 -> BAV I atteignable", () => {
  const d = analyzeEcg(trace({ prIntervalMs: 240 }));
  assert.deepEqual(d.pr, { valueMs: 240, status: "long" });
  assert.ok(codes(d).includes("bav-1"), "BAV I doit être signalé");
});

test("PR piloté par la fiche : prIntervalMs 100 -> PR court (WPW ?)", () => {
  const d = analyzeEcg(trace({ prIntervalMs: 100 }));
  assert.deepEqual(d.pr, { valueMs: 100, status: "court" });
  assert.ok(codes(d).includes("pr-court"), "PR court doit être signalé");
});

test("PR dérivé de la morphologie : P proche du QRS -> PR court", () => {
  const d = analyzeEcg(traceWithPMu(-0.1)); // R.mu - P.mu = 100 ms
  assert.deepEqual(d.pr, { valueMs: 100, status: "court" });
});

test("PR dérivé invalide (P après le R) -> repli 160 ms, pas de valeur absurde", () => {
  const d = analyzeEcg(traceWithPMu(0.05)); // R.mu - P.mu = -50 ms -> repli
  assert.deepEqual(d.pr, { valueMs: 160, status: "normal" });
});

test("Wenckebach : PR progressif + alerte, rythme sinusal irrégulier", () => {
  const d = analyzeEcg(trace(), { prProgression: "wenckebach" });
  assert.equal(d.rythme, "sinusal-irregulier");
  assert.deepEqual(d.pr, { valueMs: 180, status: "progressif" });
  assert.ok(codes(d).includes("bav-2-mobitz1"));
});

test("Mobitz II : PR constant + alerte critique", () => {
  const d = analyzeEcg(trace(), { prProgression: "mobitz2", pBlockedEvery: 3 });
  assert.deepEqual(d.pr, { valueMs: 180, status: "normal" });
  const bav = d.alertes.find((a) => a.code === "bav-2-mobitz2");
  assert.equal(bav?.niveau, "critical");
});

test("onde P absente : PR non mesurable + alerte ; RR variable -> FA", () => {
  const figee = analyzeEcg(trace(), { pAbsent: true });
  assert.equal(figee.pr, null);
  assert.equal(figee.rythme, "sinusal"); // sans rrVariability ce n'est pas encore une FA
  assert.ok(codes(figee).includes("fa-abs"));

  const fa = analyzeEcg(trace(), { pAbsent: true, rrVariability: 0.3 });
  assert.equal(fa.rythme, "fa");
});

test("dents de scie -> flutter ; QRS large + FC > 100 -> TV", () => {
  const flutter = analyzeEcg(trace(), { sawTooth: true });
  assert.equal(flutter.rythme, "flutter");

  const tv = analyzeEcg(trace({ bpm: 180 }), { wideQrs: true });
  assert.equal(tv.rythme, "tv");
  assert.deepEqual(tv.qrs, { dureeMs: 140, status: "large" });
  assert.ok(codes(tv).includes("qrs-large"));
  assert.ok(codes(tv).includes("tachycardie"));
});

test("FV : classée avant tout le reste, alerte critique en tête", () => {
  const d = analyzeEcg(trace(), { fv: true, sawTooth: true });
  assert.equal(d.rythme, "fv"); // la FV prime sur le flutter dans la chaîne
  assert.equal(d.pr, null);
  assert.equal(d.alertes[0].code, "fv");
  assert.equal(d.alertes[0].niveau, "critical");
});

test("axe : les quatre quadrants sont atteignables via axisAmplitudes", () => {
  const normal = analyzeEcg(trace({ axisAmplitudes: { i: 1, avf: 1 } }));
  assert.equal(normal.axe.status, "normal");
  assert.equal(normal.axe.degres, 45);

  const gauche = analyzeEcg(trace({ axisAmplitudes: { i: 1, avf: -1 } }));
  assert.equal(gauche.axe.status, "gauche");
  assert.equal(gauche.axe.degres, -45);
  assert.ok(codes(gauche).includes("axe-gauche"));

  const droite = analyzeEcg(trace({ axisAmplitudes: { i: -1, avf: 1 } }));
  assert.equal(droite.axe.status, "droite");
  assert.equal(droite.axe.degres, 135);
  assert.ok(codes(droite).includes("axe-droit"));

  const extreme = analyzeEcg(trace({ axisAmplitudes: { i: -1, avf: -1 } }));
  assert.equal(extreme.axe.status, "extreme");
  assert.equal(extreme.axe.degres, -135);
  assert.ok(codes(extreme).includes("axe-extreme"));
});

test("segment ST et onde T : sus-décalage critique, sous-décalage, T inversées", () => {
  const ste = analyzeEcg(trace(), { stElevation: { II: 0.2 } });
  const alerte = ste.alertes.find((a) => a.code === "st-elevation");
  assert.equal(alerte?.niveau, "critical");
  assert.ok(alerte?.label.includes("II"));

  const std = analyzeEcg(trace(), { stDepression: { V4: 0.15 } });
  assert.ok(codes(std).includes("st-depression"));

  const t = analyzeEcg(trace(), { tInverted: ["V5", "V6"], peakedT: true });
  const inv = t.alertes.find((a) => a.code === "t-inversee");
  assert.ok(inv?.label.includes("V5, V6"));
  assert.ok(codes(t).includes("t-pointe"));
});

test("fiche digitalique (valeurs réelles) : PR long, bradycardie, cupule ST", () => {
  const d = analyzeEcg(
    trace({ bpm: 55, prIntervalMs: 240 }),
    { stDepression: { I: 0.1, aVL: 0.15, V4: 0.15, V5: 0.2, V6: 0.2 }, tInverted: ["aVL", "V5", "V6"] },
  );
  assert.deepEqual(d.pr, { valueMs: 240, status: "long" });
  assert.ok(codes(d).includes("bav-1"));
  assert.ok(codes(d).includes("bradycardie"));
  assert.ok(codes(d).includes("st-depression"));
  assert.ok(codes(d).includes("t-inversee"));
});

test("tri des alertes : critique avant avertissement", () => {
  const d = analyzeEcg(trace(), { stElevation: { II: 0.2 }, wideQrs: true });
  assert.equal(d.alertes[0].code, "st-elevation"); // critical devant qrs-large
});
