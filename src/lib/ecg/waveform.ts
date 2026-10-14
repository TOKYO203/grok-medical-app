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
function sourceParts(lead: string, cycleSec: number, n: number, wideQrs: boolean, pShiftSec = 0): CycleParts {
  const w = baseWave(lead);
  const widthScale = wideQrs ? 2.4 : 1;
  const p: number[] = [];
  const qrs: number[] = [];
  const t: number[] = [];
  const pMu = PHASE.p - pShiftSec; // décalage AVANT dérivation d'Einthoven
  for (let k = 0; k <= n; k++) {
    const ph = (k / n) * cycleSec;
    p.push(gauss(ph, { mu: pMu, a: w.P.a, sigma: w.P.sigma }));
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
  opts: { bpm: number; def?: EcgDeformation; samplesPerSec?: number; pShiftSec?: number; blocked?: boolean },
): number[] {
  const pShiftSec = opts.pShiftSec ?? 0;
  const blocked = opts.blocked ?? false;
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
    const a = sourceParts("I", cycleSec, n, wide, pShiftSec);
    const b = sourceParts("II", cycleSec, n, wide, pShiftSec);
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
    parts = sourceParts(lead, cycleSec, n, wide, pShiftSec);
  }

  // Surcouche clinique, appliquée par dérivation après dérivation d'Einthoven.
  const st = stOffsetMv(lead, def);
  const tScale = (def?.peakedT ? 2 : 1) * (def?.tInverted?.includes(lead) ? -1.4 : 1);
  const pScale = def?.pAbsent ? 0 : 1;
  const saw = def?.sawTooth ? 1 : 0;

  const out: number[] = [];
  for (let k = 0; k <= n; k++) {
    const ph = (k / n) * cycleSec;
    let v: number;
    if (blocked) {
      // P bloquée : ni QRS ni T (ventricule non dépolarisé). La P reste.
      v = pScale * parts.p[k];
    } else {
      v = pScale * parts.p[k] + parts.qrs[k] + tScale * parts.t[k];
      if (st !== 0 && ph > PHASE.stFrom && ph < PHASE.stTo) v += st;
      if (saw) v += 0.15 * Math.sin(ph * 2 * Math.PI * 5);
    }
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

// ═══════════════════════════════════════════════════════════════════════════
// Tracé multi-cycles avec déformations cliniques (v2)
// ═══════════════════════════════════════════════════════════════════════════
//
// Contrairement à `cyclePathMm` (1 cycle répété par <use>), cette fonction
// génère N cycles CONSÉCUTIFS qui peuvent différer (PR croissant, P bloquée,
// RR variable). Utilisée quand `def.prProgression` ou `def.rrVariability` est
// défini — sinon on garde l'optimisation du <use>.

/** PRNG déterministe (mulberry32) — reproductibilité SSR obligatoire. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function multiCyclePathMm(
  lead: string,
  opts: {
    bpm: number;
    cycles: number;
    def?: EcgDeformation;
    gainMmPerMv: number;
    mmPerSec: number;
    samplesPerSec?: number;
    maxWidthMm?: number;
  },
): { d: string; totalWidthMm: number; cycleSecs: number[] } {
  const def = opts.def;
  const prProg = def?.prProgression ?? "constant";
  const rrVar = def?.rrVariability ?? 0;
  const rand = prng(def?.rrSeed ?? 42);

  const baseBpm = Math.max(20, Math.min(240, opts.bpm));
  // PP = intervalle P-P constant (le nœud sinusal ne change pas de rythme).
  const PP = 60 / baseBpm;
  const sps = opts.samplesPerSec ?? CYCLE_SAMPLES_PER_SEC;
  // Garde anti-NaN : cycles = 0 → totalDur = 0 (division 0/0). Au moins 1 cycle (issue #39).
  const N = Math.max(1, opts.cycles);

  // ─── Liste des PR par cycle (secondes). -1 = P bloquée (aucun QRS). ───
  // PR normal = 0.16 s (160 ms). Wenckebach : +60 ms à chaque cycle
  // jusqu'au blocage, puis on recommence (motif 4:3 → 3 QRS + 1 bloqué).
  const buildPRList = (): number[] => {
    if (prProg === "wenckebach") {
      // Wenckebach pédagogique : PR augmente de façon MARQUÉE pour être
      // visible (160 → 280 → 420 ms), puis P bloquée. Pattern 4:3.
      const out: number[] = [];
      for (let i = 0; i < N; i++) {
        const k = i % 4;
        // PR progressifs : les deltas AUGMENTENT (0.14 puis 0.18)
        // → RR visibles ET pause très marquée au blocage
        const PR_EXAG = [0.18, 0.32, 0.50, -1];
        out.push(PR_EXAG[k]);
      }
      return out;
    }
    if (prProg === "mobitz2") {
      const every = def?.pBlockedEvery ?? 2;
      return Array.from({ length: N }, (_, i) =>
        (i + 1) % every === 0 ? -1 : 0.16,
      );
    }
    return new Array(N).fill(0.16);
  };

  const prList = buildPRList();

  // ─── Timeline : N intervalles PP, avec jitter optionnel sur P. ───
  const pTimes: number[] = [];
  let cursor = 0;
  for (let i = 0; i < N; i++) {
    pTimes.push(cursor);
    const jitter = rrVar > 0 ? (rand() - 0.5) * 2 * rrVar * PP : 0;
    cursor += PP + jitter;
  }
  const totalDur = cursor;
  const totalSamples = Math.max(2, Math.round(totalDur * sps));

  // Largeur : compression pour tenir dans TRACE_MM.
  const naturalWidthMm = totalDur * opts.mmPerSec;
  const maxWidth = opts.maxWidthMm ?? naturalWidthMm;
  const compFactor = naturalWidthMm > maxWidth ? maxWidth / naturalWidthMm : 1;
  const finalWidthMm = naturalWidthMm * compFactor;

  const w = baseWave(lead);
  const qOff = PHASE.q - PHASE.r;  // ~ -0.02 s
  const sOff = PHASE.s - PHASE.r;  // ~ +0.02 s
  const tOff = PHASE.t - PHASE.r;  // ~ +0.19 s

  // Surcouche clinique multi-cycles (parité avec cycleValues) : la FA
  // (pAbsent + rrVariability), les torsades (wideQrs + RR variable) et le
  // flutter (sawTooth) restent ainsi visibles aussi en mode multi-cycle.
  const pScale = def?.pAbsent ? 0 : 1;
  const widthScale = def?.wideQrs ? 2.4 : 1;
  const tScale = (def?.peakedT ? 2 : 1) * (def?.tInverted?.includes(lead) ? -1.4 : 1);
  const st = stOffsetMv(lead, def);
  const saw = def?.sawTooth ? 1 : 0;

  let d = "";
  for (let k = 0; k <= totalSamples; k++) {
    const t = (k / totalSamples) * totalDur;
    let v = 0;

    // Onde P à chaque temps pTimes[i] (supprimée si pAbsent — FA).
    for (let i = 0; i < N; i++) {
      v += pScale * gauss(t, { mu: pTimes[i], a: w.P.a, sigma: w.P.sigma });
    }

    // QRS + T pour chaque P non bloquée
    for (let i = 0; i < N; i++) {
      const pr = prList[i];
      if (pr < 0) continue;
      const tR = pTimes[i] + pr;
      v += gauss(t, { mu: tR + qOff, a: w.Q.a, sigma: w.Q.sigma }, 1, widthScale);
      v += gauss(t, { mu: tR, a: w.R.a, sigma: w.R.sigma }, 1, widthScale);
      v += gauss(t, { mu: tR + sOff, a: w.S.a, sigma: w.S.sigma }, 1, widthScale);
      v += tScale * gauss(t, { mu: tR + tOff, a: w.T.a, sigma: w.T.sigma });
      // Sus/sous-décalage ST sur la fenêtre qui suit R (parité cycleValues).
      if (st !== 0 && t > tR && t < tR + (PHASE.stTo - PHASE.stFrom)) v += st;
    }

    // Dents de scie (flutter) : oscillation continue ~5 Hz (≈ 300/min).
    if (saw) v += 0.15 * Math.sin(t * 2 * Math.PI * 5);

    const x = (t / totalDur) * finalWidthMm;
    const y = -v * opts.gainMmPerMv;
    d += (k === 0 ? "M" : " L ") + x.toFixed(2) + "," + y.toFixed(2);
  }

  const cycleSecs = new Array(N).fill(PP);
  return { d, totalWidthMm: finalWidthMm, cycleSecs };
}

