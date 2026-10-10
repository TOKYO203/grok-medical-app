import type { CardiacRhythm, IschemiaSeverity, Territory } from "@/core/ecg";

export type RhythmInput = {
  qrsDurationSec: number;
  regular: boolean;
  pWavePresent: boolean;
  prIntervalSec: number;
  heartRateBpm: number;
  sawTooth: boolean;
  noRsInPrecordials: boolean;
  rToSDelaySec: number;
};

export function classifyRhythm(input: RhythmInput): CardiacRhythm {
  const { qrsDurationSec, regular, pWavePresent, prIntervalSec, heartRateBpm, sawTooth, noRsInPrecordials, rToSDelaySec } = input;

  if (qrsDurationSec < 0.12) {
    if (regular) {
      if (pWavePresent) {
        if (prIntervalSec >= 0.12 && prIntervalSec <= 0.20) {
          if (heartRateBpm < 60) return "bradycardie-sinusale";
          if (heartRateBpm > 90) return "tachycardie-sinusale";
          return "sinusal";
        }
        if (prIntervalSec < 0.12) return "wpw";
      }
      if (sawTooth) return "flutter-auriculaire";
      if (heartRateBpm > 140) return "tachycardie-jonctionnelle";
      return "sinusal";
    }
    if (!pWavePresent) return "fibrillation-auriculaire";
    return "sinusal";
  }

  if (regular) {
    if (noRsInPrecordials || rToSDelaySec > 0.10) return "tachycardie-ventriculaire";
    return "tachycardie-ventriculaire";
  }
  return "torsade-de-pointes";
}

export type StSegmentInput = {
  elevationMv: number;
  depressionMv: number;
  qWavePathological: boolean;
};

export function classifyIschemia(input: StSegmentInput): IschemiaSeverity {
  if (input.elevationMv >= 0.1) return "lesion-sous-epicardique";
  if (input.depressionMv >= 0.1) return "ischemie-sous-endocardique";
  if (input.qWavePathological) return "sequelle-necrose";
  return "normal";
}

export const TERRITORY_LEADS: Record<Territory, readonly string[]> = {
  anterieur: ["V1", "V2", "V3"],
  "septal-apical": ["V3", "V4"],
  lateral: ["DI", "aVL", "V5", "V6"],
  inferieur: ["DII", "DIII", "aVF"],
  posterieur: ["V7", "V8", "V9"],
};

export function guessTerritory(touchedLeads: string[]): Territory | null {
  for (const [terr, leads] of Object.entries(TERRITORY_LEADS) as [Territory, readonly string[]][]) {
    if (touchedLeads.every((l) => leads.includes(l)) && touchedLeads.length >= 2) return terr;
  }
  return null;
}
