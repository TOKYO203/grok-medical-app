/* Verrous du générateur ECG par lecture de source — Session 12 (G52).
 * `waveform.ts` importe "./deformation" sans extension : node --experimental-strip-types
 * ne résout pas les imports sans extension, le module est inchargeable sous Node.
 * On verrouille donc son comportement par littéraux sur la source — précédent
 * Session 3 : business-model.test.mjs lit le code de la même façon. Moteur inchangé. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const rootDir = new URL("../../../", import.meta.url).pathname;
let cached: string | undefined;

async function waveformSource(): Promise<string> {
  if (cached === undefined) {
    cached = await readFile(join(rootDir, "src/lib/ecg/waveform.ts"), "utf8");
  }
  return cached;
}

function expectLiteral(src: string, literal: string): void {
  assert.ok(src.includes(literal), "waveform.ts doit contenir : " + literal);
}

test("loi d'Einthoven : dérivations frontales dérivées de DI et DII", async () => {
  const src = await waveformSource();
  expectLiteral(src, "III: ii - i");
  expectLiteral(src, "aVR: -(i + ii) / 2");
  expectLiteral(src, "aVL: i - ii / 2");
  expectLiteral(src, "aVF: ii - i / 2");
  expectLiteral(src, 'DERIVED_LIMB_LEADS = ["III", "aVR", "aVL", "aVF"]');
});

test("fréquence clampée et géométrie papier du tracé", async () => {
  const src = await waveformSource();
  expectLiteral(src, "Math.max(20, Math.min(240, opts.bpm))");
  expectLiteral(src, "const cycleSec = 60 / bpm;");
  expectLiteral(src, "const N = Math.max(1, opts.cycles);");
  expectLiteral(src, "const widthMm = cycleSec * opts.mmPerSec;");
  expectLiteral(src, "const y = -vals[k] * opts.gainMmPerMv;");
});

test("morphologie de référence : phases et ondes par défaut", async () => {
  const src = await waveformSource();
  expectLiteral(
    src,
    "const PHASE = { p: 0.16, q: 0.26, r: 0.28, s: 0.30, stFrom: 0.28, stTo: 0.42, t: 0.47 } as const;",
  );
  expectLiteral(src, "P: { mu: -0.18, a: 0.15, sigma: 0.025 }");
  expectLiteral(src, "R: { mu: 0.0, a: 1.2, sigma: 0.01 }");
  expectLiteral(src, "T: { mu: 0.25, a: 0.3, sigma: 0.04 }");
});

test("blocs AV : Wenckebach, Mobitz II et PR constant", async () => {
  const src = await waveformSource();
  expectLiteral(src, "const PR_EXAG = [0.18, 0.32, 0.50, -1];");
  expectLiteral(src, "new Array(N).fill(");
  expectLiteral(src, "def?.prIntervalMs !== undefined");
  expectLiteral(src, "const every = def?.pBlockedEvery ?? 2;");
  expectLiteral(src, "(i + 1) % every === 0 ? -1 : 0.16");
});

test("PRNG déterministe mulberry32, seed persistée", async () => {
  const src = await waveformSource();
  expectLiteral(src, "0x6D2B79F5");
  expectLiteral(src, "prng(def?.rrSeed ?? 42)");
});

test("surcouche clinique : dents de scie et P bloquée", async () => {
  const src = await waveformSource();
  expectLiteral(src, "Math.sin(ph * 2 * Math.PI * 5)");
  expectLiteral(src, "Math.sin(t * 2 * Math.PI * 5)");
  expectLiteral(src, "v = pScale * parts.p[k];");
  expectLiteral(src, "if (pr < 0) continue;");
});

test("fidélité clinique v3 : PR de la fiche, onde J, formes ST, 50 Hz, torsades", async () => {
  const src = await waveformSource();
  // PR long/court rendu (hyperkaliémie 220 ms, digitalique 240 ms)
  expectLiteral(src, "const prShift = targetPrSec !== null ? targetPrSec - basePrSec : 0;");
  // Onde J d'Osborn (hypothermie) : bosse gaussienne au point J
  expectLiteral(src, "gauss(ph, { mu: PHASE.s + 0.03, a: jWave, sigma: 0.035 })");
  expectLiteral(src, 'v += gauss(t, { mu: tR + sOff + 0.03, a: jWave, sigma: 0.035 });');
  // Formes ST : dôme décroissant (Brugada) et cupule (digitalique)
  expectLiteral(src, "if (def?.stCoved) v += st * Math.pow(1 - f, 1.6);");
  expectLiteral(src, "else if (def?.stScooped || def?.stConcave) v += st * Math.sin(Math.PI * f);");
  // Artefact secteur 50 Hz (parasitage SNCF) sur les deux chemins de rendu
  expectLiteral(src, "v += noise * Math.sin(ph * 2 * Math.PI * 50);");
  expectLiteral(src, "if (noise !== 0) v += noise * Math.sin(t * 2 * Math.PI * 50);");
  // Torsades : accordéon — l'amplitude des QRS tourne entre battements
  expectLiteral(src, "const beatAmp = twist ? 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * (i + 0.5)) / 5)) : 1;");
});

test("fidélité clinique v4 : QT adaptatif Bazett, P inversée, PR sous-décalé, ST concave", async () => {
  const src = await waveformSource();
  expectLiteral(src, "const qtScale = Math.max(0.55, Math.min(1.35, Math.sqrt(cycleSec / 0.8)));");
  expectLiteral(src, "if (def?.pFlip?.includes(lead)) parts = { ...parts, p: parts.p.map((v) => -v) };");
  expectLiteral(src, "if (prDep !== 0 && ph > PHASE.p + 0.07 && ph < PHASE.q) v += prDep;");
  expectLiteral(src, "else if (def?.stScooped || def?.stConcave) v += st * Math.sin(Math.PI * f);");
  expectLiteral(src, "const qtScale = Math.max(0.55, Math.min(1.35, Math.sqrt(PP / 0.8)));");
  expectLiteral(src, "const pAmp = def?.pFlip?.includes(lead) ? -w.P.a : w.P.a;");
  expectLiteral(src, "if (t > tQ - 0.06 && t < tQ - 0.02) v += prDep;");
});
