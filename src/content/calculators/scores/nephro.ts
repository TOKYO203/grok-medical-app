import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Néphrologie — fonction rénale, tubulopathies et protéinurie (8 scores).
 * Sources : Cockcroft & Gault 1976, MDRD (Levey 1999/2006), Schwartz 2009,
 * FENa (Espinel 1976), FEUrée (Carvounis 2002), KDIGO 2024 (albuminurie).
 */

/** Stade KDIGO à partir du DFG (mL/min/1,73 m²). */
function ckdStage(gfr: number): { stage: string; label: string } {
  if (gfr >= 90) return { stage: "G1", label: "Fonction rénale normale ou élevée" };
  if (gfr >= 60) return { stage: "G2", label: "Diminution légère du DFG" };
  if (gfr >= 45) return { stage: "G3a", label: "Diminution légère à modérée" };
  if (gfr >= 30) return { stage: "G3b", label: "Diminution modérée à sévère" };
  if (gfr >= 15) return { stage: "G4", label: "Diminution sévère" };
  return { stage: "G5", label: "Insuffisance rénale terminale" };
}

function gfrSeverity(gfr: number): CalculatorResult["severity"] {
  if (gfr >= 60) return gfr >= 90 ? "low" : "low";
  if (gfr >= 45) return "medium";
  if (gfr >= 30) return "high";
  return gfr >= 15 ? "high" : "critical";
}

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

/* ───────────────────────── MDRD (4 variables) ───────────────────────── */

const mdrd: Calculator = {
  id: "mdrd",
  label: "DFG — MDRD (4 variables)",
  categorie: "nephro",
  description:
    "Débit de filtration glomérulaire estimé par l'équation MDRD ré-exprimée (créatinine IDMS).",
  reference: "Levey AS et al. Ann Intern Med 1999 ; ré-expression IDMS : Levey AS et al. 2006.",
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
      default: 112,
    },
    { id: "female", label: "Sexe féminin (× 0,742)", type: "boolean", default: false },
    {
      id: "black",
      label: "Origine afro-caribéenne (× 1,212)",
      type: "boolean",
      default: false,
      help: "Coefficient ethnique de l'équation historique",
    },
  ],
  compute: (i): CalculatorResult => {
    const age = num(i.age);
    const scrmg = num(i.creatinine) / 88.4;
    if (age <= 0 || scrmg <= 0) {
      return { value: "—", interpretation: "Renseignez l'âge et la créatinine.", severity: "low" };
    }
    const gfr =
      175 *
      Math.pow(scrmg, -1.154) *
      Math.pow(age, -0.203) *
      (bool(i.female) ? 0.742 : 1) *
      (bool(i.black) ? 1.212 : 1);
    const rounded = Math.round(gfr * 10) / 10;
    const { stage, label } = ckdStage(rounded);
    return {
      value: `${rounded} mL/min/1,73 m²`,
      label: `${stage} — ${label}`,
      interpretation: `${gfr >= 60 ? "DFG ≥ 60 : pas d'insuffisance rénale selon ce seuil." : `Stade ${stage} (KDIGO) — adapter les posologies et rechercher une cause.`} L'équation MDRD est moins précise aux DFG élevés ; chez l'adulte, préférer CKD-EPI 2021 (sans facteur ethnique) pour le suivi.`,
      severity: gfrSeverity(rounded),
    };
  },
};

/* ─────────────────── Schwartz pédiatrique (2009) ─────────────────── */

const schwartz: Calculator = {
  id: "schwartz-2009",
  label: "DFG — Schwartz (enfant, 2009)",
  categorie: "nephro",
  description:
    "Débit de filtration glomérulaire estimé chez l'enfant par la formule bedside de Schwartz révisée.",
  reference: "Schwartz GJ et al. J Am Soc Nephrol 2009 (formule « bedside », 0,413).",
  itemsProgramme: ["Insuffisance rénale chronique de l'enfant", "Pédiatrie"],
  fields: [
    {
      id: "taille",
      label: "Taille",
      type: "number",
      unit: "cm",
      min: 30,
      max: 200,
      default: 110,
    },
    {
      id: "creatinine",
      label: "Créatinine",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 1500,
      step: 1,
      default: 45,
    },
  ],
  compute: (i): CalculatorResult => {
    const taille = num(i.taille);
    const scrmg = num(i.creatinine) / 88.4;
    if (taille <= 0 || scrmg <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez la taille et la créatinine.",
        severity: "low",
      };
    }
    const gfr = 0.413 * (taille / scrmg);
    const rounded = Math.round(gfr * 10) / 10;
    const { stage, label } = ckdStage(rounded);
    return {
      value: `${rounded} mL/min/1,73 m²`,
      label: `${stage} — ${label}`,
      interpretation:
        gfr >= 90
          ? "DFG estimé ≥ 90 mL/min/1,73 m² : fonction rénale normale pour l'âge (à interpréter selon la taille et la croissance)."
          : `Stade ${stage} (KDIGO pédiatrique) : évaluer l'albuminurie, la croissance et la pression artérielle, et adapter les posologies.`,
      severity: gfrSeverity(rounded),
    };
  },
};

