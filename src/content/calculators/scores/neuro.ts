import type { Calculator, CalculatorField, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Neurologie — accidents vasculaires cérébraux, coma et autonomie (8 scores).
 * Sources : Teasdale & Jennett 1974 (Glasgow), Johnston 2007 (ABCD²),
 * Brott 1989 (NIHSS), Rankin 1957 / van Swieten 1988 (mRS), Hoehn & Yahr 1967,
 * Kurtzke 1983 (EDSS), Mahoney & Barthel 1965, Wijdicks 2005 (FOUR).
 */

/** Champ à points : le libellé décrit l'option, la valeur = points. */
function scoredField(
  id: string,
  label: string,
  options: string[],
  defaultValue = "0",
): CalculatorField {
  return {
    id,
    label,
    type: "select",
    default: defaultValue,
    options: options.map((text, index) => ({ value: String(index), label: `${text} (${index})` })),
  };
}

/* ─────────────────────── 1. Glasgow (GCS) ─────────────────────── */

const glasgow: Calculator = {
  id: "glasgow",
  label: "Glasgow (GCS)",
  categorie: "neuro",
  description: "Évaluation du niveau de conscience : yeux + réponse verbale + réponse motrice.",
  reference: "Teasdale G, Jennett B. Lancet 1974.",
  itemsProgramme: ["Traumatisme crânien", "Coma"],
  fields: [
    {
      id: "yeux",
      label: "Ouverture des yeux (Y)",
      type: "number",
      min: 1,
      max: 4,
      default: 4,
      help: "4 spontanée · 3 à la demande · 2 à la douleur · 1 aucune",
    },
    {
      id: "verbale",
      label: "Réponse verbale (V)",
      type: "number",
      min: 1,
      max: 5,
      default: 5,
      help: "5 orientée · 4 confuse · 3 inappropriée · 2 incompréhensible · 1 aucune",
    },
    {
      id: "motrice",
      label: "Réponse motrice (M)",
      type: "number",
      min: 1,
      max: 6,
      default: 6,
      help: "6 obéit · 5 orientée · 4 évitement · 3 flexion · 2 extension · 1 aucune",
    },
  ],
  compute: (i): CalculatorResult => {
    const eye = Math.min(4, Math.max(1, num(i.yeux, 1)));
    const verbal = Math.min(5, Math.max(1, num(i.verbale, 1)));
    const motor = Math.min(6, Math.max(1, num(i.motrice, 1)));
    const total = eye + verbal + motor;
    const severity =
      total <= 8 ? "critical" : total <= 12 ? "high" : total <= 14 ? "medium" : "low";
    let label = "";
    let interpretation = "";
    if (total <= 8) {
      label = "Sévère (GCS ≤ 8)";
      interpretation =
        "GCS ≤ 8 : protéger les voies aériennes — intubation à discuter, avis neurochirurgical, TDM cérébrale en urgence.";
    } else if (total <= 12) {
      label = "Modéré (GCS 9–12)";
      interpretation = "GCS 9–12 : surveillance rapprochée, imagerie cérébrale et avis spécialisé.";
    } else if (total <= 14) {
      label = "Léger (GCS 13–14)";
      interpretation =
        "GCS 13–14 : traumatisme crânien léger — réévaluation et imagerie selon les critères.";
    } else {
      label = "Normal (GCS 15)";
      interpretation = "GCS 15 : conscience normale — pas de trouble de la vigilance.";
    }
    return {
      value: `${total}/15`,
      label,
      interpretation: `Y${eye} V${verbal} M${motor} — ${interpretation}`,
      severity,
    };
  },
};

/* ═══════════════════════ 2. ABCD² (AIT) ═══════════════════════ */

const abcd2: Calculator = {
  id: "abcd2",
  label: "ABCD² — AIT",
  categorie: "neuro",
  description: "Risque d'AVC à court terme après un accident ischémique transitoire.",
  reference: "Johnston SC et al. Lancet 2007.",
  itemsProgramme: ["Accident ischémique transitoire", "Prévention de l'AVC"],
  fields: [
    { id: "age60", label: "Âge ≥ 60 ans", type: "boolean", default: false, help: "A — 1 point" },
    {
      id: "bp",
      label: "PAS ≥ 140 ou PAD ≥ 90 mmHg",
      type: "boolean",
      default: false,
      help: "B — 1 point",
    },
    {
      id: "clinical",
      label: "Signes cliniques",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Autres symptômes (0)" },
        { value: "1", label: "Trouble du langage sans déficit moteur (1)" },
        { value: "2", label: "Déficit moteur unilatéral (2)" },
      ],
      help: "C",
    },
    {
      id: "duration",
      label: "Durée des symptômes",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "< 10 minutes (0)" },
        { value: "1", label: "10–59 minutes (1)" },
        { value: "2", label: "≥ 60 minutes (2)" },
      ],
      help: "D",
    },
    { id: "diabetes", label: "Diabète", type: "boolean", default: false, help: "D — 1 point" },
  ],
  compute: (i): CalculatorResult => {
    const score =
      (bool(i.age60) ? 1 : 0) +
      (bool(i.bp) ? 1 : 0) +
      num(i.clinical) +
      num(i.duration) +
      (bool(i.diabetes) ? 1 : 0);
    const risk2d = score <= 3 ? "1,0" : score <= 5 ? "4,1" : "8,1";
    const risk7d = score <= 3 ? "1,2" : score <= 5 ? "5,9" : "11,7";
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 5 ? "medium" : "high";
    return {
      value: String(score),
      label: `Risque d'AVC : ${risk2d} % à 2 j · ${risk7d} % à 7 j`,
      interpretation:
        score <= 3
          ? "ABCD² 0–3 : risque faible — bilan étiologique rapide et prise en charge en ambulatoire possible sous surveillance."
          : score <= 5
            ? "ABCD² 4–5 : risque intermédiaire — bilan vasculaire rapide et évaluation spécialisée ; envisager l'hospitalisation."
            : "ABCD² 6–7 : risque élevé — hospitalisation et bilan étiologique urgent (≤ 24 h), traitement antiagrégant et contrôle des facteurs de risque.",
      severity,
    };
  },
};

