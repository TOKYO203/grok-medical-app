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
  let rythme: EcgRythme = "sinusal";
  if (def?.prProgression === "wenckebach") {
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
  if (!def?.pAbsent) {
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
      const prMs = 160;
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
  // DI ≈ P.a du lead I (amplitude relative) ; aVF ≈ DII − DI/2
  const ampI = trace.waves.R.a * 0.8;      // R en I
  const ampII = trace.waves.R.a;           // R en II
  const ampAVF = ampII - ampI / 2;
  // Axe simplifié : si R dominant en I et aVF → normal ; sinon déviation
  let axeDegres = 60;
  let axeStatus: "normal" | "gauche" | "droite" | "extreme" = "normal";
  if (ampI > 0 && ampAVF > 0) {
    axeDegres = 30;
    axeStatus = "normal";
  } else if (ampI > 0 && ampAVF < 0) {
    axeDegres = -45;
    axeStatus = "gauche";
    alertes.push({
      niveau: "info",
      code: "axe-gauche",
      label: "Déviation axiale gauche",
      description: "Hémibloc antérieur gauche, HVG, ou infarctus inférieur.",
    });
  } else if (ampI < 0 && ampAVF > 0) {
    axeDegres = 120;
    axeStatus = "droite";
    alertes.push({
      niveau: "info",
      code: "axe-droit",
      label: "Déviation axiale droite",
      description: "HVD, embolie pulmonaire, ou bloc fasciculaire postérieur.",
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
  } else if (fc < 50) {
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
