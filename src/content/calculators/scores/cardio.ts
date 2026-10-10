import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Cardiologie — scores de risque et règles de décision (10 scores).
 * Sources : ESC 2023 (FA, SCA, insuffisance cardiaque), AHA/ACC, publications
 * princeps citées score par score.
 */

/* ══════════════════ 1. CHA₂DS₂-VASc (risque embolique) ══════════════════ */

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
    // Seuil « hors sexe » : le point Sc ne déclenche pas l'anticoagulation seul.
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

/* ═══════════════════════ 2. HAS-BLED (risque hémorragique) ═══════════════════════ */

const hasBled: Calculator = {
  id: "has-bled",
  label: "HAS-BLED",
  categorie: "cardio",
  description: "Risque hémorragique sous anticoagulation dans la fibrillation atriale.",
  reference: "Pisters R et al. Chest 2010 ; ESC 2023 — Fibrillation atriale.",
  itemsProgramme: ["Fibrillation atriale", "Anticoagulation"],
  fields: [
    {
      id: "htn",
      label: "HTA non contrôlée (PAS > 160 mmHg)",
      type: "boolean",
      default: false,
      help: "H — 1 point",
    },
    {
      id: "renal",
      label: "Insuffisance rénale (dialyse, greffe, créat > 200 µmol/L)",
      type: "boolean",
      default: false,
      help: "A — 1 point",
    },
    {
      id: "liver",
      label: "Insuffisance hépatique (cirrhose, bilirubine > 2N, transaminases > 3N)",
      type: "boolean",
      default: false,
      help: "A — 1 point",
    },
    { id: "stroke", label: "AVC antérieur", type: "boolean", default: false, help: "S — 1 point" },
    {
      id: "bleeding",
      label: "Saignement majeur antérieur ou anémie",
      type: "boolean",
      default: false,
      help: "B — 1 point",
    },
    {
      id: "labileInr",
      label: "INR labile (TTR < 60 % sous AVK)",
      type: "boolean",
      default: false,
      help: "L — 1 point",
    },
    { id: "elderly", label: "Âge > 65 ans", type: "boolean", default: false, help: "E — 1 point" },
    {
      id: "drugs",
      label: "Médicaments favorisants (antiagrégants, AINS)",
      type: "boolean",
      default: false,
      help: "D — 1 point",
    },
    {
      id: "alcohol",
      label: "Alcool ≥ 8 verres/semaine",
      type: "boolean",
      default: false,
      help: "D — 1 point",
    },
  ],
  compute: (i): CalculatorResult => {
    const flags: [string, boolean][] = [
      ["H", bool(i.htn)],
      ["A", bool(i.renal)],
      ["A", bool(i.liver)],
      ["S", bool(i.stroke)],
      ["B", bool(i.bleeding)],
      ["L", bool(i.labileInr)],
      ["E", bool(i.elderly)],
      ["D", bool(i.drugs)],
      ["D", bool(i.alcohol)],
    ];
    const score = flags.filter(([, on]) => on).length;
    const severity: CalculatorResult["severity"] =
      score >= 5 ? "critical" : score >= 3 ? "high" : score === 2 ? "medium" : "low";
    const interpretation =
      score >= 3
        ? "Score ≥ 3 : risque hémorragique élevé — ce n'est PAS une contre-indication à l'anticoagulation : corriger les facteurs modifiables (AINS, alcool, INR labile, HTA) et rapprocher la surveillance."
        : "Score 0–2 : risque hémorragique faible à modéré — corriger les facteurs modifiables et surveiller.";
    return { value: String(score), label: `HAS-BLED ${score}`, interpretation, severity };
  },
};

/* ═══════════════ 3. GRACE (SCA — mortalité hospitalière) ═══════════════ */

const graceAge = (age: number): number =>
  age < 40 ? 0 : age < 50 ? 18 : age < 60 ? 36 : age < 70 ? 55 : age < 80 ? 73 : 91;
const graceHr = (hr: number): number =>
  hr < 70 ? 0 : hr < 90 ? 7 : hr < 110 ? 13 : hr < 150 ? 23 : hr < 200 ? 36 : 46;