/* ═══════════════════════ 3. NIHSS ═══════════════════════ */

const nihss: Calculator = {
  id: "nihss",
  label: "NIHSS — AVC",
  categorie: "neuro",
  description:
    "National Institutes of Health Stroke Scale : gravité d'un AVC à la phase aiguë (0–42).",
  reference: "Brott T et al. Stroke 1989 ; AHA/ASA 2019.",
  itemsProgramme: ["Accident vasculaire cérébral", "Thrombolyse"],
  fields: [
    scoredField("gcs1", "1. Niveau de conscience", [
      "Éveillé",
      "Somnolent, réveillable",
      "Réponse à la douleur",
      "Coma / aucune réponse",
    ]),
    scoredField("gcs2", "2. Orientation (mois et âge)", [
      "Les deux correctes",
      "Une correcte",
      "Aucune correcte",
    ]),
    scoredField("gcs3", "3. Réponse aux ordres (fermer les yeux, serrer la main)", [
      "Les deux corrects",
      "Un seul correct",
      "Aucun correct",
    ]),
    scoredField("regard", "4. Regard conjugué", [
      "Normal",
      "Paralysie partielle",
      "Déviation forcée",
    ]),
    scoredField("vision", "5. Champ visuel", [
      "Normal",
      "Hémianopsie partielle",
      "Hémianopsie complète",
      "Cécité bilatérale",
    ]),
    scoredField("face", "6. Paralysie faciale", [
      "Absente",
      "Minime (effacement du pli nasogénien)",
      "Partielle (motricité inférieure)",
      "Complète (supérieure et inférieure)",
    ]),
    scoredField("brasG", "7. Motricité — bras gauche", [
      "Normale",
      "Tenue 10 s sans chute",
      "Chute avant 10 s",
      "Tombe immédiatement",
      "Aucun mouvement",
    ]),
    scoredField("brasD", "8. Motricité — bras droit", [
      "Normale",
      "Tenue 10 s sans chute",
      "Chute avant 10 s",
      "Tombe immédiatement",
      "Aucun mouvement",
    ]),
    scoredField("jambeG", "9. Motricité — jambe gauche", [
      "Normale",
      "Tenue 5 s sans chute",
      "Chute avant 5 s",
      "Tombe immédiatement",
      "Aucun mouvement",
    ]),
    scoredField("jambeD", "10. Motricité — jambe droite", [
      "Normale",
      "Tenue 5 s sans chute",
      "Chute avant 5 s",
      "Tombe immédiatement",
      "Aucun mouvement",
    ]),
    scoredField("ataxie", "11. Ataxie des membres", ["Absente", "Un membre", "Deux membres"]),
    scoredField("sensibilite", "12. Sensibilité", [
      "Normale",
      "Perte légère à modérée",
      "Perte sévère",
    ]),
    scoredField("langage", "13. Langage", [
      "Normal",
      "Aphasie légère à modérée",
      "Aphasie sévère",
      "Mutisme",
    ]),
    scoredField("dysarthrie", "14. Dysarthrie", ["Normale", "Légère à modérée", "Sévère"]),
    scoredField("negligence", "15. Extinction / négligence", [
      "Absente",
      "Légère (une modalité)",
      "Sévère (plurimodale)",
    ]),
  ],
  compute: (i): CalculatorResult => {
    const score = nihss.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    let label: string;
    let severity: CalculatorResult["severity"];
    if (score === 0) {
      label = "Pas de déficit";
      severity = "low";
    } else if (score <= 4) {
      label = "AVC mineur";
      severity = "low";
    } else if (score <= 15) {
      label = "AVC modéré";
      severity = "medium";
    } else if (score <= 20) {
      label = "AVC modéré à sévère";
      severity = "high";
    } else {
      label = "AVC sévère";
      severity = "critical";
    }
    return {
      value: `${score}/42`,
      label,
      interpretation: `${score >= 5 ? "NIHSS ≥ 5 : évaluer l'indication de thrombolyse IV (fenêtre ≤ 4 h 30) et/ou de thrombectomie mécanique (occlusion proximale, ≤ 24 h selon l'imagerie)." : "NIHSS < 5 : déficit mineur — la thrombolyse reste possible mais le rapport bénéfice/risque doit être discuté."} Réévaluer régulièrement : toute aggravation ≥ 4 points doit faire rechercher une occlusion ou une hémorragie.`,
      severity,
    };
  },
};

