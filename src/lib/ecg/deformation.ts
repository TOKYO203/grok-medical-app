/* Déformation ECG selon pathologie — adapte le tracé au diagnostic. */

export type EcgDeformation = {
  rhythm?: string;
  stElevation?: Record<string, number>;
  stDepression?: Record<string, number>;
  wideQrs?: boolean;
  tInverted?: string[];
  peakedT?: boolean;
  pAbsent?: boolean;
  sawTooth?: boolean;
};

export type WaveParams = {
  P: { mu: number; a: number; sigma: number };
  Q: { mu: number; a: number; sigma: number };
  R: { mu: number; a: number; sigma: number };
  S: { mu: number; a: number; sigma: number };
  T: { mu: number; a: number; sigma: number };
};

const BASE: Record<string, WaveParams> = {
  II:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.20,sigma:0.010}, S:{mu:0.03,a:-0.30,sigma:0.010}, T:{mu:0.25,a:0.30,sigma:0.040} },
  III:  { P:{mu:-0.18,a:0.10,sigma:0.025}, Q:{mu:-0.02,a:-0.08,sigma:0.008}, R:{mu:0,a:0.70,sigma:0.010}, S:{mu:0.03,a:-0.20,sigma:0.010}, T:{mu:0.25,a:0.20,sigma:0.040} },
  aVR:  { P:{mu:-0.18,a:-0.15,sigma:0.025}, Q:{mu:-0.02,a:0.05,sigma:0.008}, R:{mu:0,a:-1.00,sigma:0.010}, S:{mu:0.03,a:0.20,sigma:0.010}, T:{mu:0.25,a:-0.25,sigma:0.040} },
  aVL:  { P:{mu:-0.18,a:0.08,sigma:0.025}, Q:{mu:-0.02,a:-0.05,sigma:0.008}, R:{mu:0,a:0.60,sigma:0.010}, S:{mu:0.03,a:-0.15,sigma:0.010}, T:{mu:0.25,a:0.15,sigma:0.040} },
  aVF:  { P:{mu:-0.18,a:0.12,sigma:0.025}, Q:{mu:-0.02,a:-0.08,sigma:0.008}, R:{mu:0,a:0.85,sigma:0.010}, S:{mu:0.03,a:-0.20,sigma:0.010}, T:{mu:0.25,a:0.22,sigma:0.040} },
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
