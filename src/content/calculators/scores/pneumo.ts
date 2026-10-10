import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Pneumologie — probabilité clinique et scores de gravité (8 scores).
 * Sources : Wells, BTS, ATS/IDSA 2019, GOLD 2023, Jones 2009, Celli 2004,
 * Fine 1997.
 */

/* ═══════════════════ 1. Wells — embolie pulmonaire ═══════════════════ */

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

/* ═══════════════════════════ 2. CURB-65 ═══════════════════════════ */

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

/* ═══════════════ 3. GOLD 2023 — stade spirométrique + groupe ═══════════════ */

const gold: Calculator = {
  id: "gold-bpco",
  label: "GOLD 2023 — BPCO",
  categorie: "pneumo",
  description: "Stade spirométrique (1–4) et groupe d'évaluation ABE de la BPCO.",
  reference: "GOLD 2023 Report — Global Initiative for Chronic Obstructive Lung Disease.",
  itemsProgramme: ["BPCO"],
  fields: [
    {
      id: "fev1",
      label: "VEMS post-BD",
      type: "number",
      unit: "% de la théorique",
      min: 0,
      max: 120,
      default: 55,
    },
    {
      id: "mmrc",
      label: "Dyspnée mMRC",
      type: "number",
      min: 0,
      max: 4,
      default: 1,
      help: "0 à 4",
    },
    { id: "cat", label: "Score CAT", type: "number", min: 0, max: 40, default: 12, help: "0 à 40" },
    {
      id: "exacerbations",
      label: "Exacerbations modérées (12 derniers mois)",
      type: "number",
      min: 0,
      max: 20,
      default: 0,
    },
    {
      id: "hospitalizations",
      label: "Hospitalisations pour exacerbation (12 mois)",
      type: "number",
      min: 0,
      max: 20,
      default: 0,
    },
  ],
  compute: (i): CalculatorResult => {
    const fev1 = num(i.fev1);
    const grade = fev1 >= 80 ? 1 : fev1 >= 50 ? 2 : fev1 >= 30 ? 3 : 4;
    const highSymptoms = num(i.mmrc) >= 2 || num(i.cat) >= 10;
    const highExac = num(i.exacerbations) >= 2 || num(i.hospitalizations) >= 1;
    const group = highExac ? "E" : highSymptoms ? "B" : "A";

    const treatment =
      group === "A"
        ? "Bronchodilatateur de longue durée d'action (LABA ou LAMA)."
        : group === "B"
          ? "LABA + LAMA (bithérapie bronchodilatatrice)."
          : "LABA + LAMA ; ajouter un corticoïde inhalé si éosinophiles sanguins ≥ 300/µL.";

    const severity: CalculatorResult["severity"] =
      grade <= 1 ? "low" : grade === 2 ? "medium" : grade === 3 ? "high" : "critical";
    return {
      value: `GOLD ${grade} · Groupe ${group}`,
      label: `VEMS ${fev1} % — ${highSymptoms ? "symptômes marqués" : "symptômes faibles"}`,
      interpretation: `${highExac ? "Exacerbations fréquentes. " : ""}Traitement initial : ${treatment}`,
      severity,
    };
  },
};

/* ═══════════════ 4. CAT — COPD Assessment Test ═══════════════ */

const CAT_ITEMS: [string, string, string][] = [
  ["toux", "Toux", "Jamais 0 → permanente 5"],
  ["crachats", "Crachats", "Aucun 0 → abondants 5"],
  ["oppression", "Oppression thoracique", "Aucune 0 → très forte 5"],
  ["essoufflement", "Essoufflement à la montée", "Aucun 0 → très essoufflé 5"],
  ["activites", "Limitation des activités à domicile", "Aucune 0 → très limité 5"],
  ["confiance", "Confiance pour sortir de chez soi", "Totale 0 → aucune 5"],
  ["sommeil", "Sommeil", "Profond 0 → très perturbé 5"],
  ["energie", "Énergie", "Plein d'énergie 0 → aucune 5"],
];

