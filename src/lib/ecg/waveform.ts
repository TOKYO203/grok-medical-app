/**
 * Générateur de tracé ECG synthétique — modèle gaussien.
 *
 *   f(t) = Σ_i a_i · exp( -(t - μ_i)² / (2·σ_i²) )   pour i ∈ {P, Q, R, S, T}
 *
 * Paramètres par défaut issus du "Guide Pratique de l'ECG" (cycle de 1 s).
 * σ (sigma) : largeur du pic — valeurs physiologiques standards.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Refonte 2026 — « un cycle, répété »
 * ─────────────────────────────────────────────────────────────────────────
 * Le moniteur ne matérialise plus un long tracé (avant : 60 s × 250 Hz ×
 * 12 dérivations ≈ 150 000 points et ~2 Mo d'attributs `d`). On décrit
 * désormais UN SEUL cycle cardiaque par dérivation (`cyclePathMm`) ; le
 * moniteur le répète à l'infini via des `<use>` SVG décalés d'une largeur de
 * cycle (périodicité du rythme sinusal). Le coût de génération ne dépend donc
 * plus de la durée affichée, et le défilement se réduit au `translate` d'un
 * groupe.
 *
 * Les dérivations frontales ne sont plus inventées : DIII / aVR / aVL / aVF
 * sont DÉRIVÉES de DI et DII par la loi d'Einthoven (`einthoven`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Limitations connues (v1)
 * ─────────────────────────────────────────────────────────────────────────
 * 1. **FA « régulière »** — un rythme irrégulier (fibrillation auriculaire)
 *    est rendu avec un cycle R-R CONSTANT : le tracé paraît régulier alors
 *    qu'une FA réelle est irrégulière. Accepté pour la v1 (déterminisme du
 *    rendu, lisibilité pédagogique, continuité parfaite du `<use>`).
 *    TODO v2 — modulation aléatoire du cycle R-R (jitter RR).
 * 2. **Gain plancher à 5 mm/mV** — sur un écran court, l'amplitude peut
 *    écrêter la hauteur de ligne plutôt que de descendre à 2,5 mm/mV ;
 *    limite assumée (cf. `README.md` du dossier ECG).
 */

import type { EcgTraceParams } from "@/core/ecg";
import { baseWave, stOffsetMv, type EcgDeformation } from "./deformation";

/** Morphologie de référence d'un cycle sinusal normal (mV). */
export const DEFAULT_WAVES: EcgTraceParams["waves"] = {
  P: { mu: -0.18, a: 0.15, sigma: 0.025 },
  Q: { mu: -0.02, a: -0.15, sigma: 0.008 },
  R: { mu: 0.0, a: 1.2, sigma: 0.01 },
  S: { mu: 0.03, a: -0.35, sigma: 0.01 },
  T: { mu: 0.25, a: 0.3, sigma: 0.04 },
};

/** Échantillons par seconde pour UN cycle (perf : 250 Hz suffisent au rendu). */
export const CYCLE_SAMPLES_PER_SEC = 250;

/**
 * Phases fixes P / QRS / ST / T dans le cycle (secondes depuis le début du
 * cycle). Le QRS est ancré (≈ 0,28 s) plutôt qu'étiré avec le R-R : c'est le
 * choix historique du moniteur, conservé pour la stabilité du rendu.
 */
const PHASE = { p: 0.16, q: 0.26, r: 0.28, s: 0.30, stFrom: 0.28, stTo: 0.42, t: 0.47 } as const;

/**
 * Morphologie du pouls pléthysmographique (SpO₂) — forme qualitative.
 * Amplitudes volontairement < 1 « mV » pour ne pas remplir toute la ligne
 * (le pléthysmogramme n'est pas une dérivation : 1 mV ≈ 10 mm au gain 10).
 */
const PLETH = {
  systolic: { mu: 0.18, a: 0.55, sigma: 0.045 },
  dicrotic: { mu: 0.36, a: 0.16, sigma: 0.055 },
} as const;

/** Dérivations frontales calculées à partir de DI et DII (loi d'Einthoven). */
export const DERIVED_LIMB_LEADS = ["III", "aVR", "aVL", "aVF"] as const;
export type DerivedLimbLead = (typeof DERIVED_LIMB_LEADS)[number];

export function isDerivedLimbLead(lead: string): lead is DerivedLimbLead {
  return (DERIVED_LIMB_LEADS as readonly string[]).includes(lead);
}

/**
 * Loi d'Einthoven appliquée point à point à DI et DII :
 *   DIII = DII − DI · aVR = −(DI + DII) / 2 · aVL = DI − DII / 2 · aVF = DII − DI / 2
 */
export function einthoven(i: number, ii: number): Record<DerivedLimbLead, number> {
  return { III: ii - i, aVR: -(i + ii) / 2, aVL: i - ii / 2, aVF: ii - i / 2 };
}

type Gauss = { mu: number; a: number; sigma: number };

/** Évalue une gaussienne (amplitude et largeur éventuellement mises à l'échelle). */
function gauss(t: number, g: Gauss, ampScale = 1, widthScale = 1): number {
  const d = t - g.mu;
  const s = g.sigma * widthScale;
  return ampScale * g.a * Math.exp(-(d * d) / (2 * s * s));
}

/** Un cycle décomposé par onde, pour pouvoir appliquer la déformation par dérivation. */
type CycleParts = { p: number[]; qrs: number[]; t: number[] };

