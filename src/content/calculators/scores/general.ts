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

/* ─────────── QTc — Fridericia et Hodges ─────────── */

/** Sévérité commune aux QTc (ms). */
function qtcAssessment(value: number, males: boolean): Omit<CalculatorResult, "value"> {
  if (value <= 0) {
    return {
      label: "—",
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
  } else if (value >= (males ? 450 : 470)) {
    label = "Limite supérieure";
    severity = "medium";
  }
  return {
    label,
    interpretation:
      value >= 500
        ? "QTc ≥ 500 ms : arrêter les médicaments torsadogènes, corriger la kaliémie et la magnésémie, monitorer l'ECG."
        : value >= 480
          ? "QTc allongé : revoir les traitements allongeant le QT et corriger les troubles ioniques."
          : "Valeurs seuils usuelles : 450 ms chez l'homme, 470 ms chez la femme.",
    severity,
  };
}

const qtcFridericia: Calculator = {
  id: "qtc-fridericia",
  label: "QTc — Fridericia",
  categorie: "general",
  description:
    "Correction du QT par la racine cubique du RR — moins dépendante de la fréquence que Bazett.",
  reference: "Fridericia LS. Acta Med Scand 1920.",
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
    { id: "male", label: "Sexe masculin", type: "boolean", default: true },
  ],
  compute: (i): CalculatorResult => {
    const qt = num(i.qt);
    const fc = num(i.fc);
    if (qt <= 0 || fc <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez le QT et la fréquence cardiaque.",
        severity: "low",
      };
    }
    const rr = 60 / fc;
    const value = Math.round(qt / Math.cbrt(rr));
    return { value: `${value} ms`, ...qtcAssessment(value, bool(i.male)) };
  },
};

const qtcHodges: Calculator = {
  id: "qtc-hodges",
  label: "QTc — Hodges",
  categorie: "general",
  description:
    "Correction linéaire du QT : QTc = QT + 1,75 × (FC − 60). Adaptée aux fréquences très rapides ou lentes.",
  reference: "Hodges M, Salerno D, Erlien D. J Electrocardiol 1983.",
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
    { id: "male", label: "Sexe masculin", type: "boolean", default: true },
  ],
  compute: (i): CalculatorResult => {
    const qt = num(i.qt);
    const fc = num(i.fc);
    if (qt <= 0 || fc <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez le QT et la fréquence cardiaque.",
        severity: "low",
      };
    }
    const value = Math.round(qt + 1.75 * (fc - 60));
    return { value: `${value} ms`, ...qtcAssessment(value, bool(i.male)) };
  },
};

/* ─────────── Surface corporelle — Du Bois et Mosteller ─────────── */

const bsaDuBois: Calculator = {
  id: "bsa-dubois",
  label: "Surface corporelle — Du Bois",
  categorie: "general",
  description:
    "Surface corporelle (BSA) par la formule de Du Bois — utilisé pour l'indexation et la chimiothérapie.",
  reference: "Du Bois D, Du Bois EF. Arch Intern Med 1916.",
  itemsProgramme: ["Chimiothérapie", "Fonction rénale", "Hémodynamique"],
  fields: [
    {
      id: "poids",
      label: "Poids",
      type: "number",
      unit: "kg",
      min: 0,
      max: 400,
      step: 0.1,
      default: 72,
    },
    { id: "taille", label: "Taille", type: "number", unit: "cm", min: 0, max: 250, default: 168 },
  ],
  compute: (i): CalculatorResult => {
    const poids = num(i.poids);
    const taille = num(i.taille);
    if (poids <= 0 || taille <= 0) {
      return { value: "—", interpretation: "Renseignez le poids et la taille.", severity: "low" };
    }
    const value = Math.round(0.007184 * poids ** 0.425 * taille ** 0.725 * 100) / 100;
    return {
      value: `${value} m²`,
      label: "Surface corporelle calculée",
      interpretation: `BSA ${value} m² (Du Bois). Sert à l'indexation des volumes et débits cardiaques (mL/m²), des posologies (mg/m²) et du DFG.`,
      severity: "low",
    };
  },
};