/* ═══════════════ 4. Rankin modifiée (mRS) ═══════════════ */

const rankin: Calculator = {
  id: "rankin-modifiee",
  label: "Rankin modifiée (mRS)",
  categorie: "neuro",
  description: "Handicap fonctionnel global après un AVC ou une maladie neurologique (0–6).",
  reference: "Rankin J. Scott Med J 1957 ; van Swieten JC et al. Stroke 1988.",
  itemsProgramme: ["Accident vasculaire cérébral", "Handicap"],
  fields: [
    {
      id: "grade",
      label: "Degré de handicap",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "0 — Aucun symptôme" },
        { value: "1", label: "1 — Pas d'incapacité malgré des symptômes" },
        { value: "2", label: "2 — Handicap léger (autonome, activités restreintes)" },
        { value: "3", label: "3 — Handicap modéré (aide nécessaire, marche seul)" },
        { value: "4", label: "4 — Handicap modérément sévère (ne marche pas sans aide)" },
        { value: "5", label: "5 — Handicap sévère (alité, soins constants)" },
        { value: "6", label: "6 — Décès" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const grade = Math.min(6, Math.max(0, num(i.grade)));
    const severity: CalculatorResult["severity"] =
      grade <= 1
        ? "low"
        : grade === 2
          ? "low"
          : grade === 3
            ? "medium"
            : grade <= 5
              ? "high"
              : "critical";
    return {
      value: `mRS ${grade}`,
      label:
        grade <= 1
          ? "Indépendance fonctionnelle"
          : grade <= 2
            ? "Handicap léger"
            : grade <= 4
              ? "Handicap modéré à sévère"
              : grade === 5
                ? "Handicap sévère"
                : "Décès",
      interpretation:
        grade <= 2
          ? "mRS 0–2 : évolution favorable — critère usuel de bon pronostic après thrombolyse/thrombectomie (évalué à 90 jours)."
          : grade <= 4
            ? "mRS 3–4 : dépendance partielle — réadaptation intensive, prévention secondaire et évaluation de l'aidant."
            : "mRS 5–6 : dépendance majeure ou décès — soins de support, prévention des complications et discussion des objectifs de soins.",
      severity,
    };
  },
};

/* ═══════════════ 5. Hoehn & Yahr (Parkinson) ═══════════════ */

const hoehnYahr: Calculator = {
  id: "hoehn-yahr",
  label: "Hoehn & Yahr — Parkinson",
  categorie: "neuro",
  description: "Stadification de la maladie de Parkinson selon l'atteinte motrice et l'équilibre.",
  reference: "Hoehn MM, Yahr MD. Neurology 1967 ; Goetz CG et al. (modification 2004).",
  itemsProgramme: ["Maladie de Parkinson"],
  fields: [
    {
      id: "stade",
      label: "Stade clinique",
      type: "select",
      default: "1",
      options: [
        { value: "1", label: "1 — Atteinte unilatérale uniquement" },
        { value: "1.5", label: "1,5 — Atteinte unilatérale + atteinte axiale" },
        { value: "2", label: "2 — Atteinte bilatérale sans trouble de l'équilibre" },
        {
          value: "2.5",
          label: "2,5 — Atteinte bilatérale légère, récupération au test de la poussée",
        },
        { value: "3", label: "3 — Instabilité posturale, physiquement indépendant" },
        { value: "4", label: "4 — Handicap sévère, marche ou tient debout sans aide" },
        { value: "5", label: "5 — Alité ou en fauteuil roulant" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const stade = num(i.stade, 1);
    const severity: CalculatorResult["severity"] =
      stade <= 1.5 ? "low" : stade <= 2.5 ? "medium" : stade <= 3 ? "high" : "critical";
    return {
      value: `Stade ${String(stade).replace(".", ",")}`,
      label:
        stade <= 1.5
          ? "Atteinte légère (unilatérale)"
          : stade <= 2.5
            ? "Atteinte bilatérale sans instabilité"
            : stade === 3
              ? "Instabilité posturale, autonomie conservée"
              : "Handicap sévère",
      interpretation:
        stade <= 2.5
          ? "Stades 1–2,5 : maladie débutante à modérée — traitement dopaminergique selon le retentissement fonctionnel, activité physique et éducation."
          : stade === 3
            ? "Stade 3 : instabilité posturale sans aide à la marche — prévention des chutes, adaptation du traitement et kinésithérapie."
            : "Stades 4–5 : maladie avancée — dépendance, gestion des fluctuations et des dyskinésies, soins de support et aide à domicile.",
      severity,
    };
  },
};

/* ═══════════════════════ 6. EDSS (SEP) ═══════════════════════ */

const EDSS_STEPS: [string, string][] = [
  ["0", "0 — Examen neurologique normal"],
  ["1", "1,0 — Aucune incapacité, signes minimes dans 1 système fonctionnel"],
  ["1.5", "1,5 — Aucune incapacité, signes minimes dans plus d'1 système"],
  ["2", "2,0 — Incapacité minime dans 1 système"],
  ["2.5", "2,5 — Incapacité minime dans 2 systèmes"],
  ["3", "3,0 — Incapacité modérée dans 1 système ou légère dans 3–4 systèmes ; marche sans aide"],
  ["3.5", "3,5 — Marche sans aide ; incapacité modérée + 1–2 systèmes légèrement atteints"],
  ["4", "4,0 — Marche sans aide ; autonome ~12 h/j malgré une incapacité marquée"],
  ["4.5", "4,5 — Marche sans aide ; actif toute la journée, limitations des activités"],
  ["5", "5,0 — Marche sans aide sur 200 m ; gêne pour le travail"],
  ["5.5", "5,5 — Marche sans aide sur 100 m ; gêne des activités quotidiennes"],
  ["6", "6,0 — Aide unilatérale (canne) intermittente pour 100 m"],
  ["6.5", "6,5 — Aide bilatérale constante pour 20 m"],
  ["7", "7,0 — Ne marche pas 5 m même avec aide ; autonome au fauteuil roulant"],
  ["7.5", "7,5 — Quelques pas possibles ; autonome au fauteuil, transferts seul"],
  ["8", "8,0 — Confiné au fauteuil/lit ; autonome pour les soins, usage des bras"],
  ["8.5", "8,5 — Confiné au lit la majeure partie du jour ; usage partiel des bras"],
  ["9", "9,0 — Alité, dépendant ; communication et alimentation possibles"],
  ["9.5", "9,5 — Alité, totalement dépendant ; communication et alimentation impossibles"],
  ["10", "10 — Décès lié à la SEP"],
];

const edss: Calculator = {
  id: "edss",
  label: "EDSS — Sclérose en plaques",
  categorie: "neuro",
  description:
    "Expanded Disability Status Scale : degré d'invalidité de la sclérose en plaques (0–10, pas de 0,5).",
  reference: "Kurtzke JF. Neurology 1983.",
  itemsProgramme: ["Sclérose en plaques"],
  fields: [
    {
      id: "step",
      label: "Score EDSS",
      type: "select",
      default: "0",
      options: EDSS_STEPS.map(([value, label]) => ({ value, label })),
    },
  ],
  compute: (i): CalculatorResult => {
    const step = num(i.step, 0);
    const severity: CalculatorResult["severity"] =
      step < 3 ? "low" : step < 6 ? "medium" : step < 8 ? "high" : "critical";
    return {
      value: `EDSS ${String(step).replace(".", ",")}`,
      label:
        step < 3
          ? "Invalidité minimale"
          : step < 6
            ? "Invalidité modérée (marche sans aide)"
            : step < 8
              ? "Invalidité sévère (aide à la marche nécessaire)"
              : "Invalidité très sévère (dépendance)",
      interpretation: `EDSS ${String(step).replace(".", ",")}/10. L'EDSS repose sur l'examen des 8 systèmes fonctionnels et la capacité de marche ; il conditionne l'éligibilité aux traitements de fond et le suivi de la progression. Réévaluation à chaque poussée et au moins annuelle.`,
      severity,
    };
  },
};

/* ═══════════════════════ 7. Barthel ═══════════════════════ */

const barthel: Calculator = {
  id: "barthel",
  label: "Index de Barthel",
  categorie: "neuro",
  description:
    "Autonomie dans les activités de la vie quotidienne, en particulier après un AVC (0–100).",
  reference: "Mahoney FI, Barthel DW. Md State Med J 1965.",
  itemsProgramme: ["Accident vasculaire cérébral", "Handicap", "Autonomie"],
  fields: [
    {
      id: "alimentation",
      label: "Alimentation",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Indépendant (10)" },
        { value: "5", label: "Besoin d'aide (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "bain",
      label: "Bain / douche",
      type: "select",
      default: "5",
      options: [
        { value: "5", label: "Indépendant (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "toilette",
      label: "Soins personnels (visage, dents, coiffure)",
      type: "select",
      default: "5",
      options: [
        { value: "5", label: "Indépendant (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "habillage",
      label: "Habillage",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Indépendant (10)" },
        { value: "5", label: "Besoin d'aide (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "selles",
      label: "Continence fécale",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Continent (10)" },
        { value: "5", label: "Accident occasionnel (5)" },
        { value: "0", label: "Incontinent (0)" },
      ],
    },
    {
      id: "urines",
      label: "Continence urinaire",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Continent (10)" },
        { value: "5", label: "Accident occasionnel (5)" },
        { value: "0", label: "Incontinent ou sondé (0)" },
      ],
    },
    {
      id: "wc",
      label: "Utilisation des toilettes",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Indépendant (10)" },
        { value: "5", label: "Besoin d'aide (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "transfert",
      label: "Transfert lit ↔ fauteuil",
      type: "select",
      default: "15",
      options: [
        { value: "15", label: "Indépendant (15)" },
        { value: "10", label: "Aide minime (10)" },
        { value: "5", label: "Aide importante, assis (5)" },
        { value: "0", label: "Dépendant (0)" },
      ],
    },
    {
      id: "marche",
      label: "Déambulation",
      type: "select",
      default: "15",
      options: [
        { value: "15", label: "Marche seul > 50 m (15)" },
        { value: "10", label: "Marche avec aide (10)" },
        { value: "5", label: "Autonome au fauteuil roulant (5)" },
        { value: "0", label: "Immobile (0)" },
      ],
    },
    {
      id: "escaliers",
      label: "Escaliers",
      type: "select",
      default: "10",
      options: [
        { value: "10", label: "Monte et descend seul (10)" },
        { value: "5", label: "Besoin d'aide (5)" },
        { value: "0", label: "Incapable (0)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const score = barthel.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    const severity: CalculatorResult["severity"] =
      score >= 100
        ? "low"
        : score >= 60
          ? "low"
          : score >= 40
            ? "medium"
            : score >= 20
              ? "high"
              : "critical";
    const label =
      score === 100
        ? "Indépendant"
        : score >= 60
          ? "Dépendance légère"
          : score >= 40
            ? "Dépendance modérée"
            : score >= 20
              ? "Dépendance sévère"
              : "Dépendance totale";
    return {
      value: `${score}/100`,
      label,
      interpretation:
        score >= 60
          ? "Barthel ≥ 60/100 : autonomie compatible avec un retour à domicile (adapter l'environnement et l'aide à domicile)."
          : score >= 40
            ? "Barthel 40–59 : dépendance modérée — réadaptation intensive et évaluation du lieu de vie."
            : "Barthel < 40 : dépendance sévère — aide humaine quotidienne indispensable, envisager une structure adaptée.",
      severity,
    };
  },
};

/* ═══════════════════════ 8. FOUR score ═══════════════════════ */

const four: Calculator = {
  id: "four-score",
  label: "FOUR score",
  categorie: "neuro",
  description:
    "Full Outline of UnResponsiveness : évaluation du coma sans recours à la réponse verbale (0–16).",
  reference: "Wijdicks EFM et al. Ann Neurol 2005.",
  itemsProgramme: ["Coma", "Mort encéphalique", "Réanimation"],
  fields: [
    scoredField(
      "yeux",
      "Réponse oculaire",
      [
        "Paupières fermées",
        "Ouvre à la douleur",
        "Ouvre à la voix",
        "Yeux ouverts, ne suit pas",
        "Yeux ouverts, suit ou cligne aux ordres",
      ],
      "4",
    ),
    scoredField(
      "motrice",
      "Réponse motrice",
      [
        "Aucune réponse",
        "Réponse d'extension",
        "Réponse de flexion",
        "Localise la douleur",
        "Obéit aux ordres",
      ],
      "4",
    ),
    scoredField(
      "tronc",
      "Réflexes du tronc",
      [
        "Réflexes pupillaire, cornéen et de toux absents",
        "Réflexes pupillaire et cornéen absents",
        "Un seul réflexe pupillaire ou cornéen présent",
        "Pupille unique large et fixe",
        "Réflexes pupillaire et cornéen présents",
      ],
      "4",
    ),
    scoredField(
      "respiration",
      "Respiration",
      [
        "Apnée ou respiration au rythme du ventilateur",
        "Respire au-dessus du ventilateur",
        "Ventilation en mode contrôlé, rythme régulier",
        "Respiration de Cheyne-Stokes, non intubé",
        "Rythme respiratoire régulier, non intubé",
      ],
      "4",
    ),
  ],
  compute: (i): CalculatorResult => {
    const score = four.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    const severity: CalculatorResult["severity"] =
      score >= 13 ? "low" : score >= 9 ? "medium" : score >= 5 ? "high" : "critical";
    return {
      value: `${score}/16`,
      label:
        score >= 13
          ? "Conscience peu ou pas altérée"
          : score >= 9
            ? "Altération modérée de la conscience"
            : score >= 5
              ? "Altération sévère (coma)"
              : "Coma profond / syndrome d'encéphalopathie",
      interpretation:
        score <= 4
          ? "FOUR ≤ 4 : coma profond. Chez un patient non sédaté, rechercher les critères de mort encéphalique (absence de réflexes du tronc, apnée). Le score 0 avec absence de réflexes du tronc et de respiration est évocateur d'une atteinte irréversible."
          : "Le FOUR score, contrairement au Glasgow, ne dépend pas de la réponse verbale (utile en cas d'intubation) et intègre l'évaluation des réflexes du tronc cérébral. Réévaluer régulièrement la tendance.",
      severity,
    };
  },
};

export const NEURO_CALCULATORS: Calculator[] = [
  glasgow,
  abcd2,
  nihss,
  rankin,
  hoehnYahr,
  edss,
  barthel,
  four,
];
