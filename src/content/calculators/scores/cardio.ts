import type { Calculator, CalculatorResult } from "../types";
import { bool } from "../utils";

/**
 * Cardiologie — scores de risque et règles de décision.
 * Sources : ESC 2023 (FA, SCA, insuffisance cardiaque), AHA/ACC.
 *
 * Session 1 (refactor) : migration de CHA₂DS₂-VASc.
 * Les 9 scores suivants (HAS-BLED, GRACE, TIMI, Killip, NYHA, Wells TVP,
 * Genève, PERC, HEART) sont ajoutés au commit « feat(calc): cardio ».
 */

/* ────────────────────── CHA₂DS₂-VASc (risque embolique) ────────────────────── */

const cha2ds2Vasc: Calculator = {
  id: "cha2ds2-vasc",
  label: "CHA₂DS₂-VASc",
  categorie: "cardio",
  description: "Risque thrombo-embolique de la fibrillation atriale non valvulaire.",
  reference: "Lip GYH et al. Chest 2010 ; ESC 2023 — Fibrillation atriale.",
  itemsProgramme: ["Fibrillation atriale", "Anticoagulation"],
  fields: [
    {
      id: "chf",
      label: "Insuffisance cardiaque / dysfonction VG",
      type: "boolean",
      default: false,
      help: "C — 1 point",
    },
    {
      id: "htn",
      label: "Hypertension artérielle",
      type: "boolean",
      default: false,
      help: "H — 1 point",
    },
    { id: "age75", label: "Âge ≥ 75 ans", type: "boolean", default: false, help: "A₂ — 2 points" },
    { id: "age65", label: "Âge 65–74 ans", type: "boolean", default: false, help: "A — 1 point" },
    { id: "diabetes", label: "Diabète", type: "boolean", default: false, help: "D — 1 point" },
    {
      id: "stroke",
      label: "AVC / AIT / embolie systémique",
      type: "boolean",
      default: false,
      help: "S₂ — 2 points",
    },
    {
      id: "vascular",
      label: "Maladie vasculaire (IDM, AOMI, plaque aortique)",
      type: "boolean",
      default: false,
      help: "V — 1 point",
    },
    {
      id: "female",
      label: "Sexe féminin",
      type: "boolean",
      default: false,
      help: "Sc — 1 point (modificateur de risque)",
    },
  ],
  compute: (i): CalculatorResult => {
    let score = 0;
    if (bool(i.chf)) score += 1;
    if (bool(i.htn)) score += 1;
    if (bool(i.age75)) score += 2;
    else if (bool(i.age65)) score += 1;
    if (bool(i.diabetes)) score += 1;
    if (bool(i.stroke)) score += 2;
    if (bool(i.vascular)) score += 1;
    if (bool(i.female)) score += 1;

    const female = bool(i.female);
    // Seuil « hors sexe » : le point Sc ne compte pas pour déclencher l'anticoagulation.
    const effective = female ? score - 1 : score;

    let severity: CalculatorResult["severity"] = "low";
    let interpretation: string;
    if (score === 0) {
      interpretation = "Score 0 : pas d'anticoagulation en l'absence d'autre indication.";
    } else if (effective >= 2) {
      severity = "high";
      interpretation =
        "≥ 2 (hors point de sexe) : anticoagulation orale recommandée, sauf contre-indication (AOD en 1ʳᵉ intention dans la FA non valvulaire).";
    } else if (effective === 1) {
      severity = "medium";
      interpretation =
        "1 (hors point de sexe) : anticoagulation à discuter au cas par cas — balance bénéfice/risque avec le HAS-BLED.";
    } else {
      interpretation =
        "Risque faible : le seul point provient du sexe féminin — pas d'anticoagulation sur ce score.";
    }

    return { value: String(score), label: `CHA₂DS₂-VASc ${score}`, interpretation, severity };
  },
};

export const CARDIO_CALCULATORS: Calculator[] = [cha2ds2Vasc];
