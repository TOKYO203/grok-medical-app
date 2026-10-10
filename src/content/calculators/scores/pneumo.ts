import type { Calculator, CalculatorResult } from "../types";
import { bool } from "../utils";

/**
 * Pneumologie — probabilité clinique et scores de gravité.
 * Sources : ATS/IDSA, GOLD 2023, Wells.
 *
 * Session 1 (refactor) : migration de Wells EP et CURB-65.
 * Les 6 scores suivants (GOLD, CAT, mMRC, ATS/IDSA, BODE, Fine) sont ajoutés
 * au commit « feat(calc): pneumo ».
 */

/* ─────────────────────── Wells — embolie pulmonaire ─────────────────────── */

const wellsPe: Calculator = {
  id: "wells-pe",
  label: "Wells — Embolie pulmonaire",
  categorie: "pneumo",
  description: "Probabilité clinique pré-test d'embolie pulmonaire (modèle de Wells).",
  reference: "Wells PS et al. Ann Intern Med 2001.",
  itemsProgramme: ["Embolie pulmonaire", "Douleur thoracique"],
  fields: [
    {
      id: "signsDvt",
      label: "Signes cliniques de TVP",
      type: "boolean",
      default: false,
      help: "3 points",
    },
    {
      id: "altLessLikely",
      label: "EP plus probable qu'un diagnostic alternatif",
      type: "boolean",
      default: false,
      help: "3 points",
    },
    {
      id: "hr100",
      label: "Fréquence cardiaque > 100/min",
      type: "boolean",
      default: false,
      help: "1,5 point",
    },
    {
      id: "immobilization",
      label: "Immobilisation ≥ 3 j ou chirurgie < 4 semaines",
      type: "boolean",
      default: false,
      help: "1,5 point",
    },
    {
      id: "previous",
      label: "TVP ou EP antérieure",
      type: "boolean",
      default: false,
      help: "1,5 point",
    },
    { id: "hemoptysis", label: "Hémoptysie", type: "boolean", default: false, help: "1 point" },
    {
      id: "malignancy",
      label: "Néoplasie active",
      type: "boolean",
      default: false,
      help: "1 point",
    },
  ],
  compute: (i): CalculatorResult => {
    let score = 0;
    if (bool(i.signsDvt)) score += 3;
    if (bool(i.altLessLikely)) score += 3;
    if (bool(i.hr100)) score += 1.5;
    if (bool(i.immobilization)) score += 1.5;
    if (bool(i.previous)) score += 1.5;
    if (bool(i.hemoptysis)) score += 1;
    if (bool(i.malignancy)) score += 1;

    let label = "Faible probabilité (≤ 1)";
    let interpretation =
      "Probabilité faible : D-dimères pour exclure l'EP si la stratégie le permet.";
    let severity: CalculatorResult["severity"] = "low";
    if (score > 6) {
      label = "Forte probabilité (> 6)";
      interpretation = "Probabilité forte : angio-TDM thoracique d'emblée (pas de D-dimères).";
      severity = "high";
    } else if (score >= 2) {
      label = "Probabilité intermédiaire (2–6)";
      interpretation =
        "Probabilité intermédiaire : D-dimères ajustés à l'âge puis imagerie si positifs.";
      severity = "medium";
    }
    return { value: String(score), label, interpretation, severity };
  },
};

/* ─────────────────────────── CURB-65 (pneumonie) ─────────────────────────── */

const curb65: Calculator = {
  id: "curb-65",
  label: "CURB-65",
  categorie: "pneumo",
  description:
    "Gravité de la pneumonie communautaire et orientation (ambulatoire / hôpital / réa).",
  reference: "Lim WS et al. Thorax 2003 ; BTS 2009.",
  itemsProgramme: ["Pneumonie communautaire"],
  fields: [
    {
      id: "confusion",
      label: "Confusion (nouvelle désorientation)",
      type: "boolean",
      default: false,
      help: "C",
    },
    {
      id: "urea",
      label: "Urée > 7 mmol/L (≈ 19 mg/dL)",
      type: "boolean",
      default: false,
      help: "U",
    },
    {
      id: "rr",
      label: "Fréquence respiratoire ≥ 30/min",
      type: "boolean",
      default: false,
      help: "R",
    },
    { id: "bp", label: "PAS < 90 ou PAD ≤ 60 mmHg", type: "boolean", default: false, help: "B" },
    { id: "age65", label: "Âge ≥ 65 ans", type: "boolean", default: false, help: "65" },
  ],
  compute: (i): CalculatorResult => {
    const score =
      Number(bool(i.confusion)) +
      Number(bool(i.urea)) +
      Number(bool(i.rr)) +
      Number(bool(i.bp)) +
      Number(bool(i.age65));

    let label = "Faible gravité — ambulatoire possible";
    let interpretation =
      "Score 0–1 : traitement ambulatoire possible en l'absence de critère social ou de comorbidité.";
    let severity: CalculatorResult["severity"] = "low";
    if (score >= 3) {
      label = "Gravité élevée — hospitalisation, réanimation à discuter";
      interpretation =
        "Score ≥ 3 : hospitalisation ; évaluer le transfert en réanimation (score 4–5 = risque élevé de mortalité).";
      severity = "critical";
    } else if (score === 2) {
      label = "Gravité intermédiaire — hospitalisation";
      interpretation = "Score 2 : hospitalisation courte ou surveillance rapprochée.";
      severity = "high";
    } else if (score === 1) {
      severity = "medium";
      interpretation = "Score 1 : évaluer le terrain et la faisabilité du suivi ambulatoire.";
    }
    return { value: String(score), label, interpretation, severity };
  },
};

export const PNEUMO_CALCULATORS: Calculator[] = [wellsPe, curb65];
