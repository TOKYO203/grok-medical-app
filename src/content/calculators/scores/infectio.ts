import type { Calculator, CalculatorField, CalculatorResult } from "../types";
import { bool, num, str } from "../utils";

/**
 * Infectiologie — sepsis, gravité réanimatoire et scores ORL (8 scores).
 * Sources : Sepsis-3 (Singer 2016), Knaus 1985 (APACHE II), Le Gall 1993
 * (IGS II / SAPS II), McIsaac 2004, Klastersky 2000 (MASCC), RCP 2017 (NEWS2).
 */

/* ═══════════════════════ 1. qSOFA (Sepsis-3) ═══════════════════════ */

const qsofa: Calculator = {
  id: "qsofa",
  label: "qSOFA — Sepsis-3",
  categorie: "infectio",
  description: "Dépistage au lit du malade d'un sepsis chez un patient infecté (hors réanimation).",
  reference: "Singer M et al. JAMA 2016 (Sepsis-3) ; Surviving Sepsis Campaign 2021.",
  itemsProgramme: ["Sepsis", "Choc septique"],
  fields: [
    {
      id: "rr",
      label: "Fréquence respiratoire ≥ 22/min",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "mental",
      label: "Altération des fonctions supérieures (Glasgow < 15)",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "sbp",
      label: "Pression artérielle systolique ≤ 100 mmHg",
      type: "boolean",
      default: false,
      help: "1 point",
    },
  ],
  compute: (i): CalculatorResult => {
    const score = [bool(i.rr), bool(i.mental), bool(i.sbp)].filter(Boolean).length;
    const positive = score >= 2;
    return {
      value: String(score),
      label: positive ? "qSOFA positif (≥ 2)" : "qSOFA négatif (≤ 1)",
      interpretation: positive
        ? "qSOFA ≥ 2 : risque de mortalité et de séjour prolongé majoré — rechercher une dysfonction d'organe (SOFA), doser le lactate, débuter la prise en charge du sepsis et réévaluer fréquemment."
        : "qSOFA < 2 : sepsis peu probable sur ces seuls critères — ne remplace pas l'évaluation clinique globale ni le dosage du lactate.",
      severity: positive ? "high" : "low",
    };
  },
};

/* ═══════════════════════ 2. SOFA (Sepsis-3) ═══════════════════════ */

/** Champ SOFA à 5 niveaux (0–4) : le libellé décrit la plage, la valeur = points. */
function sofaField(id: string, label: string, options: string[]): CalculatorField {
  return {
    id,
    label,
    type: "select",
    default: "0",
    options: options.map((text, index) => ({ value: String(index), label: `${text} (${index})` })),
  };
}

const sofa: Calculator = {
  id: "sofa",
  label: "SOFA — Dysfonction d'organe",
  categorie: "infectio",
  description:
    "Score d'évaluation séquentielle des défaillances d'organe. Une hausse ≥ 2 points définit le sepsis (Sepsis-3).",
  reference: "Vincent JL et al. Intensive Care Med 1996 ; Singer M et al. JAMA 2016 (Sepsis-3).",
  itemsProgramme: ["Sepsis", "Choc septique", "Défaillance multiviscérale"],
  fields: [
    sofaField("respiration", "Respiration — PaO₂/FiO₂", [
      "≥ 400 mmHg",
      "< 400 mmHg",
      "< 300 mmHg",
      "< 200 mmHg sous ventilation",
      "< 100 mmHg sous ventilation",
    ]),
    sofaField("coagulation", "Coagulation — Plaquettes", [
      "≥ 150 000/µL",
      "< 150 000/µL",
      "< 100 000/µL",
      "< 50 000/µL",
      "< 20 000/µL",
    ]),
    sofaField("foie", "Foie — Bilirubine", [
      "< 20 µmol/L",
      "20–32 µmol/L",
      "33–101 µmol/L",
      "102–204 µmol/L",
      "> 204 µmol/L",
    ]),
    sofaField("cardio", "Cardiovasculaire — PAM / vasopresseurs", [
      "PAM ≥ 70 mmHg",
      "PAM < 70 mmHg",
      "Dopamine ≤ 5 ou dobutamine",
      "Dopamine > 5 ou noradrénaline ≤ 0,1",
      "Dopamine > 15 ou noradrénaline > 0,1 µg/kg/min",
    ]),
    sofaField("snc", "SNC — Glasgow", [
      "15",
      "13–14",
      "10–12",
      "6–9",
      "< 6",
    ]),
    sofaField("renal", "Rénal — Créatinine / diurèse", [
      "< 110 µmol/L",
      "110–170 µmol/L",
      "171–299 µmol/L",
      "300–440 µmol/L ou diurèse < 500 mL/j",
      "> 440 µmol/L ou diurèse < 200 mL/j",
    ]),
  ],
  compute: (i): CalculatorResult => {
    const score = sofa.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    const severity: CalculatorResult["severity"] =
      score <= 1 ? "low" : score <= 6 ? "medium" : score <= 12 ? "high" : "critical";
    const delta = score >= 2;
    return {
      value: `${score}/24`,
      label: delta ? "Dysfonction d'organe significative" : "Pas de dysfonction d'organe marquée",
      interpretation: delta
        ? "SOFA ≥ 2 : en présence d'une infection documentée ou suspectée, ce score définit le sepsis. Réévaluer quotidiennement — la variation (Δ SOFA) est le meilleur marqueur pronostique."
        : "SOFA 0–1 : pas de défaillance d'organe significative à ce stade.",
      severity,
    };
  },
};

