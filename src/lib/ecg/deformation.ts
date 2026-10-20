/* Déformation ECG selon pathologie — adapte le tracé au diagnostic.
 *
 * Pipeline (refonte 2026) :
 *   1. morphologie « source »   — DI, DII + V1…V6 (`BASE` ci-dessous)
 *   2. dérivation frontale      — DIII/aVR/aVL/aVF par la loi d'Einthoven
 *   3. déformation clinique     — sus/sous-décalage ST, onde T, dents de scie
 * La déformation est appliquée PAR DÉRIVATION après dérivation, en surcouche
 * (cf. `cycleValues()` dans waveform.ts). */

export type EcgDeformation = {
  rhythm?: string;
  stElevation?: Record<string, number>;
  stDepression?: Record<string, number>;
  wideQrs?: boolean;
  tInverted?: string[];
  peakedT?: boolean;
  pAbsent?: boolean;
  sawTooth?: boolean;
  /**
   * Fibrillation ventriculaire (issue #39) : chaos ventriculaire, ni P ni
   * QRS analysables. Testée en premier par `analyzeEcg` — le type
   * `EcgRythme` prévoyait « fv » sans jamais l'assigner.
   */
  fv?: boolean;

  // ── Déformations multi-cycles (v2) ────────────────────────────────────
  // Progression du PR entre cycles consécutifs :
  //   "constant"  = PR fixe (normal)
  //   "wenckebach" = PR s'allonge progressivement puis un cycle saute (BAV II M1)
  //   "mobitz2"   = PR constant mais P bloquée tous les N cycles
  prProgression?: "constant" | "wenckebach" | "mobitz2";
  // Pour mobitz2 : 1 P bloquée tous les N cycles (2 → 2:1, 3 → 3:1)
  pBlockedEvery?: number;
  // Variabilité du RR (FA, arythmie sinusale) : 0 = régulier, 0.3 = forte variabilité
  rrVariability?: number;
  // Seed du PRNG pour reproductibilité SSR (défaut : 42)
  rrSeed?: number;
};

export type WaveParams = {
  P: { mu: number; a: number; sigma: number };
  Q: { mu: number; a: number; sigma: number };
  R: { mu: number; a: number; sigma: number };
  S: { mu: number; a: number; sigma: number };
  T: { mu: number; a: number; sigma: number };
};

const BASE: Record<string, WaveParams> = {
  // ── Dérivations « source » du plan frontal ────────────────────────────────
  // DIII / aVR / aVL / aVF ne sont PLUS inventées ici : elles sont DÉRIVÉES de
  // DI et DII par la loi d'Einthoven (cf. `einthoven()` dans waveform.ts).
  //   DIII = DII − DI · aVR = −(DI+DII)/2 · aVL = DI − DII/2 · aVF = DII − DI/2
  I:    { P:{mu:-0.18,a:0.10,sigma:0.025}, Q:{mu:-0.02,a:-0.06,sigma:0.008}, R:{mu:0,a:0.80,sigma:0.010}, S:{mu:0.03,a:-0.12,sigma:0.010}, T:{mu:0.25,a:0.18,sigma:0.040} },
  II:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.20,sigma:0.010}, S:{mu:0.03,a:-0.30,sigma:0.010}, T:{mu:0.25,a:0.30,sigma:0.040} },
  // ── Dérivations précordiales ──────────────────────────────────────────────
  V1:   { P:{mu:-0.18,a:0.08,sigma:0.025}, Q:{mu:-0.02,a:-0.05,sigma:0.008}, R:{mu:0,a:0.35,sigma:0.010}, S:{mu:0.03,a:-0.80,sigma:0.010}, T:{mu:0.25,a:-0.15,sigma:0.040} },
  V2:   { P:{mu:-0.18,a:0.10,sigma:0.025}, Q:{mu:-0.02,a:-0.05,sigma:0.008}, R:{mu:0,a:0.55,sigma:0.010}, S:{mu:0.03,a:-0.95,sigma:0.010}, T:{mu:0.25,a:0.05,sigma:0.040} },
  V3:   { P:{mu:-0.18,a:0.12,sigma:0.025}, Q:{mu:-0.02,a:-0.08,sigma:0.008}, R:{mu:0,a:0.80,sigma:0.010}, S:{mu:0.03,a:-0.60,sigma:0.010}, T:{mu:0.25,a:0.20,sigma:0.040} },
  V4:   { P:{mu:-0.18,a:0.14,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.10,sigma:0.010}, S:{mu:0.03,a:-0.40,sigma:0.010}, T:{mu:0.25,a:0.28,sigma:0.040} },
  V5:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.25,sigma:0.010}, S:{mu:0.03,a:-0.25,sigma:0.010}, T:{mu:0.25,a:0.32,sigma:0.040} },
  V6:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.10,sigma:0.010}, S:{mu:0.03,a:-0.20,sigma:0.010}, T:{mu:0.25,a:0.30,sigma:0.040} },
};

export function baseWave(lead: string): WaveParams {
  return BASE[lead] ?? BASE.II;
}

export function stOffsetMv(lead: string, d?: EcgDeformation): number {
  if (!d) return 0;
  return (d.stElevation?.[lead] ?? 0) - (d.stDepression?.[lead] ?? 0);
}
