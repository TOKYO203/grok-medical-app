import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Néphrologie. Session en cours : migration de l'ancien outil « DFG ».
 * Les estimations complètes (CKD-EPI 2009, MDRD, Schwartz, FENa…) sont
 * planifiées — voir TODO-CALCULATORS.md.
 */

/* ─────────────────── Cockcroft-Gault (clairance estimée) ─────────────────── */

const cockcroft: Calculator = {
  id: "cockcroft-gault",
  label: "Clairance — Cockcroft-Gault",
  categorie: "nephro",
  description: "Clairance de la créatinine estimée (adaptation posologique).",
  reference: "Cockcroft DW, Gault MH. Nephron 1976.",
  itemsProgramme: ["Adaptation posologique", "Insuffisance rénale chronique"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 68 },
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
      id: "creatinine",
      label: "Créatinine",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 2000,
      default: 112,
    },
    { id: "female", label: "Sexe féminin", type: "boolean", default: false },
  ],
  compute: (i): CalculatorResult => {
    const age = num(i.age);
    const weight = num(i.poids);
    const crea = num(i.creatinine);
    if (age <= 0 || weight <= 0 || crea <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez l'âge, le poids et la créatinine.",
        severity: "low",
      };
    }
    const raw = ((140 - age) * weight) / (crea * 0.814);
    const value = Math.round((bool(i.female) ? raw * 0.85 : raw) * 10) / 10;
    const severity =
      value >= 60 ? "low" : value >= 30 ? "medium" : value >= 15 ? "high" : "critical";
    return {
      value: `${value} mL/min`,
      label:
        value >= 90
          ? "Normale"
          : value >= 60
            ? "Légèrement réduite"
            : value >= 30
              ? "Modérément réduite"
              : value >= 15
                ? "Sévèrement réduite"
                : "Terminale",
      interpretation:
        "Restez sous les seuils du RCP pour les médicaments à marge thérapeutique étroite (dose initiale réduite si < 60, contre-indication fréquente < 30).",
      severity,
    };
  },
};

export const NEPHRO_CALCULATORS: Calculator[] = [cockcroft];