/* ═══════════════════════ 3. APACHE II ═══════════════════════ */

function apacheTemp(t: number): number {
  if (t >= 41) return 4;
  if (t >= 39) return 3;
  if (t >= 38.5) return 1;
  if (t >= 36) return 0;
  if (t >= 34) return 1;
  if (t >= 32) return 2;
  if (t >= 30) return 3;
  return 4;
}
function apacheMap(m: number): number {
  if (m >= 160) return 4;
  if (m >= 130) return 3;
  if (m >= 110) return 2;
  if (m >= 70) return 0;
  if (m >= 50) return 2;
  return 4;
}
function apacheHr(h: number): number {
  if (h >= 180) return 4;
  if (h >= 140) return 3;
  if (h >= 110) return 2;
  if (h >= 70) return 0;
  if (h >= 55) return 2;
  if (h >= 40) return 3;
  return 4;
}
function apacheRr(r: number): number {
  if (r >= 50) return 4;
  if (r >= 35) return 3;
  if (r >= 25) return 1;
  if (r >= 12) return 0;
  if (r >= 10) return 1;
  if (r >= 6) return 2;
  return 4;
}
function apacheAaDO2(v: number): number {
  if (v >= 500) return 4;
  if (v >= 350) return 3;
  if (v >= 200) return 2;
  return 0;
}
function apachePao2(v: number): number {
  if (v > 70) return 0;
  if (v >= 61) return 1;
  if (v >= 55) return 3;
  return 4;
}
function apachePh(v: number): number {
  if (v >= 7.7) return 4;
  if (v >= 7.6) return 3;
  if (v >= 7.5) return 1;
  if (v >= 7.33) return 0;
  if (v >= 7.25) return 2;
  if (v >= 7.15) return 3;
  return 4;
}
function apacheNa(v: number): number {
  if (v >= 180) return 4;
  if (v >= 160) return 3;
  if (v >= 155) return 2;
  if (v >= 150) return 1;
  if (v >= 130) return 0;
  if (v >= 120) return 2;
  if (v >= 111) return 3;
  return 4;
}
function apacheK(v: number): number {
  if (v >= 7) return 4;
  if (v >= 6) return 3;
  if (v >= 5.5) return 1;
  if (v >= 3.5) return 0;
  if (v >= 3) return 1;
  if (v >= 2.5) return 2;
  return 4;
}
function apacheCreat(v: number): number {
  if (v >= 3.5) return 4;
  if (v >= 2) return 3;
  if (v >= 1.5) return 2;
  if (v >= 0.6) return 0;
  return 2;
}
function apacheHct(v: number): number {
  if (v >= 60) return 4;
  if (v >= 50) return 2;
  if (v >= 46) return 1;
  if (v >= 30) return 0;
  if (v >= 20) return 2;
  return 4;
}
function apacheWbc(v: number): number {
  if (v >= 40) return 4;
  if (v >= 20) return 2;
  if (v >= 15) return 1;
  if (v >= 3) return 0;
  if (v >= 1) return 2;
  return 4;
}
function apacheAge(a: number): number {
  if (a >= 75) return 6;
  if (a >= 65) return 5;
  if (a >= 55) return 3;
  if (a >= 45) return 2;
  return 0;
}
/** Mortalité hospitalière estimée (%) — nomogramme APACHE II, patients non opérés. */
function apacheMortality(score: number): number {
  if (score <= 4) return 4;
  if (score <= 9) return 8;
  if (score <= 14) return 15;
  if (score <= 19) return 25;
  if (score <= 24) return 40;
  if (score <= 29) return 55;
  if (score <= 34) return 73;
  return 85;
}