/* ───────────────────────── FENa ───────────────────────── */

const fena: Calculator = {
  id: "fena",
  label: "FENa — Fraction d'excrétion du sodium",
  categorie: "nephro",
  description:
    "Distinction entre insuffisance rénale aiguë fonctionnelle (prérénale) et organique (nécrose tubulaire aiguë).",
  reference: "Espinel CH. JAMA 1976.",
  itemsProgramme: ["Insuffisance rénale aiguë", "Nécrose tubulaire aiguë"],
  fields: [
    {
      id: "una",
      label: "Natrémie urinaire (UNa)",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 300,
      default: 20,
    },
    {
      id: "pna",
      label: "Natrémie plasmatique (PNa)",
      type: "number",
      unit: "mmol/L",
      min: 90,
      max: 190,
      default: 140,
    },
    {
      id: "pcreat",
      label: "Créatinine plasmatique (PCr)",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 2000,
      default: 200,
    },
    {
      id: "ucreat",
      label: "Créatinine urinaire (UCr)",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 50000,
      default: 8000,
      help: "Même unité que la créatinine plasmatique",
    },
    {
      id: "diuretics",
      label: "Diurétiques en cours",
      type: "boolean",
      default: false,
      help: "Fausse le résultat (FENa élevée à tort)",
    },
  ],
  compute: (i): CalculatorResult => {
    const una = num(i.una);
    const pna = num(i.pna);
    const pcreat = num(i.pcreat);
    const ucreat = num(i.ucreat);
    if (pna <= 0 || pcreat <= 0 || ucreat <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez les natrémies et les créatinines.",
        severity: "low",
      };
    }
    const value = Math.round(((una * pcreat) / (pna * ucreat)) * 100 * 100) / 100;

    let label: string;
    let interpretation: string;
    let severity: CalculatorResult["severity"];
    if (value < 1) {
      label = "IRA fonctionnelle (prérénale)";
      interpretation =
        "FENa < 1 % : tubule intègre qui réabsorbe le sodium — profil d'insuffisance rénale fonctionnelle (hypovolémie, insuffisance cardiaque, syndrome hépatorénal). Le traitement est la restauration de la volémie.";
      severity = "medium";
    } else if (value <= 2) {
      label = "Zone indéterminée (1–2 %)";
      interpretation =
        "FENa 1–2 % : zone d'incertitude — interpréter avec l'ensemble du tableau clinique et l'évolution ; la FEUrée peut aider.";
      severity = "medium";
    } else {
      label = "IRA organique (nécrose tubulaire aiguë)";
      interpretation =
        "FENa > 2 % : tubule lésé incapable de réabsorber le sodium — profil organique (nécrose tubulaire aiguë, néphrite interstitielle, obstacle). Risque de surcharge hydro-sodée : adapter les apports.";
      severity = "high";
    }
    if (bool(i.diuretics)) {
      interpretation +=
        " ⚠️ Diurétiques en cours : la FENa est faussée (faussement élevée) — préférer la FEUrée ou l'examen du sédiment urinaire.";
    }
    return { value: `${value} %`, label, interpretation, severity };
  },
};

/* ───────────────────────── FEUrée ───────────────────────── */