const graceSbp = (sbp: number): number =>
  sbp < 80
    ? 63
    : sbp < 100
      ? 58
      : sbp < 120
        ? 47
        : sbp < 140
          ? 37
          : sbp < 160
            ? 26
            : sbp < 200
              ? 11
              : 0;
const graceCreat = (mgdl: number): number =>
  mgdl < 0.4
    ? 2
    : mgdl < 0.8
      ? 5
      : mgdl < 1.2
        ? 8
        : mgdl < 1.6
          ? 11
          : mgdl < 2
            ? 14
            : mgdl < 4
              ? 23
              : 31;
const graceKillip = (k: number): number =>
  k === 1 ? 0 : k === 2 ? 21 : k === 3 ? 43 : k === 4 ? 64 : 0;

/** Mortalité hospitalière (%) du nomogramme simplifié GRACE. */
function graceMortality(points: number): number {
  if (points <= 60) return 0.2;
  if (points <= 90) return 0.7;
  if (points <= 120) return 1.4;
  if (points <= 150) return 2.7;
  if (points <= 180) return 4.7;
  if (points <= 210) return 7.8;
  if (points <= 240) return 13;
  if (points <= 270) return 21;
  if (points <= 300) return 32;
  return 44;
}

const grace: Calculator = {
  id: "grace",
  label: "GRACE — SCA",
  categorie: "cardio",
  description: "Mortalité hospitalière du syndrome coronarien aigu (nomogramme simplifié).",
  reference: "Granger CB et al. Arch Intern Med 2003 ; ESC 2023 — SCA.",
  itemsProgramme: ["Syndrome coronarien aigu"],
  fields: [
    { id: "age", label: "Âge", type: "number", unit: "ans", min: 18, max: 120, default: 65 },
    {
      id: "fc",
      label: "Fréquence cardiaque",
      type: "number",
      unit: "bpm",
      min: 20,
      max: 300,
      default: 80,
    },
    {
      id: "pas",
      label: "Pression artérielle systolique",
      type: "number",
      unit: "mmHg",
      min: 40,
      max: 300,
      default: 130,
    },
    {
      id: "creatinine",
      label: "Créatinine",
      type: "number",
      unit: "µmol/L",
      min: 0,
      max: 2000,
      default: 100,
    },
    {
      id: "killip",
      label: "Classe de Killip",
      type: "select",
      default: "1",
      options: [
        { value: "1", label: "I — pas de râles, pas de B3" },
        { value: "2", label: "II — râles < 50 % ou B3" },
        { value: "3", label: "III — OAP" },
        { value: "4", label: "IV — choc cardiogénique" },
      ],
    },
    {
      id: "arrest",
      label: "Arrêt cardiaque à l'admission",
      type: "boolean",
      default: false,
      help: "43 points",
    },
    {
      id: "stDeviation",
      label: "Déviation du segment ST",
      type: "boolean",
      default: false,
      help: "30 points",
    },
    {
      id: "enzymes",
      label: "Enzymes cardiaques élevées",
      type: "boolean",
      default: false,
      help: "15 points",
    },
  ],
  compute: (i): CalculatorResult => {
    const creatMgdl = num(i.creatinine) / 88.4;
    const points =
      graceAge(num(i.age)) +
      graceHr(num(i.fc)) +
      graceSbp(num(i.pas)) +
      graceCreat(creatMgdl) +
      graceKillip(num(i.killip)) +
      (bool(i.arrest) ? 43 : 0) +
      (bool(i.stDeviation) ? 30 : 0) +
      (bool(i.enzymes) ? 15 : 0);

    const mortality = graceMortality(points);
    const severity: CalculatorResult["severity"] =
      points <= 120 ? "low" : points <= 180 ? "medium" : points <= 240 ? "high" : "critical";
    const tier =
      points <= 120
        ? "bas"
        : points <= 180
          ? "intermédiaire"
          : points <= 240
            ? "élevé"
            : "très élevé";
    return {
      value: String(points),
      label: `Risque ${tier}`,
      interpretation: `Mortalité hospitalière estimée ≈ ${mortality} % (nomogramme simplifié GRACE). ${severity === "critical" || severity === "high" ? "Stratégie invasive précoce à discuter en Heart Team." : "Traitement médical et surveillance selon le risque."}`,
      severity,
    };
  },
};