const cat: Calculator = {
  id: "cat-bpco",
  label: "CAT — Impact de la BPCO",
  categorie: "pneumo",
  description: "Impact des symptômes de BPCO sur la qualité de vie (8 items, 0–5 chacun).",
  reference: "Jones PW et al. Chest 2009.",
  itemsProgramme: ["BPCO"],
  fields: CAT_ITEMS.map(([id, label, help]) => ({
    id,
    label,
    type: "number" as const,
    min: 0,
    max: 5,
    default: 0,
    help,
  })),
  compute: (i): CalculatorResult => {
    const score = CAT_ITEMS.reduce((sum, [id]) => sum + Math.min(5, Math.max(0, num(i[id]))), 0);
    const severity: CalculatorResult["severity"] =
      score < 10 ? "low" : score <= 20 ? "medium" : "high";
    const label = score < 10 ? "Impact faible" : score <= 20 ? "Impact moyen" : "Impact élevé";
    return {
      value: String(score),
      label: `${label} (0–40)`,
      interpretation:
        score < 10
          ? "CAT < 10 : retentissement faible — la dyspnée est peu limitante."
          : score <= 20
            ? "CAT 10–20 : retentissement moyen — réévaluer le traitement de fond."
            : "CAT > 20 : retentissement important — optimisation bronchodilatatrice et réhabilitation respiratoire.",
      severity,
    };
  },
};

/* ═══════════════ 5. mMRC — dyspnée ═══════════════ */