const apache2: Calculator = {
  id: "apache-ii",
  label: "APACHE II",
  categorie: "infectio",
  description:
    "Gravité des 24 premières heures en réanimation : 12 paramètres physiologiques + âge + état de santé chronique.",
  reference: "Knaus WA et al. Crit Care Med 1985.",
  itemsProgramme: ["Réanimation", "Sepsis", "Pronostic vital"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 60 },
    {
      id: "temp",
      label: "Température rectale",
      type: "number",
      unit: "°C",
      min: 25,
      max: 45,
      step: 0.1,
      default: 37,
    },
    {
      id: "map",
      label: "Pression artérielle moyenne",
      type: "number",
      unit: "mmHg",
      min: 20,
      max: 250,
      default: 90,
    },
    { id: "hr", label: "Fréquence cardiaque", type: "number", unit: "bpm", min: 10, max: 300, default: 90 },
    {
      id: "rr",
      label: "Fréquence respiratoire (spontanée)",
      type: "number",
      unit: "/min",
      min: 0,
      max: 90,
      default: 18,
    },
    {
      id: "oxyType",
      label: "Oxygénation — mesure utilisée",
      type: "select",
      default: "aa",
      options: [
        { value: "aa", label: "FiO₂ ≥ 0,5 → gradient A-aDO₂" },
        { value: "pa", label: "FiO₂ < 0,5 → PaO₂" },
      ],
    },
    {
      id: "aaDO2",
      label: "Gradient alvéolo-artériel A-aDO₂",
      type: "number",
      unit: "mmHg",
      min: 0,
      max: 800,
      default: 100,
      help: "Utilisé si FiO₂ ≥ 0,5",
    },
    {
      id: "pao2",
      label: "PaO₂",
      type: "number",
      unit: "mmHg",
      min: 0,
      max: 700,
      default: 85,
      help: "Utilisé si FiO₂ < 0,5",
    },
    { id: "ph", label: "pH artériel", type: "number", min: 6.5, max: 8, step: 0.01, default: 7.4 },
    {
      id: "na",
      label: "Natrémie",
      type: "number",
      unit: "mmol/L",
      min: 90,
      max: 210,
      default: 140,
    },
    {
      id: "k",
      label: "Kaliémie",
      type: "number",
      unit: "mmol/L",
      min: 1,
      max: 9,
      step: 0.1,
      default: 4,
    },
    {
      id: "creat",
      label: "Créatinine",
      type: "number",
      unit: "mg/dL",
      min: 0,
      max: 20,
      step: 0.1,
      default: 1,
    },
    {
      id: "aki",
      label: "Insuffisance rénale aiguë (double les points de créatinine)",
      type: "boolean",
      default: false,
    },
    { id: "hct", label: "Hématocrite", type: "number", unit: "%", min: 5, max: 75, default: 40 },
    {
      id: "wbc",
      label: "Leucocytes",
      type: "number",
      unit: "×10³/µL",
      min: 0,
      max: 90,
      step: 0.1,
      default: 10,
    },
    {
      id: "gcs",
      label: "Score de Glasgow",
      type: "number",
      min: 3,
      max: 15,
      default: 15,
      help: "Points APACHE = 15 − Glasgow",
    },
    {
      id: "chronic",
      label: "État de santé chronique",
      type: "select",
      default: "none",
      options: [
        { value: "none", label: "Aucun (0)" },
        { value: "scheduled", label: "Post-opératoire programmée (2)" },
        {
          value: "severe",
          label: "Immunodépression ou insuffisance organique chronique sévère (5)",
        },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const oxy =
      str(i.oxyType) === "pa" ? apachePao2(num(i.pao2)) : apacheAaDO2(num(i.aaDO2));
    const creatPoints = apacheCreat(num(i.creat)) * (bool(i.aki) ? 2 : 1);
    const chronic = str(i.chronic);
    const chronicPoints = chronic === "severe" ? 5 : chronic === "scheduled" ? 2 : 0;

    const score =
      apacheTemp(num(i.temp)) +
      apacheMap(num(i.map)) +
      apacheHr(num(i.hr)) +
      apacheRr(num(i.rr)) +
      oxy +
      apachePh(num(i.ph)) +
      apacheNa(num(i.na)) +
      apacheK(num(i.k)) +
      creatPoints +
      apacheHct(num(i.hct)) +
      apacheWbc(num(i.wbc)) +
      (15 - Math.min(15, Math.max(3, num(i.gcs, 15)))) +
      apacheAge(num(i.age)) +
      chronicPoints;

    const mortality = apacheMortality(score);
    const severity: CalculatorResult["severity"] =
      score <= 9 ? "low" : score <= 19 ? "medium" : score <= 29 ? "high" : "critical";
    return {
      value: `${score}/71`,
      label: `Mortalité hospitalière estimée ≈ ${mortality} %`,
      interpretation: `APACHE II ${score} : ${score <= 9 ? "gravité faible" : score <= 19 ? "gravité modérée" : score <= 29 ? "gravité élevée" : "gravité très élevée"}. Nomogramme de référence chez le patient non opéré — ne remplace pas le jugement clinique ni la trajectoire individuelle.`,
      severity,
    };
  },
};

/* ═══════════════════════ 4. IGS II (SAPS II) ═══════════════════════ */

function sapsAge(a: number): number {
  if (a >= 80) return 18;
  if (a >= 75) return 16;
  if (a >= 70) return 15;
  if (a >= 60) return 12;
  if (a >= 40) return 7;
  return 0;
}
function sapsHr(h: number): number {
  if (h >= 160) return 7;
  if (h >= 120) return 4;
  if (h >= 70) return 0;
  if (h >= 40) return 2;
  return 11;
}
function sapsSbp(s: number): number {
  if (s >= 180) return 8;
  if (s >= 140) return 4;
  if (s >= 110) return 0;
  if (s >= 90) return 2;
  if (s >= 70) return 5;
  return 13;
}
function sapsPf(pf: number): number {
  if (pf >= 200) return 6;
  if (pf >= 100) return 9;
  return 11;
}
function sapsUrine(u: number): number {
  if (u >= 1) return 4;
  if (u >= 0.5) return 8;
  return 11;
}
function sapsUrea(mmol: number): number {
  if (mmol >= 30) return 10;
  if (mmol >= 10) return 6;
  return 0;
}
function sapsWbc(w: number): number {
  if (w >= 20) return 3;
  if (w >= 1) return 0;
  return 12;
}
function sapsK(k: number): number {
  return k >= 5 || k < 3 ? 3 : 0;
}
function sapsNa(n: number): number {
  if (n >= 145) return 1;
  if (n >= 125) return 0;
  return 5;
}
function sapsBicarb(b: number): number {
  if (b >= 20) return 0;
  if (b >= 15) return 3;
  return 6;
}
function sapsBili(b: number): number {
  if (b >= 6) return 9;
  if (b >= 4) return 4;
  return 0;
}
function sapsGcs(g: number): number {
  if (g >= 14) return 0;
  if (g >= 11) return 5;
  if (g >= 9) return 7;
  if (g >= 6) return 13;
  return 26;
}
function sapsChronic(c: string): number {
  if (c === "aids") return 17;
  if (c === "hematologic") return 10;
  if (c === "metastatic") return 9;
  return 0;
}
function sapsAdmission(a: string): number {
  if (a === "unscheduled") return 8;
  if (a === "medical") return 6;
  return 0;
}

const igs2: Calculator = {
  id: "igs-ii",
  label: "IGS II (SAPS II)",
  categorie: "infectio",
  description:
    "Indice de gravité simplifié — 17 variables recueillies dans les 24 premières heures, avec mortalité prédite.",
  reference: "Le Gall JR et al. JAMA 1993 (SAPS II) ; version française « IGS II ».",
  itemsProgramme: ["Réanimation", "Pronostic vital"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 60 },
    { id: "hr", label: "Fréquence cardiaque", type: "number", unit: "bpm", min: 10, max: 300, default: 90 },
    {
      id: "sbp",
      label: "Pression artérielle systolique",
      type: "number",
      unit: "mmHg",
      min: 20,
      max: 300,
      default: 120,
    },
    {
      id: "temp",
      label: "Température",
      type: "number",
      unit: "°C",
      min: 25,
      max: 45,
      step: 0.1,
      default: 37,
      help: "≥ 39 °C : 3 points",
    },
    {
      id: "ventilated",
      label: "Ventilation mécanique ou CPAP",
      type: "boolean",
      default: false,
      help: "Conditionne le calcul du rapport PaO₂/FiO₂",
    },
    {
      id: "pf",
      label: "PaO₂/FiO₂",
      type: "number",
      unit: "mmHg",
      min: 0,
      max: 700,
      default: 250,
      help: "Pris en compte seulement si ventilé",
    },
    {
      id: "urine",
      label: "Diurèse des 24 h",
      type: "number",
      unit: "L/jour",
      min: 0,
      max: 15,
      step: 0.1,
      default: 1.5,
    },
    {
      id: "urea",
      label: "Urée sanguine",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 80,
      step: 0.1,
      default: 8,
    },
    {
      id: "wbc",
      label: "Leucocytes",
      type: "number",
      unit: "×10³/µL",
      min: 0,
      max: 90,
      step: 0.1,
      default: 10,
    },
    { id: "k", label: "Kaliémie", type: "number", unit: "mmol/L", min: 1, max: 9, step: 0.1, default: 4 },
    {
      id: "na",
      label: "Natrémie",
      type: "number",
      unit: "mmol/L",
      min: 90,
      max: 210,
      default: 140,
    },
    {
      id: "bicarb",
      label: "Bicarbonates",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 50,
      default: 24,
    },
    {
      id: "bili",
      label: "Bilirubine",
      type: "number",
      unit: "mg/dL",
      min: 0,
      max: 40,
      step: 0.1,
      default: 1,
    },
    { id: "gcs", label: "Score de Glasgow", type: "number", min: 3, max: 15, default: 15 },
    {
      id: "chronic",
      label: "Maladie chronique",
      type: "select",
      default: "none",
      options: [
        { value: "none", label: "Aucune (0)" },
        { value: "metastatic", label: "Cancer métastatique (9)" },
        { value: "hematologic", label: "Hémopathie maligne (10)" },
        { value: "aids", label: "SIDA (17)" },
      ],
    },
    {
      id: "admission",
      label: "Type d'admission",
      type: "select",
      default: "medical",
      options: [
        { value: "scheduled", label: "Chirurgie programmée (0)" },
        { value: "medical", label: "Médicale (6)" },
        { value: "unscheduled", label: "Chirurgie non programmée (8)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const pfPoints = bool(i.ventilated) ? sapsPf(num(i.pf)) : 0;
    const score =
      sapsAge(num(i.age)) +
      sapsHr(num(i.hr)) +
      sapsSbp(num(i.sbp)) +
      (num(i.temp) >= 39 ? 3 : 0) +
      pfPoints +
      sapsUrine(num(i.urine)) +
      sapsUrea(num(i.urea)) +
      sapsWbc(num(i.wbc)) +
      sapsK(num(i.k)) +
      sapsNa(num(i.na)) +
      sapsBicarb(num(i.bicarb)) +
      sapsBili(num(i.bili)) +
      sapsGcs(num(i.gcs)) +
      sapsChronic(str(i.chronic)) +
      sapsAdmission(str(i.admission));

    const logit = -7.7631 + 0.0737 * score + 0.9971 * Math.log(score + 1);
    const risk = (Math.exp(logit) / (1 + Math.exp(logit))) * 100;
    const mortality = Math.round(risk * 10) / 10;
    const severity: CalculatorResult["severity"] =
      score <= 29 ? "low" : score <= 49 ? "medium" : score <= 69 ? "high" : "critical";
    return {
      value: String(score),
      label: `Mortalité hospitalière prédite ≈ ${mortality} %`,
      interpretation: `IGS II ${score}/163 — probabilité de décès calculée par le modèle logistique de Le Gall. Un IGS II élevé justifie une intensité de soins adaptée et une discussion éthique avec la famille.`,
      severity,
    };
  },
};

/* ═══════════════════════ 5. Centor — Angine ═══════════════════════ */

const centor: Calculator = {
  id: "centor",
  label: "Centor — Angine",
  categorie: "infectio",
  description:
    "Probabilité d'angine à streptocoque du groupe A (4 critères cliniques, sans ajustement d'âge).",
  reference: "Centor RM et al. Med Decis Making 1981.",
  itemsProgramme: ["Angine", "Streptocoque du groupe A"],
  fields: [
    {
      id: "exudate",
      label: "Exsudat amygdalien / tonsillaire",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "adenopathy",
      label: "Adénopathies cervicales antérieures douloureuses",
      type: "boolean",
      default: false,
      help: "+1",
    },
    { id: "fever", label: "Fièvre > 38 °C", type: "boolean", default: false, help: "+1" },
    { id: "noCough", label: "Absence de toux", type: "boolean", default: false, help: "+1" },
  ],
  compute: (i): CalculatorResult => {
    const score = [bool(i.exudate), bool(i.adenopathy), bool(i.fever), bool(i.noCough)].filter(
      Boolean,
    ).length;
    const probability = ["2–3", "6–9", "10–15", "25–35", "40–60"][score];
    const severity: CalculatorResult["severity"] =
      score <= 1 ? "low" : score === 2 ? "medium" : "high";
    const interpretation =
      score <= 1
        ? "Score 0–1 : angine probablement virale — ni test ni antibiotique."
        : score === 2
          ? "Score 2 : test de diagnostic rapide (TDR) — antibiotique seulement si positif."
          : "Score ≥ 3 : TDR recommandé et probabilité élevée de streptocoque du groupe A — antibiothérapie si positif (amoxicilline en 1ʳᵉ intention).";
    return {
      value: String(score),
      label: `Probabilité de SGA ≈ ${probability} %`,
      interpretation,
      severity,
    };
  },
};

/* ═══════════════ 6. McIsaac — Centor modifié par l'âge ═══════════════ */

const mcisaac: Calculator = {
  id: "mcisaac",
  label: "McIsaac (Centor modifié)",
  categorie: "infectio",
  description:
    "Score de Centor complété par un ajustement selon l'âge, avec probabilité d'infection streptococcique.",
  reference: "McIsaac WJ et al. CMAJ 1998 ; McIsaac WJ et al. J Am Board Fam Pract 2004.",
  itemsProgramme: ["Angine", "Streptocoque du groupe A"],
  fields: [
    {
      id: "exudate",
      label: "Exsudat amygdalien / tonsillaire",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "adenopathy",
      label: "Adénopathies cervicales antérieures douloureuses",
      type: "boolean",
      default: false,
      help: "+1",
    },
    { id: "fever", label: "Fièvre > 38 °C", type: "boolean", default: false, help: "+1" },
    { id: "noCough", label: "Absence de toux", type: "boolean", default: false, help: "+1" },
    {
      id: "ageGroup",
      label: "Âge",
      type: "select",
      default: "adult",
      options: [
        { value: "child", label: "3–14 ans (+1)" },
        { value: "adult", label: "15–44 ans (0)" },
        { value: "senior", label: "≥ 45 ans (−1)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const ageGroup = str(i.ageGroup);
    const agePoints = ageGroup === "child" ? 1 : ageGroup === "senior" ? -1 : 0;
    const score =
      [bool(i.exudate), bool(i.adenopathy), bool(i.fever), bool(i.noCough)].filter(Boolean).length +
      agePoints;

    // Probabilité d'infection à SGA selon le score McIsaac (−1 à 5).
    const table: Record<number, string> = {
      "-1": "1–2,5",
      0: "5–10",
      1: "5–10",
      2: "10–16",
      3: "20–35",
      4: "35–50",
      5: "50–55",
    };
    const probability = table[Math.max(-1, Math.min(5, score))] ?? "—";
    const severity: CalculatorResult["severity"] =
      score <= 0 ? "low" : score <= 2 ? "medium" : score <= 3 ? "high" : "critical";

    let interpretation: string;
    if (score <= 1) {
      interpretation = "Score ≤ 1 : ni TDR ni antibiotique — traitement symptomatique.";
    } else if (score === 2) {
      interpretation = "Score 2 : TDR conseillé ; antibiotique uniquement si positif.";
    } else if (score === 3) {
      interpretation = "Score 3 : TDR recommandé ; antibiothérapie probabiliste à discuter si TDR indisponible.";
    } else {
      interpretation =
        "Score ≥ 4 : TDR et antibiothérapie recommandés (amoxicilline 6 j) ; envisager la culture si TDR négatif chez l'enfant.";
    }
    return {
      value: String(score),
      label: `Probabilité de SGA ≈ ${probability} %`,
      interpretation,
      severity,
    };
  },
};

/* ═══════════════ 7. MASCC — Neutropénie fébrile ═══════════════ */

const mascc: Calculator = {
  id: "mascc",
  label: "MASCC — Neutropénie fébrile",
  categorie: "infectio",
  description:
    "Risque de complication chez un patient neutropénique fébrile — permet d'identifier les candidats à un traitement ambulatoire.",
  reference: "Klastersky JA et al. J Clin Oncol 2000 (MASCC) ; ASCO 2018.",
  itemsProgramme: ["Neutropénie fébrile", "Oncologie"],
  fields: [
    {
      id: "burden",
      label: "Charge des symptômes / retentissement général",
      type: "select",
      default: "mild",
      options: [
        { value: "none", label: "Absents ou minimes (5)" },
        { value: "mild", label: "Modérés (3)" },
        { value: "severe", label: "Sévères (0)" },
      ],
    },
    {
      id: "noHypotension",
      label: "Absence d'hypotension (PAS > 90 mmHg)",
      type: "boolean",
      default: true,
      help: "+5",
    },
    { id: "noCOPD", label: "Absence de BPCO", type: "boolean", default: true, help: "+4" },
    {
      id: "tumorType",
      label: "Tumeur solide ou hémopathie sans infection fongique documentée",
      type: "boolean",
      default: true,
      help: "+4",
    },
    { id: "noDehydration", label: "Absence de déshydratation", type: "boolean", default: true, help: "+3" },
    {
      id: "outpatient",
      label: "Patient ambulatoire au début de la fièvre",
      type: "boolean",
      default: true,
      help: "+3",
    },
    { id: "ageUnder60", label: "Âge < 60 ans", type: "boolean", default: true, help: "+2" },
  ],
  compute: (i): CalculatorResult => {
    const burden = str(i.burden);
    const burdenPoints = burden === "none" ? 5 : burden === "mild" ? 3 : 0;
    const score =
      burdenPoints +
      (bool(i.noHypotension) ? 5 : 0) +
      (bool(i.noCOPD) ? 4 : 0) +
      (bool(i.tumorType) ? 4 : 0) +
      (bool(i.noDehydration) ? 3 : 0) +
      (bool(i.outpatient) ? 3 : 0) +
      (bool(i.ageUnder60) ? 2 : 0);

    const lowRisk = score >= 21;
    return {
      value: `${score}/26`,
      label: lowRisk ? "Faible risque de complication" : "Risque élevé de complication",
      interpretation: lowRisk
        ? "MASCC ≥ 21 : faible risque — une antibiothérapie orale et une prise en charge ambulatoire peuvent être envisagées chez un patient stable, avec surveillance et accès rapide aux soins."
        : "MASCC < 21 : risque élevé — hospitalisation, antibiothérapie IV probabiliste à large spectre et surveillance rapprochée.",
      severity: lowRisk ? "low" : "high",
    };
  },
};

/* ═══════════════════════ 8. NEWS2 ═══════════════════════ */

function newsRr(r: number): number {
  if (r >= 25) return 3;
  if (r >= 21) return 2;
  if (r >= 12) return 0;
  if (r >= 9) return 1;
  return 3;
}
function newsSpo2(s: number): number {
  if (s >= 96) return 0;
  if (s >= 94) return 1;
  if (s >= 92) return 2;
  return 3;
}
function newsTemp(t: number): number {
  if (t >= 39.1) return 2;
  if (t >= 38.1) return 1;
  if (t >= 36.1) return 0;
  if (t >= 35.1) return 1;
  return 3;
}
function newsSbp(s: number): number {
  if (s >= 220) return 3;
  if (s >= 111) return 0;
  if (s >= 101) return 1;
  if (s >= 91) return 2;
  return 3;
}
function newsHr(h: number): number {
  if (h >= 131) return 3;
  if (h >= 111) return 2;
  if (h >= 91) return 1;
  if (h >= 51) return 0;
  if (h >= 41) return 1;
  return 3;
}

const news2: Calculator = {
  id: "news2",
  label: "NEWS2",
  categorie: "infectio",
  description:
    "National Early Warning Score 2 : détection précoce de l'aggravation d'un patient hospitalisé (7 paramètres).",
  reference: "Royal College of Physicians. NEWS2, 2017.",
  itemsProgramme: ["Sepsis", "Surveillance hospitalière", "Urgences"],
  fields: [
    {
      id: "rr",
      label: "Fréquence respiratoire",
      type: "number",
      unit: "/min",
      min: 0,
      max: 90,
      default: 16,
    },
    {
      id: "spo2",
      label: "SpO₂",
      type: "number",
      unit: "%",
      min: 50,
      max: 100,
      default: 97,
      help: "Échelle 1 (patients sans hypercapnie)",
    },
    {
      id: "oxygen",
      label: "Oxygénothérapie en cours",
      type: "boolean",
      default: false,
      help: "Air ambiant 0 · sous oxygène +2",
    },
    {
      id: "temp",
      label: "Température",
      type: "number",
      unit: "°C",
      min: 25,
      max: 45,
      step: 0.1,
      default: 37,
    },
    {
      id: "sbp",
      label: "Pression artérielle systolique",
      type: "number",
      unit: "mmHg",
      min: 20,
      max: 300,
      default: 120,
    },
    { id: "hr", label: "Fréquence cardiaque", type: "number", unit: "bpm", min: 10, max: 300, default: 80 },
    {
      id: "consciousness",
      label: "Conscience (AVPU)",
      type: "select",
      default: "alert",
      options: [
        { value: "alert", label: "Alerte (0)" },
        { value: "cvpu", label: "Confusion · Voix · Douleur · Non réactif (3)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const rrPoints = newsRr(num(i.rr));
    const spo2Points = newsSpo2(num(i.spo2));
    const tempPoints = newsTemp(num(i.temp));
    const sbpPoints = newsSbp(num(i.sbp));
    const hrPoints = newsHr(num(i.hr));
    const cvsPoints = str(i.consciousness) === "cvpu" ? 3 : 0;
    const oxygenPoints = bool(i.oxygen) ? 2 : 0;

    const score =
      rrPoints + spo2Points + oxygenPoints + tempPoints + sbpPoints + hrPoints + cvsPoints;

    const singleParamMax = Math.max(rrPoints, spo2Points, tempPoints, sbpPoints, hrPoints, cvsPoints);
    let severity: CalculatorResult["severity"] = "low";
    let label = "Score faible";
    let interpretation = "NEWS 0–4 : surveillance de routine (au moins toutes les 12 h).";

    if (score >= 7) {
      severity = "critical";
      label = "Score élevé (≥ 7)";
      interpretation =
        "NEWS2 ≥ 7 : réponse d'urgence — évaluation médicale immédiate, monitorage continu, transfert en soins intensifs à envisager (suspicion de sepsis à rechercher).";
    } else if (score >= 5) {
      severity = "high";
      label = "Score intermédiaire (5–6)";
      interpretation =
        "NEWS2 5–6 : réponse urgente — réévaluation médicale rapide et surveillance rapprochée (au moins horaire) ; recherche d'un sepsis.";
    } else if (singleParamMax === 3) {
      severity = "medium";
      label = "Score faible mais 1 paramètre à 3";
      interpretation =
        "NEWS2 1–4 avec un paramètre coté 3 : surveillance rapprochée et avis médical — une seule anomalie majeure suffit à alerter.";
    } else if (score >= 3) {
      severity = "medium";
      label = "Score faible (3–4)";
      interpretation = "NEWS2 3–4 : surveillance au moins toutes les 4 à 6 h, évaluer la réponse au traitement.";
    }

    return { value: `${score}/20`, label, interpretation, severity };
  },
};

export const INFECTIO_CALCULATORS: Calculator[] = [
  qsofa,
  sofa,
  apache2,
  igs2,
  centor,
  mcisaac,
  mascc,
  news2,
];