/* ═══════════════ 4. TIMI UA/NSTEMI (SCA non ST+) ═══════════════ */

const timiUa: Calculator = {
  id: "timi-ua-nstemi",
  label: "TIMI — UA/NSTEMI",
  categorie: "cardio",
  description: "Risque à 14 jours de décès, IDM ou revascularisation urgente (SCA non ST+).",
  reference: "Antman EM et al. JAMA 2000.",
  itemsProgramme: ["Syndrome coronarien aigu"],
  fields: [
    { id: "age65", label: "Âge ≥ 65 ans", type: "boolean", default: false, help: "1 point" },
    {
      id: "riskFactors",
      label: "≥ 3 facteurs de risque cardiovasculaire",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "knownCad",
      label: "Coronaropathie connue (sténose ≥ 50 %)",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "asa7",
      label: "Aspirine prise dans les 7 derniers jours",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "severeAngina",
      label: "Angor sévère récent (≥ 2 épisodes en 24 h)",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "stDeviation",
      label: "Déviation ST ≥ 0,5 mm",
      type: "boolean",
      default: false,
      help: "1 point",
    },
    {
      id: "markers",
      label: "Marqueurs cardiaques (troponine) élevés",
      type: "boolean",
      default: false,
      help: "1 point",
    },
  ],
  compute: (i): CalculatorResult => {
    const score = [
      bool(i.age65),
      bool(i.riskFactors),
      bool(i.knownCad),
      bool(i.asa7),
      bool(i.severeAngina),
      bool(i.stDeviation),
      bool(i.markers),
    ].filter(Boolean).length;

    const riskPct =
      score <= 1
        ? 4.7
        : score === 2
          ? 8.3
          : score === 3
            ? 13.2
            : score === 4
              ? 19.9
              : score === 5
                ? 26.2
                : 40.9;
    const severity: CalculatorResult["severity"] =
      score <= 1 ? "low" : score <= 3 ? "medium" : score <= 5 ? "high" : "critical";
    return {
      value: String(score),
      label: `TIMI ${score}/7`,
      interpretation: `Événement (décès / IDM / revascularisation urgente) à 14 jours ≈ ${riskPct} %. ${score >= 5 ? "Stratégie invasive précoce recommandée (ESC 2023)." : score >= 3 ? "Stratégie invasive à discuter selon le risque." : "Traitement médical initial."}`,
      severity,
    };
  },
};

/* ═══════════════ 5. Killip (insuffisance cardiaque de l'IDM) ═══════════════ */