/** Morphologie d'un cycle pour une dérivation « source » (DI, DII, V1…V6). */
function sourceParts(lead: string, cycleSec: number, n: number, wideQrs: boolean): CycleParts {
  const w = baseWave(lead);
  const widthScale = wideQrs ? 2.4 : 1;
  const p: number[] = [];
  const qrs: number[] = [];
  const t: number[] = [];
  for (let k = 0; k <= n; k++) {
    const ph = (k / n) * cycleSec;
    p.push(gauss(ph, { mu: PHASE.p, a: w.P.a, sigma: w.P.sigma }));
    qrs.push(
      gauss(ph, { mu: PHASE.q, a: w.Q.a, sigma: w.Q.sigma }, 1, widthScale) +
        gauss(ph, { mu: PHASE.r, a: w.R.a, sigma: w.R.sigma }, 1, widthScale) +
        gauss(ph, { mu: PHASE.s, a: w.S.a, sigma: w.S.sigma }, 1, widthScale),
    );
    t.push(gauss(ph, { mu: PHASE.t, a: w.T.a, sigma: w.T.sigma }));
  }
  return { p, qrs, t };
}

/**
 * Un cycle complet d'une dérivation, en mV, déformation clinique appliquée.
 * Les dérivations frontales dérivées (DIII/aVR/aVL/aVF) partent de DI & DII
 * (les déformations ST / onde T y sont ensuite appliquées, par dérivation).
 */
export function cycleValues(
  lead: string,
  opts: { bpm: number; def?: EcgDeformation; samplesPerSec?: number },
): number[] {
  const bpm = Math.max(20, Math.min(240, opts.bpm));
  const cycleSec = 60 / bpm;
  const sps = opts.samplesPerSec ?? CYCLE_SAMPLES_PER_SEC;
  const n = Math.max(2, Math.round(cycleSec * sps));
  const def = opts.def;

  if (lead === "PLETH") {
    const out: number[] = [];
    for (let k = 0; k <= n; k++) {
      const ph = (k / n) * cycleSec;
      out.push(gauss(ph, PLETH.systolic) + gauss(ph, PLETH.dicrotic));
    }
    return out;
  }

  const wide = def?.wideQrs ?? false;
  let parts: CycleParts;
  if (isDerivedLimbLead(lead)) {
    const a = sourceParts("I", cycleSec, n, wide);
    const b = sourceParts("II", cycleSec, n, wide);
    const p: number[] = [];
    const qrs: number[] = [];
    const t: number[] = [];
    for (let k = 0; k <= n; k++) {
      const der = einthoven(a.p[k], b.p[k]);
      p.push(der[lead]);
      const derQ = einthoven(a.qrs[k], b.qrs[k]);
      qrs.push(derQ[lead]);
      const derT = einthoven(a.t[k], b.t[k]);
      t.push(derT[lead]);
    }
    parts = { p, qrs, t };
  } else {
    parts = sourceParts(lead, cycleSec, n, wide);
  }

  // Surcouche clinique, appliquée par dérivation après dérivation d'Einthoven.
  const st = stOffsetMv(lead, def);
  const tScale = (def?.peakedT ? 2 : 1) * (def?.tInverted?.includes(lead) ? -1.4 : 1);
  const pScale = def?.pAbsent ? 0 : 1;
  const saw = def?.sawTooth ? 1 : 0;

  const out: number[] = [];
  for (let k = 0; k <= n; k++) {
    const ph = (k / n) * cycleSec;
    let v = pScale * parts.p[k] + parts.qrs[k] + tScale * parts.t[k];
    if (st !== 0 && ph > PHASE.stFrom && ph < PHASE.stTo) v += st;
    if (saw) v += 0.15 * Math.sin(ph * 2 * Math.PI * 5);
    out.push(v);
  }
  return out;
}

/**
 * Chemin SVG d'UN cycle cardiaque, dans le repère « papier » (1 unité = 1 mm) :
 *   x = t × mmPerSec        (25 mm/s)
 *   y = − v × gainMmPerMv   (10 ou 5 mm/mV), relatif à la ligne de base (y = 0)
 *
 * Le moniteur répète ce chemin via des `<use>` (périodicité du cycle) : le
 * chemin n'a donc pas à couvrir la largeur affichée.
 */
export function cyclePathMm(
  lead: string,
  opts: {
    bpm: number;
    def?: EcgDeformation;
    gainMmPerMv: number;
    mmPerSec: number;
    samplesPerSec?: number;
  },
): { d: string; cycleSec: number; widthMm: number } {
  const bpm = Math.max(20, Math.min(240, opts.bpm));
  const cycleSec = 60 / bpm;
  const sps = opts.samplesPerSec ?? CYCLE_SAMPLES_PER_SEC;
  const n = Math.max(2, Math.round(cycleSec * sps));
  const vals = cycleValues(lead, { bpm, def: opts.def, samplesPerSec: sps });
  const widthMm = cycleSec * opts.mmPerSec;
  const step = widthMm / n;
  let d = "";
  for (let k = 0; k <= n; k++) {
    const x = k * step;
    const y = -vals[k] * opts.gainMmPerMv;
    d += (k === 0 ? "M" : " L ") + x.toFixed(2) + "," + y.toFixed(2);
  }
  return { d, cycleSec, widthMm };
}
