import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Calculs transversaux : anthropométrie, fonction rénale, électrophysiologie.
 * Ce sont les outils « du quotidien », utilisés dans toutes les spécialités.
 */

/* ─────────────────────────────── IMC ─────────────────────────────── */

function bmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function bmiClass(value: number): string {
  if (value <= 0) return "—";
  if (value < 18.5) return "Maigreur";
  if (value < 25) return "Corpulence normale";
  if (value < 30) return "Surpoids";
  if (value < 35) return "Obésité grade I";
  if (value < 40) return "Obésité grade II";
  return "Obésité grade III (massive)";
}

const imc: Calculator = {
  id: "imc",
  label: "IMC — Indice de masse corporelle",
  categorie: "general",
  description: "Poids (kg) / taille (m)², classé selon l'OMS.",
  reference: "OMS — Classification du surpoids et de l'obésité, 2000.",
  fields: [
    {
      id: "poids",
      label: "Poids",
      type: "number",
      unit: "kg",
      min: 0,
      max: 400,
      step: 0.5,
      default: 72,
    },
    {
      id: "taille",
      label: "Taille",
      type: "number",
      unit: "cm",
      min: 0,
      max: 250,
      step: 1,
      default: 168,
    },
  ],
  compute: (i): CalculatorResult => {
    const value = bmi(num(i.poids), num(i.taille));
    const label = bmiClass(value);
    const severity =
      value <= 0 || (value >= 18.5 && value < 25)
        ? "low"
        : value < 18.5 || value < 30
          ? "medium"
          : value < 35
            ? "high"
            : "critical";
    return {
      value: value > 0 ? `${value} kg/m²` : "—",
      label,
      interpretation:
        value <= 0
          ? "Renseignez le poids et la taille."
          : `${label} — IMC ${value} kg/m². Objectif thérapeutique : −5 à −10 % du poids en cas de surpoids ou d'obésité.`,
      severity,
    };
  },
};

/* ─────────────────── DFG — CKD-EPI 2021 (sans race) ─────────────────── */

/** CKD-EPI 2021 (créatinine, µmol/L) — équation sans facteur ethnique. */
function ckdEpi2021(age: number, creatinineUmol: number, female: boolean): number {
  const scr = creatinineUmol / 88.4;
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const min = Math.min(scr / k, 1);
  const max = Math.max(scr / k, 1);
  const sex = female ? 1.012 : 1;
  const gfr = 142 * min ** a * max ** -1.2 * 0.9938 ** age * sex;
  return Math.round(gfr * 10) / 10;
}

/** Stade KDIGO à partir du DFG (mL/min/1,73 m²). */
function ckdStage(gfr: number): { label: string; stage: string } {
  if (gfr >= 90) return { stage: "G1", label: "Fonction rénale normale ou élevée" };
  if (gfr >= 60) return { stage: "G2", label: "Diminution légère du DFG" };
  if (gfr >= 45) return { stage: "G3a", label: "Diminution légère à modérée" };
  if (gfr >= 30) return { stage: "G3b", label: "Diminution modérée à sévère" };
  if (gfr >= 15) return { stage: "G4", label: "Diminution sévère" };
  return { stage: "G5", label: "Insuffisance rénale terminale" };
}

const dfg: Calculator = {
  id: "dfg-ckd-epi-2021",
  label: "DFG — CKD-EPI 2021",
  categorie: "general",
  description: "Débit de filtration glomérulaire estimé (créatinine, sans facteur ethnique).",
  reference: "Inker LA et al. N Engl J Med 2021 (CKD-EPI creatinine equation, race-free).",
  itemsProgramme: ["Insuffisance rénale chronique", "Adaptation posologique"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 68 },
    {
      id: "creatinine",
      label: "Créatinine",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 2000,
      step: 1,
      default: 112,
    },
    { id: "female", label: "Sexe féminin", type: "boolean", default: false },
  ],
  compute: (i): CalculatorResult => {
    const age = num(i.age);
    const crea = num(i.creatinine);
    if (age <= 0 || crea <= 0) {
      return { value: "—", interpretation: "Renseignez l'âge et la créatinine.", severity: "low" };
    }
    const gfr = ckdEpi2021(age, crea, bool(i.female));
    const { stage, label } = ckdStage(gfr);
    const severity =
      gfr >= 90
        ? "low"
        : gfr >= 60
          ? "low"
          : gfr >= 45
            ? "medium"
            : gfr >= 30
              ? "high"
              : "critical";
    return {
      value: `${gfr} mL/min/1,73 m²`,
      label: `${stage} — ${label}`,
      interpretation:
        gfr >= 60
          ? "DFG ≥ 60 : pas d'insuffisance rénale (à interpréter avec l'albuminurie et la tendance)."
          : `Stade ${stage} (KDIGO) — adapter les posologies à la fonction rénale et rechercher une cause.`,
      severity,
    };
  },
};

/* ─────────────────────── QTc — formule de Bazett ─────────────────────── */

function qtcBazett(qtMs: number, hrBpm: number): number {
  if (qtMs <= 0 || hrBpm <= 0) return 0;
  const rr = 60 / hrBpm;
  return Math.round(qtMs / Math.sqrt(rr));
}

const qtc: Calculator = {
  id: "qtc-bazett",
  label: "QTc — Bazett",
  categorie: "general",
  description: "Correction du QT par la fréquence cardiaque (QT / √RR).",
  reference: "Bazett HC. Heart 1920.",
  itemsProgramme: ["Troubles de la repolarisation", "Médicaments allongeant le QT"],
  fields: [
    { id: "qt", label: "QT mesuré", type: "number", unit: "ms", min: 0, max: 800, default: 400 },
    {
      id: "fc",
      label: "Fréquence cardiaque",
      type: "number",
      unit: "bpm",
      min: 1,
      max: 300,
      default: 80,
    },
  ],
  compute: (i): CalculatorResult => {
    const value = qtcBazett(num(i.qt), num(i.fc));
    if (value <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez le QT et la fréquence cardiaque.",
        severity: "low",
      };
    }
    let label = "Normal";
    let severity: CalculatorResult["severity"] = "low";
    if (value >= 500) {
      label = "Très allongé — risque de torsades de pointes";
      severity = "critical";
    } else if (value >= 480) {
      label = "Allongé";
      severity = "high";
    } else if (value >= 450) {
      label = "Limite supérieure";
      severity = "medium";
    }
    return {
      value: `${value} ms`,
      label,
      interpretation:
        value >= 500
          ? "QTc ≥ 500 ms : arrêter les médicaments torsadogènes, corriger kaliémie et magnésémie."
          : value >= 480
            ? "QTc allongé : revoir les traitements allongeant le QT et corriger les troubles ioniques."
            : "Ne pas dépasser 450 ms chez l'homme et 470 ms chez la femme.",
      severity,
    };
  },
};

export const GENERAL_CALCULATORS: Calculator[] = [imc, dfg, qtc];