const feUree: Calculator = {
  id: "feuree",
  label: "FEUrée — Fraction d'excrétion de l'urée",
  categorie: "nephro",
  description:
    "Alternative à la FENa pour distinguer une IRA fonctionnelle d'une IRA organique, en particulier sous diurétiques.",
  reference: "Carvounis CP et al. Kidney Int 2002.",
  itemsProgramme: ["Insuffisance rénale aiguë"],
  fields: [
    {
      id: "uuree",
      label: "Urée urinaire",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 2000,
      default: 250,
    },
    {
      id: "puree",
      label: "Urée plasmatique",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 100,
      step: 0.1,
      default: 15,
      help: "Même unité que l'urée urinaire",
    },
    {
      id: "pcreat",
      label: "Créatinine plasmatique",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 2000,
      default: 200,
    },
    {
      id: "ucreat",
      label: "Créatinine urinaire",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 50000,
      default: 8000,
    },
  ],
  compute: (i): CalculatorResult => {
    const uuree = num(i.uuree);
    const puree = num(i.puree);
    const pcreat = num(i.pcreat);
    const ucreat = num(i.ucreat);
    if (puree <= 0 || pcreat <= 0 || ucreat <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez les urées et les créatinines.",
        severity: "low",
      };
    }
    const value = Math.round(((uuree * pcreat) / (puree * ucreat)) * 100 * 100) / 100;

    let label: string;
    let interpretation: string;
    let severity: CalculatorResult["severity"];
    if (value < 35) {
      label = "IRA fonctionnelle (prérénale)";
      interpretation =
        "FEUrée < 35 % : profil d'insuffisance rénale fonctionnelle — restauration de la volémie. La FEUrée garde sa valeur diagnostique sous diurétiques, contrairement à la FENa.";
      severity = "medium";
    } else if (value <= 50) {
      label = "Zone indéterminée (35–50 %)";
      interpretation =
        "FEUrée 35–50 % : zone d'incertitude — confronter au contexte clinique, à la réponse au remplissage et à l'échographie rénale.";
      severity = "medium";
    } else {
      label = "IRA organique";
      interpretation =
        "FEUrée > 50 % : profil d'insuffisance rénale organique (nécrose tubulaire aiguë ou néphrite interstitielle).";
      severity = "high";
    }
    return { value: `${value} %`, label, interpretation, severity };
  },
};

/* ──────────── Ratio protéinurie / créatininurie (UPCR) ──────────── */

const ratioProtCreat: Calculator = {
  id: "ratio-proteinurie-creatininurie",
  label: "Ratio protéinurie / créatininurie",
  categorie: "nephro",
  description:
    "Estimation de la protéinurie des 24 h à partir du rapport protéinurie/créatininurie sur un échantillon urinaire.",
  reference: "KDIGO 2024 — Évaluation et prise en charge de la maladie rénale chronique.",
  itemsProgramme: ["Protéinurie", "Syndrome néphrotique", "Maladie rénale chronique"],
  fields: [
    {
      id: "proteinurie",
      label: "Protéinurie",
      type: "number",
      unit: "g/L",
      min: 0,
      max: 50,
      step: 0.01,
      default: 0.3,
    },
    {
      id: "creatininurie",
      label: "Créatininurie",
      type: "number",
      unit: "g/L",
      min: 0,
      max: 20,
      step: 0.01,
      default: 1,
    },
  ],
  compute: (i): CalculatorResult => {
    const prot = num(i.proteinurie);
    const creat = num(i.creatininurie);
    if (creat <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez la protéinurie et la créatininurie.",
        severity: "low",
      };
    }
    const ratio = Math.round((prot / creat) * 1000 * 10) / 10; // mg/g
    const gPerG = Math.round((prot / creat) * 100) / 100;

    let label: string;
    let interpretation: string;
    let severity: CalculatorResult["severity"];
    if (ratio < 200) {
      label = "Protéinurie normale (< 200 mg/g)";
      interpretation =
        "Rapport < 200 mg/g (< 0,2 g/g) : protéinurie normale. En cas d'atteinte glomérulaire, préférer le rapport albumine/créatininurie (A1 < 30 mg/g).";
      severity = "low";
    } else if (ratio < 2000) {
      label = "Protéinurie modérée (200–2000 mg/g)";
      interpretation =
        "Rapport 200–2000 mg/g (0,2–2 g/g) : protéinurie significative — quantifier sur les urines de 24 h ou par ACR, rechercher une néphropathie (glomérulaire, tubulo-interstitielle) et contrôler la pression artérielle.";
      severity = "medium";
    } else {
      label = "Protéinurie néphrotique (≥ 2000 mg/g)";
      interpretation =
        "Rapport ≥ 2000 mg/g (≥ 2 g/g) : protéinurie de rang néphrotique — bilan étiologique urgent (protéinurie des 24 h, albuminémie, ionogramme, créatinine, sérologies) et avis néphrologique.";
      severity = "high";
    }
    return {
      value: `${ratio} mg/g`,
      label,
      interpretation: `${interpretation} Équivalents : rapport = ${gPerG} g/g (soit ${Math.round((prot / creat) * 1000) / 1000} mg/mg). Sur les urines de 24 h, une protéinurie de 1 g/24 h correspond à environ 0,8–1 g/g selon la masse créatinique.`,
      severity,
    };
  },
};

/* ───────────── Osmolarité urinaire (calculée) ───────────── */