const bsaMosteller: Calculator = {
  id: "bsa-mosteller",
  label: "Surface corporelle — Mosteller",
  categorie: "general",
  description:
    "Surface corporelle (BSA) par la formule de Mosteller — simple et couramment utilisée en oncologie.",
  reference: "Mosteller RD. N Engl J Med 1987.",
  itemsProgramme: ["Chimiothérapie", "Fonction rénale", "Hémodynamique"],
  fields: [
    {
      id: "poids",
      label: "Poids",
      type: "number",
      unit: "kg",
      min: 0,
      max: 400,
      step: 0.1,
      default: 72,
    },
    { id: "taille", label: "Taille", type: "number", unit: "cm", min: 0, max: 250, default: 168 },
  ],
  compute: (i): CalculatorResult => {
    const poids = num(i.poids);
    const taille = num(i.taille);
    if (poids <= 0 || taille <= 0) {
      return { value: "—", interpretation: "Renseignez le poids et la taille.", severity: "low" };
    }
    const value = Math.round(Math.sqrt((poids * taille) / 3600) * 100) / 100;
    return {
      value: `${value} m²`,
      label: "Surface corporelle calculée",
      interpretation: `BSA ${value} m² (Mosteller = √(poids × taille / 3600)). Écart habituel avec Du Bois < 0,05 m².`,
      severity: "low",
    };
  },
};

/* ─────────── Poids idéal (Devine) et poids ajusté ─────────── */

/** Poids idéal de Devine (kg) à partir de la taille en cm. */
function devineIdealWeight(heightCm: number, male: boolean): number {
  const inches = heightCm / 2.54;
  const base = male ? 50 : 45.5;
  return base + 2.3 * (inches - 60);
}

const poidsIdeal: Calculator = {
  id: "poids-ideal-devine",
  label: "Poids idéal — Devine",
  categorie: "general",
  description:
    "Poids corporel idéal (IBW) selon la taille et le sexe — base de l'adaptation des posologies.",
  reference: "Devine BJ. Drug Intell Clin Pharm 1974.",
  itemsProgramme: ["Adaptation posologique", "Ventilation mécanique"],
  fields: [
    { id: "taille", label: "Taille", type: "number", unit: "cm", min: 120, max: 230, default: 168 },
    { id: "male", label: "Sexe masculin", type: "boolean", default: true },
  ],
  compute: (i): CalculatorResult => {
    const taille = num(i.taille);
    if (taille <= 0) {
      return { value: "—", interpretation: "Renseignez la taille.", severity: "low" };
    }
    const ibw = Math.round(devineIdealWeight(taille, bool(i.male)) * 10) / 10;
    return {
      value: `${ibw} kg`,
      label: "Poids idéal",
      interpretation: `Poids idéal ${ibw} kg (Devine). Utilisé pour les posologies de certains médicaments (aminosides, héparine) et le calcul du volume courant en ventilation (6–8 mL/kg de poids idéal).`,
      severity: "low",
    };
  },
};

const poidsAjuste: Calculator = {
  id: "poids-ajuste",
  label: "Poids ajusté",
  categorie: "general",
  description:
    "Poids ajusté (AdjBW) = poids idéal + 0,4 × (poids réel − poids idéal), chez le patient obèse pour les posologies.",
  reference: "Devine BJ. Drug Intell Clin Pharm 1974 ; recommandations posologiques chez l'obèse.",
  itemsProgramme: ["Adaptation posologique", "Antibiotiques"],
  fields: [
    { id: "taille", label: "Taille", type: "number", unit: "cm", min: 120, max: 230, default: 168 },
    {
      id: "poidsReel",
      label: "Poids réel",
      type: "number",
      unit: "kg",
      min: 0,
      max: 400,
      step: 0.1,
      default: 110,
    },
    { id: "male", label: "Sexe masculin", type: "boolean", default: true },
  ],
  compute: (i): CalculatorResult => {
    const taille = num(i.taille);
    const poidsReel = num(i.poidsReel);
    if (taille <= 0 || poidsReel <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez la taille et le poids réel.",
        severity: "low",
      };
    }
    const ibw = devineIdealWeight(taille, bool(i.male));
    const value = Math.round((ibw + 0.4 * (poidsReel - ibw)) * 10) / 10;
    const obese = poidsReel > ibw * 1.2;
    return {
      value: `${value} kg`,
      label: obese ? "Poids ajusté (patient obèse)" : "Poids ajusté ≈ poids réel",
      interpretation: `Poids idéal ${Math.round(ibw * 10) / 10} kg → poids ajusté ${value} kg. Chez le patient obèse, ce poids sert de base à la posologie de certains antibiotiques (aminosides, glycopeptides) et de la ventilation protectrice.`,
      severity: "low",
    };
  },
};

/* ─────────── Ratio PaO₂/FiO₂ ─────────── */