const killip: Calculator = {
  id: "killip",
  label: "Killip — IDM",
  categorie: "cardio",
  description: "Classification clinique de l'insuffisance cardiaque au décours immédiat de l'IDM.",
  reference: "Killip T, Kimball JT. Am J Cardiol 1967.",
  itemsProgramme: ["Infarctus du myocarde"],
  fields: [
    {
      id: "classe",
      label: "Classe clinique",
      type: "select",
      default: "1",
      options: [
        { value: "1", label: "I — pas de râles, pas de B3" },
        { value: "2", label: "II — râles < 50 % des champs ou B3" },
        { value: "3", label: "III — œdème aigu du poumon" },
        { value: "4", label: "IV — choc cardiogénique" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const k = num(i.classe, 1);
    const severity: CalculatorResult["severity"] =
      k === 1 ? "low" : k === 2 ? "medium" : k === 3 ? "high" : "critical";
    const label =
      k === 1 ? "Killip I" : k === 2 ? "Killip II" : k === 3 ? "Killip III" : "Killip IV";
    const interpretation =
      k === 1
        ? "Pas de signe d'insuffisance cardiaque. Mortalité hospitalière la plus faible."
        : k === 2
          ? "Insuffisance cardiaque modérée : diurétiques, surveillance hémodynamique rapprochée."
          : k === 3
            ? "Œdème aigu du poumon : oxygénothérapie, diurétiques IV, vasodilatateurs ; réanimation à discuter."
            : "Choc cardiogénique : réanimation, inotropes/vasopresseurs, revascularisation urgente, assistance circulatoire.";
    return {
      value: label,
      label: k <= 2 ? "Risque faible à modéré" : "Risque élevé",
      interpretation,
      severity,
    };
  },
};

/* ═══════════════ 6. NYHA (classe fonctionnelle) ═══════════════ */

const nyha: Calculator = {
  id: "nyha",
  label: "NYHA — Dyspnée fonctionnelle",
  categorie: "cardio",
  description: "Classe fonctionnelle de la New York Heart Association (insuffisance cardiaque).",
  reference: "AHA/ACC/HFSA 2022 ; classification NYHA.",
  itemsProgramme: ["Insuffisance cardiaque"],
  fields: [
    {
      id: "classe",
      label: "Retentissement fonctionnel",
      type: "select",
      default: "1",
      options: [
        { value: "1", label: "I — aucune limitation (effort important seulement)" },
        { value: "2", label: "II — limitation légère (effort habituel)" },
        { value: "3", label: "III — limitation marquée (effort minime)" },
        { value: "4", label: "IV — dyspnée de repos" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const c = num(i.classe, 1);
    const severity: CalculatorResult["severity"] =
      c === 1 ? "low" : c === 2 ? "low" : c === 3 ? "high" : "critical";
    const interpretation =
      c === 1
        ? "NYHA I — traitement de fond et éducation thérapeutique."
        : c === 2
          ? "NYHA II — optimisation du traitement de fond de l'IC (IEC/ARA2/ARNI, bêtabloquant, ARM, iSGLT2)."
          : c === 3
            ? "NYHA III — optimisation maximale, réévaluation des diurétiques, discussion d'assistance ou transplantation."
            : "NYHA IV — dyspnée de repos : prise en charge en milieu spécialisé, soins palliatifs à envisager.";
    return {
      value: `NYHA ${c}`,
      label: c <= 2 ? "Symptômes légers" : "Symptômes marqués",
      interpretation,
      severity,
    };
  },
};

/* ═══════════════ 7. Wells — thrombose veineuse profonde ═══════════════ */

const wellsDvt: Calculator = {
  id: "wells-tvp",
  label: "Wells — TVP",
  categorie: "cardio",
  description: "Probabilité clinique de thrombose veineuse profonde des membres inférieurs.",
  reference: "Wells PS et al. Lancet 1997.",
  itemsProgramme: ["Thrombose veineuse profonde"],
  fields: [
    {
      id: "cancer",
      label: "Cancer actif (traitement < 6 mois ou palliatif)",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "paralysis",
      label: "Paralysie, parésie ou immobilisation plâtrée",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "bedridden",
      label: "Alitement ≥ 3 j ou chirurgie majeure < 12 semaines",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "tenderness",
      label: "Douleur à la palpation du trajet veineux profond",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "legSwollen",
      label: "Tuméfaction de tout le membre",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "calfDiff",
      label: "Mollet > 3 cm plus gros que le controlatéral",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "pittingEdema",
      label: "Œdème prenant le godet unilatéral",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "collateral",
      label: "Circulation collatérale superficielle (non variqueuse)",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "previousVte",
      label: "TVP documentée antérieurement",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "altDiagnosis",
      label: "Diagnostic alternatif au moins aussi probable",
      type: "boolean",
      default: false,
      help: "−2",
    },
  ],
  compute: (i): CalculatorResult => {
    let score = 0;
    for (const key of [
      "cancer",
      "paralysis",
      "bedridden",
      "tenderness",
      "legSwollen",
      "calfDiff",
      "pittingEdema",
      "collateral",
      "previousVte",
    ]) {
      if (bool(i[key])) score += 1;
    }
    if (bool(i.altDiagnosis)) score -= 2;

    const likely = score >= 2;
    return {
      value: String(score),
      label: likely ? "TVP probable (≥ 2)" : "TVP improbable (≤ 1)",
      interpretation: likely
        ? "Probabilité ≥ 2 : échographie-Doppler veineuse d'emblée (les D-dimères ne suffisent pas à exclure)."
        : "Probabilité ≤ 1 : D-dimères (ajustés à l'âge) — si négatifs, la TVP est exclue ; sinon échographie.",
      severity: likely ? "high" : "low",
    };
  },
};

/* ═══════════════ 8. Genève révisé — embolie pulmonaire ═══════════════ */

const geneva: Calculator = {
  id: "geneve-ep",
  label: "Genève révisé — EP",
  categorie: "cardio",
  description: "Probabilité clinique d'embolie pulmonaire (score de Genève révisé).",
  reference: "Le Gal G et al. Ann Intern Med 2006.",
  itemsProgramme: ["Embolie pulmonaire"],
  fields: [
    { id: "age65", label: "Âge > 65 ans", type: "boolean", default: false, help: "+1" },
    { id: "previous", label: "TVP ou EP antérieure", type: "boolean", default: false, help: "+3" },
    {
      id: "surgery",
      label: "Chirurgie ou fracture < 1 mois",
      type: "boolean",
      default: false,
      help: "+2",
    },
    { id: "malignancy", label: "Néoplasie active", type: "boolean", default: false, help: "+2" },
    {
      id: "limbPain",
      label: "Douleur unilatérale d'un membre inférieur",
      type: "boolean",
      default: false,
      help: "+3",
    },
    { id: "hemoptysis", label: "Hémoptysie", type: "boolean", default: false, help: "+2" },
    {
      id: "fc",
      label: "Fréquence cardiaque",
      type: "number",
      unit: "bpm",
      min: 20,
      max: 300,
      default: 80,
      help: "75–94 : +3 · ≥ 95 : +5",
    },
    {
      id: "palpationEdema",
      label: "Douleur à la palpation profonde + œdème unilatéral du membre",
      type: "boolean",
      default: false,
      help: "+4",
    },
  ],
  compute: (i): CalculatorResult => {
    const fc = num(i.fc);
    const fcPoints = fc >= 95 ? 5 : fc >= 75 ? 3 : 0;
    const score =
      (bool(i.age65) ? 1 : 0) +
      (bool(i.previous) ? 3 : 0) +
      (bool(i.surgery) ? 2 : 0) +
      (bool(i.malignancy) ? 2 : 0) +
      (bool(i.limbPain) ? 3 : 0) +
      (bool(i.hemoptysis) ? 2 : 0) +
      fcPoints +
      (bool(i.palpationEdema) ? 4 : 0);

    const tier = score <= 3 ? "faible" : score <= 10 ? "intermédiaire" : "élevée";
    const riskPct = score <= 3 ? 8 : score <= 10 ? 29 : 74;
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 10 ? "medium" : "high";
    return {
      value: String(score),
      label: `Probabilité ${tier}`,
      interpretation: `Prévalence d'EP ≈ ${riskPct} %. ${score <= 3 ? "D-dimères pour exclure si faible probabilité." : "Imagerie (angio-TDM) d'emblée."}`,
      severity,
    };
  },
};

/* ═══════════════ 9. PERC (règle d'exclusion de l'EP) ═══════════════ */

const perc: Calculator = {
  id: "perc",
  label: "PERC — Exclusion d'EP",
  categorie: "cardio",
  description: "Règle d'exclusion de l'embolie pulmonaire chez le patient à faible probabilité.",
  reference: "Kline JA et al. J Thromb Haemost 2008.",
  itemsProgramme: ["Embolie pulmonaire"],
  fields: [
    {
      id: "age50",
      label: "Âge ≥ 50 ans",
      type: "boolean",
      default: false,
      help: "Critère PERC : âge < 50 ans",
    },
    {
      id: "tachycardia",
      label: "FC ≥ 100/min",
      type: "boolean",
      default: false,
      help: "Critère PERC : FC < 100",
    },
    {
      id: "hypoxia",
      label: "SpO₂ < 95 % à l'air ambiant",
      type: "boolean",
      default: false,
      help: "Critère PERC : SpO₂ ≥ 95 %",
    },
    {
      id: "hemoptysis",
      label: "Hémoptysie",
      type: "boolean",
      default: false,
      help: "Critère PERC : absence",
    },
    {
      id: "estrogen",
      label: "Œstrogènes en cours",
      type: "boolean",
      default: false,
      help: "Critère PERC : absence",
    },
    {
      id: "priorVte",
      label: "ATCD de TVP / EP",
      type: "boolean",
      default: false,
      help: "Critère PERC : absence",
    },
    {
      id: "legSwelling",
      label: "Œdème unilatéral d'un membre inférieur",
      type: "boolean",
      default: false,
      help: "Critère PERC : absence",
    },
    {
      id: "recentSurgery",
      label: "Chirurgie ou traumatisme < 4 semaines",
      type: "boolean",
      default: false,
      help: "Critère PERC : absence",
    },
  ],
  compute: (i): CalculatorResult => {
    const violated = perc.fields.filter((f) => bool(i[f.id])).length;
    if (violated === 0) {
      return {
        value: "PERC négatif",
        label: "EP exclue sans examen",
        interpretation:
          "Les 8 critères sont absents : chez un patient à faible probabilité clinique (< 15 %), l'embolie pulmonaire est exclue sans D-dimères ni imagerie.",
        severity: "low",
      };
    }
    return {
      value: "PERC positif",
      label: `${violated} critère${violated > 1 ? "s" : ""} présent${violated > 1 ? "s" : ""}`,
      interpretation:
        "Au moins un critère est présent : la PERC ne s'applique pas. Poursuivre la démarche diagnostique (probabilité clinique + D-dimères/angio-TDM).",
      severity: "medium",
    };
  },
};

/* ═══════════════ 10. HEART score (douleur thoracique) ═══════════════ */

const heartAgePoints = (age: number): number => (age < 45 ? 0 : age < 65 ? 1 : 2);

const heart: Calculator = {
  id: "heart",
  label: "HEART score",
  categorie: "cardio",
  description:
    "Risque d'événement cardiovasculaire majeur à 6 semaines devant une douleur thoracique.",
  reference: "Six AJ et al. Neth Heart J 2008 ; Backus BE et al. Int J Cardiol 2013.",
  itemsProgramme: ["Douleur thoracique", "Syndrome coronarien aigu"],
  fields: [
    {
      id: "history",
      label: "Anamnèse (History)",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Peu suspecte (0)" },
        { value: "1", label: "Modérément suspecte (1)" },
        { value: "2", label: "Très suspecte (2)" },
      ],
    },
    {
      id: "ecg",
      label: "ECG",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Normal (0)" },
        { value: "1", label: "Anomalies non spécifiques (1)" },
        { value: "2", label: "Déviation ST significative (2)" },
      ],
    },
    {
      id: "age",
      label: "Âge",
      type: "number",
      unit: "ans",
      min: 18,
      max: 120,
      default: 55,
      help: "< 45 : 0 · 45–64 : 1 · ≥ 65 : 2",
    },
    {
      id: "riskFactors",
      label: "Facteurs de risque (Risk factors)",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Aucun (0)" },
        { value: "1", label: "1 à 2 facteurs (1)" },
        { value: "2", label: "≥ 3 facteurs ou athérosclérose connue (2)" },
      ],
    },
    {
      id: "troponin",
      label: "Troponine",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Normale (0)" },
        { value: "1", label: "1–3 × la limite supérieure (1)" },
        { value: "2", label: "> 3 × la limite supérieure (2)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const score =
      num(i.history) +
      num(i.ecg) +
      heartAgePoints(num(i.age)) +
      num(i.riskFactors) +
      num(i.troponin);
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 6 ? "medium" : "high";
    const riskPct = score <= 3 ? 1.7 : score <= 6 ? 16.6 : 50.1;
    const tier = score <= 3 ? "faible" : score <= 6 ? "intermédiaire" : "élevé";
    return {
      value: String(score),
      label: `Risque ${tier} — MACE 6 semaines ≈ ${riskPct} %`,
      interpretation:
        score <= 3
          ? "Score 0–3 : sortie possible avec bilan ambulatoire si l'ECG et la troponine sont non contributifs."
          : score <= 6
            ? "Score 4–6 : hospitalisation courte et évaluation cardiologique."
            : "Score 7–10 : prise en charge invasive précoce recommandée.",
      severity,
    };
  },
};

export const CARDIO_CALCULATORS: Calculator[] = [
  cha2ds2Vasc,
  hasBled,
  grace,
  timiUa,
  killip,
  nyha,
  wellsDvt,
  geneva,
  perc,
  heart,
];
