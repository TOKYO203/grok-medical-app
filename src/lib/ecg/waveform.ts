/**
 * Générateur de tracé ECG synthétique — modèle gaussien.
 *
 *   f(t) = Σ_i a_i · exp( -(t - μ_i)² / (2·σ_i²) )   pour i ∈ {P, Q, R, S, T}
 *
 * Paramètres par défaut issus du "Guide Pratique de l'ECG" (cycle de 1 s).
 * Σ (sigma) : largeur du pic — valeurs physiologiques standards.
 */

import type { EcgTraceParams, WaveGaussian } from "@/core/ecg";

/** Paramètres par défaut d'un cycle sinusal normal (μ en s, offset relatif au R). */
export const DEFAULT_WAVES: EcgTraceParams["waves"] = {
  P: { mu: -0.18, a:  0.15, sigma: 0.025 },
  Q: { mu: -0.02, a: -0.15, sigma: 0.008 },
  R: { mu:  0.00, a:  1.20, sigma: 0.010 },
  S: { mu:  0.03, a: -0.35, sigma: 0.010 },
  T: { mu:  0.25, a:  0.30, sigma: 0.040 },
};

export type EcgPoint = { t: number; v: number };

/** Évalue une gaussienne à l'instant `t` (secondes). */
function gaussian(t: number, w: WaveGaussian): number {
  const d = t - w.mu;
  return w.a * Math.exp(-(d * d) / (2 * w.sigma * w.sigma));
}

/** Génère un échantillon (t, v) pour un cycle donné. */
export function sampleCycle(
  cycleStartSec: number,
  waves: EcgTraceParams["waves"] = DEFAULT_WAVES,
  samplesPerSec = 500,
  cycleSec = 1,
): EcgPoint[] {
  const points: EcgPoint[] = [];
  const n = Math.round(cycleSec * samplesPerSec);
  for (let i = 0; i <= n; i++) {
    const t = i / samplesPerSec;
    const v =
      gaussian(t, waves.P) +
      gaussian(t, waves.Q) +
      gaussian(t, waves.R) +
      gaussian(t, waves.S) +
      gaussian(t, waves.T);
    points.push({ t: cycleStartSec + t, v });
  }
  return points;
}

/** Génère `cycles` cycles à partir de `bpm` (le cycle est étiré pour respecter la FC). */
export function generateTrace(params: EcgTraceParams): EcgPoint[] {
  const cycleSec = 60 / params.bpm;
  const samplesPerSec = 500;
  const out: EcgPoint[] = [];
  for (let c = 0; c < params.cycles; c++) {
    const pts = sampleCycle(c * cycleSec, params.waves, samplesPerSec, cycleSec);
    if (c > 0) pts.shift(); // évite le doublon au raccord
    out.push(...pts);
  }
  return out;
}

/** Convertit une liste de points (t, v) en path SVG viewBox 1200×320. */
export function traceToSvgPath(
  points: EcgPoint[],
  opts: {
    width?: number;
    height?: number;
    paddingX?: number;
    paddingY?: number;
    durationSec: number;
    maxMv?: number;
  },
): string {
  const W = opts.width ?? 1200;
  const H = opts.height ?? 320;
  const PX = opts.paddingX ?? 40;
  const PY = opts.paddingY ?? 20;
  const dur = opts.durationSec;
  const maxMv = opts.maxMv ?? 1.6;
  const halfH = (H - 2 * PY) / 2;
  const yCenter = H / 2;

  let d = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = PX + (p.t / dur) * (W - 2 * PX);
    const y = yCenter - (p.v / maxMv) * halfH;
    d += (i === 0 ? "M " : "L ") + x.toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return d.trim();
}
