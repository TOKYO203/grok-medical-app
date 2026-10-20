/**
 * Moteur d'analyse ECG automatique.
 *
 * Prend une trace + déformation et produit un diagnostic structuré
 * (fréquence, rythme, PR, QRS, axe, alertes). Aucune dépendance React,
 * aucun rendu — testable en isolation.
 *
 * Algorithme inspiré de la séquence F-R-P-L-Q-S-T (Hampton, L'ECG facile).
 * Les règles sont NOUS-MÊMES rédigées, pas copiées.
 */

import type { EcgTraceParams } from "@/core/ecg";
import type { EcgDeformation } from "@/lib/ecg/deformation";
// Extension explicite : node --experimental-strip-types ne résout pas les
// imports sans extension (cf. waveform.test.ts) — l'analyseur devient
// chargeable sous Node et testé en direct par analyzeEcg.test.ts.
import { qrsAxisDeg } from "./analysis.ts";

export type EcgAlerteNiveau = "normal" | "info" | "warning" | "critical";

export interface EcgAlerte {
  niveau: EcgAlerteNiveau;
  code: string;
  label: string;
  description?: string;
}

export type EcgRythme =
  | "sinusal"
  | "sinusal-irregulier"
  | "fa"
  | "flutter"
  | "tv"
  | "fv"
  | "indetermine";

export interface EcgDiagnosis {
  fc: number;
  rythme: EcgRythme;
  pr: { valueMs: number; status: "normal" | "long" | "court" | "progressif" | "absent" } | null;
  qrs: { dureeMs: number; status: "fin" | "large" };
  axe: { degres: number; status: "normal" | "gauche" | "droite" | "extreme" };
  alertes: EcgAlerte[];
}

/**
 * Analyse une trace ECG.
 * @param trace la trace (waves + bpm + cycles)
 * @param def la déformation clinique appliquée (optionnelle)
 */