const osmolariteUrinaire: Calculator = {
  id: "osmolarite-urinaire",
  label: "Osmolarité urinaire",
  categorie: "nephro",
  description:
    "Osmolarité urinaire calculée : 2 × (Na + K) + urée + glucose, un reflet du pouvoir de concentration du rein.",
  reference: "Formule de l'osmolarité (osmométrie calculée) ; Purssell RA et al. 2001.",
  itemsProgramme: ["Troubles hydro-électrolytiques", "Déshydratation", "Diabète insipide"],
  fields: [
    {
      id: "na",
      label: "Sodium urinaire",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 400,
      default: 60,
    },
    {
      id: "k",
      label: "Potassium urinaire",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 300,
      default: 30,
    },
    {
      id: "uree",
      label: "Urée urinaire",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 2000,
      default: 300,
    },
    {
      id: "glucose",
      label: "Glucose urinaire",
      type: "number",
      unit: "mmol/L",
      min: 0,
      max: 600,
      default: 0,
    },
  ],
  compute: (i): CalculatorResult => {
    const value = Math.round(2 * (num(i.na) + num(i.k)) + num(i.uree) + num(i.glucose));
    let label: string;
    let interpretation: string;
    let severity: CalculatorResult["severity"];
    if (value >= 850) {
      label = "Concentration urinaire maximale (≥ 850 mOsm/kg)";
      interpretation =
        "Osmolarité urinaire ≥ 850 mOsm/kg : rein capable de concentrer au maximum ses urines (réponse adaptée à la déshydratation ou à une sécrétion d'ADH conservée).";
      severity = "low";
    } else if (value >= 500) {
      label = "Urines concentrées (500–850 mOsm/kg)";
      interpretation =
        "Osmolarité urinaire 500–850 mOsm/kg : concentration normale, adaptée à une restriction hydrique ou à une réponse hormonale normale.";
      severity = "low";
    } else if (value >= 300) {
      label = "Urines iso-osmotiques au plasma (300–500 mOsm/kg)";
      interpretation =
        "Osmolarité urinaire 300–500 mOsm/kg : proche de l'isotonie plasmatique — à interpréter selon l'état d'hydratation (apports hydriques élevés ou défaut de concentration).";
      severity = "medium";
    } else {
      label = "Urines diluées (< 300 mOsm/kg)";
      interpretation =
        "Osmolarité urinaire < 300 mOsm/kg : urines diluées — suggère un apport hydrique important ou une incapacité à concentrer les urines (diabète insipide central ou néphrogénique, potomanie, tubulopathie).";
      severity = "medium";
    }
    return { value: `${value} mOsm/kg`, label, interpretation, severity };
  },
};

/* ───────────── Clairance de l'inuline (méthode de référence) ───────────── */

const inuline: Calculator = {
  id: "clairance-inuline",
  label: "Clairance de l'inuline",
  categorie: "nephro",
  description:
    "Débit de filtration glomérulaire mesuré par la clairance de l'inuline — méthode de référence (gold standard).",
  reference: "Smith H. The Kidney (1951) ; clairance d'un marqueur idéal = DFG.",
  itemsProgramme: ["Fonction rénale", "Néphrologie"],
  fields: [
    {
      id: "uin",
      label: "Concentration urinaire d'inuline",
      type: "number",
      unit: "mg/dL",
      min: 0,
      max: 20000,
      default: 1200,
    },
    {
      id: "pin",
      label: "Concentration plasmatique d'inuline",
      type: "number",
      unit: "mg/dL",
      min: 0,
      max: 500,
      step: 0.01,
      default: 20,
      help: "Même unité que l'inuline urinaire",
    },
    {
      id: "debit",
      label: "Débit urinaire",
      type: "number",
      unit: "mL/min",
      min: 0,
      max: 30,
      step: 0.01,
      default: 1.5,
    },
  ],
  compute: (i): CalculatorResult => {
    const uin = num(i.uin);
    const pin = num(i.pin);
    const debit = num(i.debit);
    if (pin <= 0 || debit <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez les concentrations d'inuline et le débit urinaire.",
        severity: "low",
      };
    }
    const value = Math.round(((uin * debit) / pin) * 10) / 10;
    const severity = value >= 90 ? "low" : value >= 60 ? "low" : value >= 30 ? "high" : "critical";
    return {
      value: `${value} mL/min`,
      label:
        value >= 90
          ? "DFG normal (méthode de référence)"
          : value >= 60
            ? "DFG légèrement réduit"
            : value >= 30
              ? "DFG modérément à sévèrement réduit"
              : "DFG sévèrement réduit",
      interpretation: `Clairance = (U_inuline × débit) / P_inuline. L'inuline, filtrée librement et non réabsorbée ni sécrétée, donne la mesure de référence du DFG (normal 90–130 mL/min ; à indexer sur 1,73 m² de surface corporelle). En pratique clinique, la créatinine (CKD-EPI 2021) et la cystatine C sont utilisées.`,
      severity,
    };
  },
};

export const NEPHRO_CALCULATORS: Calculator[] = [
  cockcroft,
  mdrd,
  schwartz,
  fena,
  feUree,
  ratioProtCreat,
  osmolariteUrinaire,
  inuline,
];