const mmrc: Calculator = {
  id: "mmrc",
  label: "mMRC — Dyspnée",
  categorie: "pneumo",
  description: "Échelle modifiée du Medical Research Council (retentissement de la dyspnée).",
  reference: "GOLD 2023 ; Fletcher CM et al. Br Med J 1959.",
  itemsProgramme: ["BPCO", "Dyspnée"],
  fields: [
    {
      id: "grade",
      label: "Grade de dyspnée",
      type: "select",
      default: "1",
      options: [
        { value: "0", label: "0 — essoufflement seulement à l'effort important" },
        { value: "1", label: "1 — essoufflement en marchant vite ou en montant une pente" },
        {
          value: "2",
          label: "2 — marche plus lentement que les autres, ou s'arrête pour respirer",
        },
        { value: "3", label: "3 — s'arrête pour respirer après ~100 m ou quelques minutes" },
        { value: "4", label: "4 — essoufflement pour s'habiller, incapable de sortir" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const g = num(i.grade, 0);
    const severity: CalculatorResult["severity"] =
      g <= 1 ? "low" : g === 2 ? "medium" : g === 3 ? "high" : "critical";
    const label =
      g <= 1
        ? "Dyspnée faible"
        : g === 2
          ? "Dyspnée modérée (mMRC ≥ 2 = symptômes marqués)"
          : "Dyspnée marquée";
    const interpretation =
      g >= 2
        ? "mMRC ≥ 2 : le patient est « symptomatique » (groupe B ou E) — traitement de fond et réhabilitation respiratoire."
        : "mMRC 0–1 : retentissement faible de la dyspnée.";
    return { value: `mMRC ${g}`, label, interpretation, severity };
  },
};

/* ═══════════════ 6. ATS/IDSA 2019 — pneumonie grave ═══════════════ */

const atsIdsa: Calculator = {
  id: "ats-idsa-pneumonie-grave",
  label: "ATS/IDSA 2019 — Pneumonie grave",
  categorie: "pneumo",
  description: "Critères de pneumonie communautaire grave (admission en réanimation).",
  reference: "Metlay JP et al. Am J Respir Crit Care Med 2019 (ATS/IDSA CAP).",
  itemsProgramme: ["Pneumonie communautaire", "Urgences respiratoires"],
  fields: [
    {
      id: "vasopressors",
      label: "Choc septique nécessitant des vasopresseurs",
      type: "boolean",
      default: false,
      help: "Critère majeur",
    },
    {
      id: "ventilation",
      label: "Détresse respiratoire nécessitant une ventilation mécanique",
      type: "boolean",
      default: false,
      help: "Critère majeur",
    },
    {
      id: "rr30",
      label: "Fréquence respiratoire ≥ 30/min",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "pf250",
      label: "PaO₂/FiO₂ ≤ 250",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "multilobar",
      label: "Infiltrats multilobaires",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "confusion",
      label: "Confusion / désorientation",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "uremia",
      label: "Urémie (BUN > 20 mg/dL)",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "leukopenia",
      label: "Leucopénie (GB < 4 000/µL)",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "thrombocytopenia",
      label: "Thrombopénie (plaquettes < 100 000/µL)",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "hypothermia",
      label: "Hypothermie (T < 36 °C)",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
    {
      id: "hypotension",
      label: "Hypotension nécessitant un remplissage agressif",
      type: "boolean",
      default: false,
      help: "Critère mineur",
    },
  ],
  compute: (i): CalculatorResult => {
    const major = [bool(i.vasopressors), bool(i.ventilation)].filter(Boolean).length;
    const minor = [
      bool(i.rr30),
      bool(i.pf250),
      bool(i.multilobar),
      bool(i.confusion),
      bool(i.uremia),
      bool(i.leukopenia),
      bool(i.thrombocytopenia),
      bool(i.hypothermia),
      bool(i.hypotension),
    ].filter(Boolean).length;

    const severe = major >= 1 || minor >= 3;
    return {
      value: severe ? "Pneumonie grave" : "Non grave",
      label: `Critères majeurs ${major} · mineurs ${minor}`,
      interpretation: severe
        ? "Au moins 1 critère majeur ou ≥ 3 critères mineurs : pneumonie communautaire grave — admission en réanimation et antibiothérapie élargie."
        : "Critères non atteints : pneumonie communautaire non grave — orienter selon le CURB-65 / PSI.",
      severity: severe ? "critical" : "low",
    };
  },
};

/* ═══════════════ 7. Index BODE ═══════════════ */

const bode: Calculator = {
  id: "bode",
  label: "Index BODE",
  categorie: "pneumo",
  description: "Pronostic de la BPCO : IMC, obstruction, dyspnée, capacité d'exercice.",
  reference: "Celli BR et al. N Engl J Med 2004.",
  itemsProgramme: ["BPCO"],
  fields: [
    {
      id: "bmi",
      label: "IMC",
      type: "number",
      unit: "kg/m²",
      min: 0,
      max: 60,
      step: 0.1,
      default: 22,
    },
    {
      id: "fev1",
      label: "VEMS",
      type: "number",
      unit: "% théorique",
      min: 0,
      max: 120,
      default: 55,
    },
    { id: "mmrc", label: "Dyspnée mMRC", type: "number", min: 0, max: 4, default: 1 },
    {
      id: "distance",
      label: "Distance en 6 min de marche",
      type: "number",
      unit: "m",
      min: 0,
      max: 900,
      default: 350,
    },
  ],
  compute: (i): CalculatorResult => {
    const bmi = num(i.bmi);
    const fev1 = num(i.fev1);
    const mmrcVal = num(i.mmrc);
    const dist = num(i.distance);

    const bmiPoints = bmi <= 21 ? 1 : 0;
    const fev1Points = fev1 >= 65 ? 0 : fev1 >= 50 ? 1 : fev1 >= 36 ? 2 : 3;
    const mmrcPoints = mmrcVal <= 1 ? 0 : mmrcVal === 2 ? 1 : mmrcVal === 3 ? 2 : 3;
    const distPoints = dist >= 350 ? 0 : dist >= 250 ? 1 : dist >= 150 ? 2 : 3;

    const total = bmiPoints + fev1Points + mmrcPoints + distPoints;
    const quartile = total <= 2 ? 1 : total <= 4 ? 2 : total <= 6 ? 3 : 4;
    const severity: CalculatorResult["severity"] =
      quartile <= 1 ? "low" : quartile === 2 ? "medium" : quartile === 3 ? "high" : "critical";
    return {
      value: String(total),
      label: `Quartile de risque Q${quartile} (0–10)`,
      interpretation: `BODE ${total}/10 — plus le score est élevé, plus la mortalité est importante. Q4 : pronostic le plus péjoratif, envisager transplantation pulmonaire / soins de support.`,
      severity,
    };
  },
};

/* ═══════════════ 8. Fine / PSI — Pneumonia Severity Index ═══════════════ */

const fine: Calculator = {
  id: "fine-psi",
  label: "Fine (PSI) — Pneumonie",
  categorie: "pneumo",
  description: "Indice de gravité de la pneumonie (classes I–V et orientation).",
  reference: "Fine MJ et al. N Engl J Med 1997 (Pneumonia Severity Index).",
  itemsProgramme: ["Pneumonie communautaire"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 65 },
    { id: "female", label: "Sexe féminin (−10 points)", type: "boolean", default: false },
    {
      id: "nursingHome",
      label: "Résidence en institution",
      type: "boolean",
      default: false,
      help: "+10",
    },
    { id: "neoplastic", label: "Néoplasie", type: "boolean", default: false, help: "+30" },
    { id: "liver", label: "Hépatopathie", type: "boolean", default: false, help: "+20" },
    { id: "chf", label: "Insuffisance cardiaque", type: "boolean", default: false, help: "+10" },
    {
      id: "cerebrovascular",
      label: "Maladie cérébrovasculaire",
      type: "boolean",
      default: false,
      help: "+10",
    },
    { id: "renal", label: "Maladie rénale", type: "boolean", default: false, help: "+10" },
    {
      id: "alteredMental",
      label: "Altération de l'état mental",
      type: "boolean",
      default: false,
      help: "+20",
    },
    {
      id: "rr30",
      label: "Fréquence respiratoire ≥ 30/min",
      type: "boolean",
      default: false,
      help: "+20",
    },
    { id: "sbp90", label: "PAS < 90 mmHg", type: "boolean", default: false, help: "+20" },
    {
      id: "tempExtreme",
      label: "Température < 35 ou ≥ 40 °C",
      type: "boolean",
      default: false,
      help: "+15",
    },
    {
      id: "pulse125",
      label: "Fréquence cardiaque ≥ 125/min",
      type: "boolean",
      default: false,
      help: "+10",
    },
    { id: "phLow", label: "pH < 7,35", type: "boolean", default: false, help: "+30" },
    {
      id: "bun30",
      label: "Urémie (BUN ≥ 30 mg/dL ou urée ≥ 11 mmol/L)",
      type: "boolean",
      default: false,
      help: "+20",
    },
    { id: "na130", label: "Natrémie < 130 mmol/L", type: "boolean", default: false, help: "+20" },
    {
      id: "glucose250",
      label: "Glycémie ≥ 250 mg/dL",
      type: "boolean",
      default: false,
      help: "+10",
    },
    { id: "hct30", label: "Hématocrite < 30 %", type: "boolean", default: false, help: "+10" },
    {
      id: "pao2Low",
      label: "PaO₂ < 60 mmHg ou SpO₂ < 90 %",
      type: "boolean",
      default: false,
      help: "+10",
    },
    {
      id: "pleuralEffusion",
      label: "Épanchement pleural",
      type: "boolean",
      default: false,
      help: "+10",
    },
  ],
  compute: (i): CalculatorResult => {
    const age = num(i.age);
    const agePoints = Math.max(0, bool(i.female) ? age - 10 : age);
    const comorbidity =
      (bool(i.neoplastic) ? 30 : 0) +
      (bool(i.liver) ? 20 : 0) +
      (bool(i.chf) ? 10 : 0) +
      (bool(i.cerebrovascular) ? 10 : 0) +
      (bool(i.renal) ? 10 : 0);
    const exam =
      (bool(i.alteredMental) ? 20 : 0) +
      (bool(i.rr30) ? 20 : 0) +
      (bool(i.sbp90) ? 20 : 0) +
      (bool(i.tempExtreme) ? 15 : 0) +
      (bool(i.pulse125) ? 10 : 0);
    const lab =
      (bool(i.phLow) ? 30 : 0) +
      (bool(i.bun30) ? 20 : 0) +
      (bool(i.na130) ? 20 : 0) +
      (bool(i.glucose250) ? 10 : 0) +
      (bool(i.hct30) ? 10 : 0) +
      (bool(i.pao2Low) ? 10 : 0) +
      (bool(i.pleuralEffusion) ? 10 : 0);
    const points = agePoints + (bool(i.nursingHome) ? 10 : 0) + comorbidity + exam + lab;

    // Classe I : < 50 ans, sans comorbidité ni anomalie clinique/biologique.
    const classI = age < 50 && comorbidity === 0 && exam === 0 && lab === 0;
    let riskClass: 1 | 2 | 3 | 4 | 5;
    if (classI) riskClass = 1;
    else if (points <= 70) riskClass = 2;
    else if (points <= 90) riskClass = 3;
    else if (points <= 130) riskClass = 4;
    else riskClass = 5;

    const mortality = ["0,1", "0,6", "2,8", "8,2", "29,2"][riskClass - 1];
    const severity: CalculatorResult["severity"] =
      riskClass <= 2 ? "low" : riskClass === 3 ? "medium" : riskClass === 4 ? "high" : "critical";
    const orientation =
      riskClass <= 2
        ? "Traitement ambulatoire possible."
        : riskClass === 3
          ? "Hospitalisation courte ou surveillance rapprochée."
          : "Hospitalisation ; réanimation à discuter (classe V).";
    return {
      value: `Classe ${riskClass === 1 ? "I" : riskClass === 2 ? "II" : riskClass === 3 ? "III" : riskClass === 4 ? "IV" : "V"}`,
      label: `${points} points — mortalité ≈ ${mortality} %`,
      interpretation: orientation,
      severity,
    };
  },
};

export const PNEUMO_CALCULATORS: Calculator[] = [
  wellsPe,
  curb65,
  gold,
  cat,
  mmrc,
  atsIdsa,
  bode,
  fine,
];