export function analyzeEcg(trace: EcgTraceParams, def?: EcgDeformation): EcgDiagnosis {
  const alertes: EcgAlerte[] = [];

  // ─── F : Fréquence ─────────────────────────────────────────────────
  const fc = Math.round(trace.bpm);

  // ─── R : Rythme ────────────────────────────────────────────────────
  // FV d'abord (issue #39) : le chaos ventriculaire prime sur toute autre
  // lecture — « fv » existait dans le type sans jamais être assigné.
  let rythme: EcgRythme = "sinusal";
  if (def?.fv) {
    rythme = "fv";
    alertes.push({
      niveau: "critical",
      code: "fv",
      label: "Fibrillation ventriculaire",
      description: "Arrêt cardio-circulatoire — choc électrique immédiat + réanimation.",
    });
  } else if (def?.prProgression === "wenckebach") {
    rythme = "sinusal-irregulier";
  } else if (def?.pAbsent && (def.rrVariability ?? 0) > 0.1) {
    rythme = "fa";
  } else if (def?.sawTooth) {
    rythme = "flutter";
  } else if (def?.wideQrs && fc > 100) {
    rythme = "tv";
  }

  // ─── P : Onde P et PR ──────────────────────────────────────────────
  let pr: EcgDiagnosis["pr"] = null;
  if (def?.fv) {
    pr = null; // ni P ni PR analysables en FV
  } else if (!def?.pAbsent) {
    if (def?.prProgression === "wenckebach") {
      pr = { valueMs: 180, status: "progressif" };
      alertes.push({
        niveau: "warning",
        code: "bav-2-mobitz1",
        label: "BAV II Mobitz I (Wenckebach)",
        description: "PR progressivement croissant jusqu'à blocage d'une P.",
      });
    } else if (def?.prProgression === "mobitz2") {
      pr = { valueMs: 180, status: "normal" };
      alertes.push({
        niveau: "critical",
        code: "bav-2-mobitz2",
        label: "BAV II Mobitz II",
        description: "PR constant, blocage intermittent — risque de BAV complet.",
      });
    } else {
      // PR piloté par les données (issue #39) : valeur explicite de la fiche
      // (`trace.prIntervalMs`) sinon dérivée de la morphologie (R.mu − P.mu),
      // sinon 160 ms. Les branches BAV I (> 200 ms) et PR court (< 120 ms)
      // sont désormais atteignables au lieu d'être du code mort.
      const derivedPrMs = Math.round((trace.waves.R.mu - trace.waves.P.mu) * 1000);
      const prMs = trace.prIntervalMs ?? (derivedPrMs > 0 ? derivedPrMs : 160);
      if (prMs > 200) {
        pr = { valueMs: prMs, status: "long" };
        alertes.push({ niveau: "info", code: "bav-1", label: "BAV I" });
      } else if (prMs < 120) {
        pr = { valueMs: prMs, status: "court" };
        alertes.push({ niveau: "info", code: "pr-court", label: "PR court (WPW ?)" });
      } else {
        pr = { valueMs: prMs, status: "normal" };
      }
    }
  } else {
    pr = null;
    alertes.push({
      niveau: "warning",
      code: "fa-abs",
      label: "Onde P absente",
      description: "Évoquer FA, flutter à conduction variable, ou rythme jonctionnel.",
    });
  }

  // ─── L : Largeur QRS ───────────────────────────────────────────────
  const qrsDureeMs = def?.wideQrs ? 140 : 90;
  const qrsStatus: "fin" | "large" = qrsDureeMs >= 120 ? "large" : "fin";
  if (qrsStatus === "large") {
    alertes.push({
      niveau: "warning",
      code: "qrs-large",
      label: "QRS large",
      description: "Bloc de branche, conduction ventriculaire aberrante, ou rythme ventriculaire.",
    });
  }

  // ─── Axe (approximation à partir des amplitudes I / aVF) ───────────
  // Deux amplitudes INDÉPENDANTES (issue #39) : `trace.axisAmplitudes`
  // porte les amplitudes nettes du QRS en DI et aVF ; sans lui, tout dérive
  // du même `waves.R` et l'axe reste « normal » quoi qu'il arrive (branches
  // gauche/droite inatteignables, « extreme » jamais assignée).
  const ampI = trace.axisAmplitudes?.i ?? trace.waves.R.a * 0.8; // R en DI
  const ampII = trace.waves.R.a; // R en DII
  const ampAVF = trace.axisAmplitudes?.avf ?? ampII - ampI / 2; // aVF = DII − DI/2
  // Degrés via atan2 (analysis.qrsAxisDeg) — valeurs homogènes par branche.
  let axeDegres = 60;
  let axeStatus: "normal" | "gauche" | "droite" | "extreme" = "normal";
  if (ampI > 0 && ampAVF > 0) {
    axeDegres = qrsAxisDeg(ampI, ampAVF);
    axeStatus = "normal";
  } else if (ampI > 0 && ampAVF < 0) {
    axeDegres = qrsAxisDeg(ampI, ampAVF);
    axeStatus = "gauche";
    alertes.push({
      niveau: "info",
      code: "axe-gauche",
      label: "Déviation axiale gauche",
      description: "Hémibloc antérieur gauche, HVG, ou infarctus inférieur.",
    });
  } else if (ampI < 0 && ampAVF > 0) {
    axeDegres = qrsAxisDeg(ampI, ampAVF);
    axeStatus = "droite";
    alertes.push({
      niveau: "info",
      code: "axe-droit",
      label: "Déviation axiale droite",
      description: "HVD, embolie pulmonaire, ou bloc fasciculaire postérieur.",
    });
  } else if (ampI < 0 && ampAVF < 0) {
    // Axe « extrême » (nord-ouest) — branche inatteignable avant l'issue #39.
    axeDegres = qrsAxisDeg(ampI, ampAVF);
    axeStatus = "extreme";
    alertes.push({
      niveau: "info",
      code: "axe-extreme",
      label: "Axe QRS extrême (nord-ouest)",
      description: "IDM ancien étendu, hyperkaliémie sévère, ou dérivations mal posées.",
    });
  }

  // ─── S : Segment ST (via stElevation / stDepression) ───────────────
  if (def?.stElevation && Object.keys(def.stElevation).length > 0) {
    const leads = Object.keys(def.stElevation).join(", ");
    alertes.push({
      niveau: "critical",
      code: "st-elevation",
      label: `Sus-décalage ST (${leads})`,
      description: "IDM ST+ ou péricardite — corréler au contexte clinique.",
    });
  }
  if (def?.stDepression && Object.keys(def.stDepression).length > 0) {
    const leads = Object.keys(def.stDepression).join(", ");
    alertes.push({
      niveau: "warning",
      code: "st-depression",
      label: `Sous-décalage ST (${leads})`,
      description: "Ischémie, HVG, ou effet digitalique.",
    });
  }

  // ─── T : Onde T ────────────────────────────────────────────────────
  if (def?.tInverted && def.tInverted.length > 0) {
    alertes.push({
      niveau: "warning",
      code: "t-inversee",
      label: `Onde T inversée (${def.tInverted.join(", ")})`,
      description: "Ischémie, HVG, embolie pulmonaire.",
    });
  }
  if (def?.peakedT) {
    alertes.push({
      niveau: "warning",
      code: "t-pointe",
      label: "Onde T pointue",
      description: "Hyperkaliémie à évoquer.",
    });
  }

  // ─── Fréquence anormale ────────────────────────────────────────────
  if (fc > 100) {
    alertes.push({ niveau: "warning", code: "tachycardie", label: `Tachycardie (${fc} bpm)` });
  } else if (fc < 60) {
    alertes.push({ niveau: "warning", code: "bradycardie", label: `Bradycardie (${fc} bpm)` });
  }

  // Trie : critical > warning > info > normal
  const order: Record<EcgAlerteNiveau, number> = { critical: 0, warning: 1, info: 2, normal: 3 };
  alertes.sort((a, b) => order[a.niveau] - order[b.niveau]);

  return {
    fc,
    rythme,
    pr,
    qrs: { dureeMs: qrsDureeMs, status: qrsStatus },
    axe: { degres: axeDegres, status: axeStatus },
    alertes,
  };
}