const ratioPao2Fio2: Calculator = {
  id: "ratio-pao2-fio2",
  label: "Ratio PaO₂/FiO₂",
  categorie: "general",
  description:
    "Index d'oxygénation utilisé pour classer l'insuffisance respiratoire et le SDRA (définition de Berlin).",
  reference: "The ARDS Definition Task Force (Berlin). JAMA 2012.",
  itemsProgramme: ["Syndrome de détresse respiratoire aiguë", "Insuffisance respiratoire"],
  fields: [
    { id: "pao2", label: "PaO₂", type: "number", unit: "mmHg", min: 0, max: 700, default: 90 },
    {
      id: "fio2",
      label: "FiO₂",
      type: "number",
      unit: "%",
      min: 21,
      max: 100,
      step: 1,
      default: 21,
      help: "Air ambiant = 21 %",
    },
  ],
  compute: (i): CalculatorResult => {
    const pao2 = num(i.pao2);
    const fio2 = num(i.fio2, 21) / 100;
    if (pao2 <= 0 || fio2 <= 0) {
      return { value: "—", interpretation: "Renseignez la PaO₂ et la FiO₂.", severity: "low" };
    }
    const value = Math.round((pao2 / fio2) * 10) / 10;
    let label: string;
    let severity: CalculatorResult["severity"];
    if (value > 400) {
      label = "Oxygénation normale";
      severity = "low";
    } else if (value > 300) {
      label = "Oxygénation altérée (sans critère de SDRA)";
      severity = "medium";
    } else if (value > 200) {
      label = "SDRA léger (200–300)";
      severity = "high";
    } else if (value > 100) {
      label = "SDRA modéré (100–200)";
      severity = "high";
    } else {
      label = "SDRA sévère (< 100)";
      severity = "critical";
    }
    return {
      value: String(value),
      label,
      interpretation: `Ratio PaO₂/FiO₂ = ${value} mmHg. Définition de Berlin du SDRA : début < 7 jours, opacités bilatérales, insuffisance respiratoire non expliquée par une cardiopathie, avec PEEP ≥ 5 cmH₂O — léger 200–300, modéré 100–200, sévère < 100.`,
      severity,
    };
  },
};

/* ─────────── Winter — compensation de l'acidose métabolique ─────────── */

const winter: Calculator = {
  id: "winter",
  label: "Winter — Compensation de l'acidose",
  categorie: "general",
  description:
    "PaCO₂ attendue en cas d'acidose métabolique : 1,5 × [HCO₃⁻] + 8 ± 2. Détecte une compensation respiratoire inadaptée.",
  reference: "Winter SD et al. (formule de Winter) — enseignée dans l'approche des gaz du sang.",
  itemsProgramme: ["Désordres acido-basiques", "Gaz du sang"],
  fields: [
    {
      id: "bicarb",
      label: "Bicarbonates (HCO₃⁻)",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 50,
      step: 0.1,
      default: 15,
    },
    {
      id: "pco2",
      label: "PaCO₂ mesurée",
      type: "number",
      unit: "mmHg",
      min: 0,
      max: 150,
      step: 0.1,
      default: 30,
    },
  ],
  compute: (i): CalculatorResult => {
    const bicarb = num(i.bicarb);
    const pco2 = num(i.pco2);
    const expected = Math.round((1.5 * bicarb + 8) * 10) / 10;
    const low = Math.round((expected - 2) * 10) / 10;
    const high = Math.round((expected + 2) * 10) / 10;
    const adapted = pco2 >= expected - 2 && pco2 <= expected + 2;
    const severity: CalculatorResult["severity"] = adapted ? "low" : "high";

    let extra = "";
    if (!adapted) {
      extra =
        pco2 > expected + 2
          ? " La PaCO₂ est supérieure à l'attendu : l'hyperventilation attendue n'est pas présente — rechercher une cause respiratoire surajoutée (sédation, BPCO, épuisement respiratoire)."
          : " La PaCO₂ est inférieure à l'attendu : alcalose respiratoire associée surajoutée (douleur, hypoxie, sepsis, atteinte du SNC).";
    }
    return {
      value: `PaCO₂ attendue ${expected} mmHg`,
      label: adapted ? "Compensation respiratoire adaptée" : "Compensation respiratoire inadaptée",
      interpretation: `Intervalle attendu : ${low}–${high} mmHg (1,5 × HCO₃⁻ + 8 ± 2). PaCO₂ mesurée ${pco2} mmHg.${extra || " La compensation respiratoire est adaptée à l'acidose métabolique."}`,
      severity,
    };
  },
};

export const GENERAL_CALCULATORS: Calculator[] = [
  imc,
  dfg,
  qtc,
  qtcFridericia,
  qtcHodges,
  bsaDuBois,
  bsaMosteller,
  poidsIdeal,
  poidsAjuste,
  ratioPao2Fio2,
  winter,
];
