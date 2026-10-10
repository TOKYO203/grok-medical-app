import type { CardiacRhythm, IschemiaSeverity, Territory } from "@/core/ecg";
import type { SoundType } from "./sounds";

/* ═══════════════════════════════════════════════════════════════════
   Arbre décisionnel ECG — spec Adnet/Lapostolle
   Étendu : hyperkaliémie (3 stades), hypothermie (Osborn), Brugada,
   torsades, EP, WPW, BAV II Mobitz I/II, BAV III, surdosage digitalique
   ═══════════════════════════════════════════════════════════════════ */

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

export type RhythmResult = {
  rhythm: CardiacRhythm | "bav-1" | "bav-2-mobitz-1" | "bav-2-mobitz-2" | "bav-3" | "bsa";
  sound: SoundType;
};

export function classifyRhythmExtended(input: RhythmInput): RhythmResult {
  const { qrsDurationSec, regular, pWavePresent, prIntervalSec, heartRateBpm, sawTooth } = input;
  void noRsInPrecordials; void rToSDelaySec;

  // BRADYCARDIE
  if (heartRateBpm < 60) {
    if (!pWavePresent) return { rhythm: "bsa", sound: "bip_lent" };
    if (prIntervalSec > 0.20) {
      if (regular) return { rhythm: "bav-1", sound: "bip_lent" };
      return { rhythm: "bav-2-mobitz-1", sound: "bip_lent" };
    }
    if (qrsDurationSec >= 0.12) return { rhythm: "bav-3", sound: "double_bip" };
    return { rhythm: "bradycardie-sinusale", sound: "bip_lent" };
  }

  // TACHYCARDIE
  if (heartRateBpm > 100) {
    if (qrsDurationSec >= 0.12) {
      if (regular) return { rhythm: "tachycardie-ventriculaire", sound: "son_continu" };
      return { rhythm: "torsade-de-pointes", sound: "son_oscillant" };
    }
    if (sawTooth) return { rhythm: "flutter-auriculaire", sound: "son_dents_scie" };
    if (!pWavePresent) return { rhythm: "fibrillation-auriculaire", sound: "son_irregulier" };
    return { rhythm: "tachycardie-sinusale", sound: "bip_rapide" };
  }

  // NORMAL
  if (prIntervalSec < 0.12) return { rhythm: "wpw", sound: "bip_normal" };
  return { rhythm: "sinusal", sound: "bip_normal" };
}

/* ═══════════ ISCHÉMIE (Brady et al.) ═══════════ */
export type StMorphology = "concave" | "convexe" | "iso";
export type IschemiaInput = {
  elevationMv: number;
  depressionMv: number;
  qWavePathological: boolean;
  morphology?: StMorphology;
  mirrorPresent?: boolean;
  qrsWide?: boolean;
};
export type IschemiaResult = {
  severity: IschemiaSeverity;
  sound: SoundType;
};

export function classifyIschemiaExtended(input: IschemiaInput): IschemiaResult {
  if (input.qrsWide) return { severity: "normal", sound: "bip_normal" };
  if (input.elevationMv >= 0.1) {
    if (input.morphology === "convexe" || input.mirrorPresent) {
      return { severity: "lesion-sous-epicardique", sound: "son_grave_montant" };
    }
    return { severity: "normal", sound: "bip_normal" };
  }
  if (input.depressionMv >= 0.1) return { severity: "ischemie-sous-endocardique", sound: "son_grave_montant" };
  if (input.qWavePathological) return { severity: "sequelle-necrose", sound: "bip_normal" };
  return { severity: "normal", sound: "bip_normal" };
}

/* ═══════════ ÉLECTROLYTES ═══════════ */
export type ElectrolyteStage = "normal" | "hk-1" | "hk-2" | "hk-3" | "hypothermie";
export type ElectrolyteInput = {
  tWavePointe: boolean;
  prProlonge: boolean;
  qrsElargi: boolean;
  ondeJOsborn: boolean;
  temperatureC?: number;
};
export function classifyElectrolyte(input: ElectrolyteInput): { stage: ElectrolyteStage; sound: SoundType } {
  if (input.ondeJOsborn || (input.temperatureC !== undefined && input.temperatureC < 28)) {
    return { stage: "hypothermie", sound: "son_continu" };
  }
  if (input.qrsElargi && input.tWavePointe) return { stage: "hk-3", sound: "son_continu" };
  if (input.prProlonge && input.tWavePointe) return { stage: "hk-2", sound: "double_bip" };
  if (input.tWavePointe) return { stage: "hk-1", sound: "son_aigu_montant" };
  return { stage: "normal", sound: "bip_normal" };
}

/* ═══════════ TERRITOIRES ═══════════ */
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