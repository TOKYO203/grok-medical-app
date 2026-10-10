import type { Calculator, CalculatorField, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Psychiatrie — échelles validées d'anxiété, de dépression et d'addictologie
 * (9 scores).
 * Sources : Hamilton 1959 (HAM-A), Hamilton 1960 (HAM-D), Beck 1961 (BDI),
 * Zigmond & Snaith 1983 (HAD), Cohen 1983 (PSS), Cox 1987 (EPDS),
 * Ewing 1984 / Rueff 1996 (CAGE-DETA), Sullivan 1989 (CIWA-Ar), Morgan 1999 (SCOFF).
 */

/** Champ de sévérité 0→max. */
function severityField(id: string, label: string, max: number, help: string): CalculatorField {
  return { id, label, type: "number", min: 0, max, default: 0, help };
}

/** Champ à choix : `anchors` listés du moindre au plus marqué, valeurs recalculées. */
function choseField(
  id: string,
  label: string,
  anchors: string[],
  reverse = false,
): CalculatorField {
  const values = anchors.map((_, index) => (reverse ? anchors.length - 1 - index : index));
  const winIndex = reverse ? anchors.length - 1 : 0;
  return {
    id,
    label,
    type: "select",
    default: String(values[winIndex]),
    options: anchors.map((text, index) => ({
      value: String(values[index]),
      label: `${text} (${values[index]})`,
    })),
  };
}

/* ═══════════════ 1. Hamilton Anxiété (HAM-A) ═══════════════ */

const HAMA_ITEMS: [string, string][] = [
  ["humeur", "Humeur anxieuse"],
  ["tension", "Tension (sensation de tension, fatigabilité, sursauts)"],
  ["peurs", "Peurs"],
  ["insomnie", "Insomnie"],
  ["cognitif", "Troubles intellectuels (difficultés de concentration, mémoire)"],
  ["depressif", "Humeur dépressive"],
  ["somMusculaire", "Symptômes somatiques généraux (musculaires)"],
  ["somSensoriel", "Symptômes somatiques sensoriels (acouphènes, vision floue)"],
  ["cardio", "Symptômes cardiovasculaires (tachycardie, palpitations)"],
  ["respiratoire", "Symptômes respiratoires (oppression, dyspnée)"],
  ["gastro", "Symptômes gastro-intestinaux"],
  ["genitoUrinaire", "Symptômes génito-urinaires"],
  ["vegetatif", "Symptômes neuro-végétatifs (bouche sèche, sueurs, pâleur)"],
  ["comportement", "Comportement lors de l'entretien"],
];

const hamA: Calculator = {
  id: "ham-a",
  label: "Hamilton — Anxiété (HAM-A)",
  categorie: "psychiatrie",
  description:
    "Échelle d'évaluation de l'anxiété en 14 items cotés de 0 à 4 (évaluation hétéro-passée par le clinicien).",
  reference: "Hamilton M. Br J Med Psychol 1959.",
  itemsProgramme: ["Troubles anxieux", "Anxiété généralisée"],
  fields: HAMA_ITEMS.map(([id, label]) =>
    severityField(id, label, 4, "0 = absent · 1 = léger · 2 = moyen · 3 = fort · 4 = très fort"),
  ),
  compute: (i): CalculatorResult => {
    const score = HAMA_ITEMS.reduce((sum, [id]) => sum + Math.min(4, Math.max(0, num(i[id]))), 0);
    const severity: CalculatorResult["severity"] =
      score < 17 ? "low" : score < 25 ? "medium" : score < 31 ? "high" : "critical";
    const label =
      score < 17
        ? "Anxiété absente ou minime"
        : score < 25
          ? "Anxiété légère à modérée"
          : score < 31
            ? "Anxiété modérée à sévère"
            : "Anxiété sévère";
    return {
      value: `${score}/56`,
      label,
      interpretation:
        score < 17
          ? "HAM-A < 17 : anxiété peu significative — pas de traitement anxiolytique systématique."
          : "HAM-A ≥ 17 : anxiété d'intensité significative — psychothérapie (TCC) en 1ʳᵉ intention et/ou traitement médicamenteux (ISRS) selon le retentissement, avec réévaluation régulière.",
      severity,
    };
  },
};

/* ═══════════════ 2. Hamilton Dépression (HAM-D) ═══════════════ */

const HAMD_ITEMS: [string, string, number][] = [
  ["humeur", "Humeur dépressive", 4],
  ["culpabilite", "Sentiment de culpabilité", 4],
  ["suicide", "Idées suicidaires", 4],
  ["insomnieDebut", "Insomnie du début de nuit", 2],
  ["insomnieMilieu", "Insomnie du milieu de nuit", 2],
  ["insomnieMatin", "Insomnie du matin", 2],
  ["travail", "Travail et activités", 4],
  ["ralentissement", "Ralentissement (psychomoteur)", 4],
  ["agitation", "Agitation", 4],
  ["anxietePsy", "Anxiété psychique", 4],
  ["anxieteSom", "Anxiété somatique", 4],
  ["somGastro", "Symptômes somatiques gastro-intestinaux", 2],
  ["somGeneraux", "Symptômes somatiques généraux", 2],
  ["genitaux", "Symptômes génitaux", 2],
  ["hypochondrie", "Hypochondrie", 4],
  ["poids", "Perte de poids", 2],
  ["insight", "Prise de conscience (insight)", 2],
];

const hamD: Calculator = {
  id: "ham-d",
  label: "Hamilton — Dépression (HAM-D)",
  categorie: "psychiatrie",
  description:
    "Échelle d'évaluation de la dépression en 17 items (cotation hétéro-passée par le clinicien, 0–52).",
  reference: "Hamilton M. J Neurol Neurosurg Psychiatry 1960.",
  itemsProgramme: ["Trouble dépressif", "Dépression"],
  fields: HAMD_ITEMS.map(([id, label, max]) =>
    severityField(
      id,
      label,
      max,
      max === 4
        ? "0 = absent · 1 = léger · 2 = moyen · 3 = fort · 4 = très fort"
        : "0 = absent · 1 = léger/moyen · 2 = sévère",
    ),
  ),
  compute: (i): CalculatorResult => {
    const score = HAMD_ITEMS.reduce(
      (sum, [id, , max]) => sum + Math.min(max, Math.max(0, num(i[id]))),
      0,
    );
    const severity: CalculatorResult["severity"] =
      score <= 7 ? "low" : score <= 13 ? "medium" : score <= 22 ? "high" : "critical";
    const label =
      score <= 7
        ? "Pas de dépression significative"
        : score <= 13
          ? "Dépression légère"
          : score <= 18
            ? "Dépression modérée"
            : score <= 22
              ? "Dépression sévère"
              : "Dépression très sévère";
    const suicidal = num(i.suicide) >= 3;
    return {
      value: `${score}/52`,
      label,
      interpretation: `${score > 7 ? "HAM-D > 7 : symptomatologie dépressive — envisager une prise en charge (psychothérapie, ISRS) et réévaluer régulièrement." : "HAM-D ≤ 7 : pas de syndrome dépressif caractérisé."} Un score ≥ 23 traduit une dépression très sévère nécessitant une prise en charge spécialisée.${suicidal ? " ⚠️ Item « idées suicidaires » élevé : évaluer le risque suicidaire et organiser une surveillance immédiate." : ""}`,
      severity,
    };
  },
};

/* ═══════════════════════ 3. BDI-13 ═══════════════════════ */

const BDI_ITEMS: [string, string][] = [
  ["tristesse", "Tristesse"],
  ["pessimisme", "Pessimisme / découragement"],
  ["echec", "Sentiment d'échec"],
  ["insatisfaction", "Perte de plaisir / insatisfaction"],
  ["culpabilite", "Sentiment de culpabilité"],
  ["punition", "Sentiment d'être puni"],
  ["autoDevalorisation", "Déception envers soi-même"],
  ["autoAccusation", "Auto-accusation"],
  ["suicide", "Idées suicidaires"],
  ["pleurs", "Pleurs"],
  ["irritabilite", "Irritabilité / agitation"],
  ["retraitSocial", "Retrait social, perte d'intérêt pour autrui"],
  ["indecision", "Indécision"],
];

const bdi13: Calculator = {
  id: "bdi-13",
  label: "BDI-13 — Dépression",
  categorie: "psychiatrie",
  description:
    "Beck Depression Inventory (forme courte à 13 items, auto-questionnaire 0–3 chacun, 0–39).",
  reference: "Beck AT et al. Arch Gen Psychiatry 1961 ; Beck AT, Beck RW. Postgrad Med 1972.",
  itemsProgramme: ["Trouble dépressif", "Dépression"],
  fields: BDI_ITEMS.map(([id, label]) =>
    severityField(id, label, 3, "0 = absent · 1 = léger · 2 = modéré · 3 = sévère"),
  ),
  compute: (i): CalculatorResult => {
    const score = BDI_ITEMS.reduce((sum, [id]) => sum + Math.min(3, Math.max(0, num(i[id]))), 0);
    const severity: CalculatorResult["severity"] =
      score <= 4 ? "low" : score <= 7 ? "medium" : score <= 15 ? "high" : "critical";
    const label =
      score <= 4
        ? "État thymique normal"
        : score <= 7
          ? "Dépression légère"
          : score <= 15
            ? "Dépression modérée"
            : "Dépression sévère";
    const suicidal = num(i.suicide) >= 2;
    return {
      value: `${score}/39`,
      label,
      interpretation: `${score <= 4 ? "BDI ≤ 4 : état thymique normal." : "BDI > 4 : symptomatologie dépressive à confirmer par l'entretien clinique — proposer une évaluation et un suivi (TCC, ISRS selon l'intensité)."}${suicidal ? " ⚠️ Item suicidaire élevé : évaluer le risque suicidaire de façon structurée." : ""}`,
      severity,
    };
  },
};

/* ═══════════════ 4. HAD (Hospital Anxiety and Depression) ═══════════════ */

const HAD_ITEMS: [string, string, boolean][] = [
  ["a1", "Je me sens tendu(e) ou énervé(e)", false],
  ["d1", "Je prends plaisir aux mêmes choses qu'autrefois", true],
  ["a2", "J'ai une sensation de peur, comme si quelque chose de terrible allait arriver", false],
  ["d2", "Je ris facilement et vois le bon côté des choses", true],
  ["a3", "Je me fais du souci", false],
  ["d3", "Je me sens de bonne humeur", true],
  ["a4", "Je peux rester tranquillement assis(e) et me sentir décontracté(e)", true],
  ["d4", "Je me sens ralenti(e) (je vais moins vite)", false],
  ["a5", "J'éprouve une sensation de peur, comme une boule dans l'estomac", false],
  ["d5", "Je ne m'intéresse plus à mon apparence physique", false],
  ["a6", "Je me sens agité(e), comme s'il fallait que je bouge", false],
  ["d6", "J'attends l'avenir avec plaisir", true],
  ["a7", "J'ai des sensations brutales de panique", false],
  ["d7", "Je peux profiter d'un bon livre, d'une émission de radio ou de télévision", true],
];

const had: Calculator = {
  id: "had",
  label: "HAD — Anxiété & Dépression",
  categorie: "psychiatrie",
  description:
    "Hospital Anxiety and Depression Scale : 14 items (7 anxiété + 7 dépression), chacun 0–3 ; deux sous-scores de 0 à 21.",
  reference: "Zigmond AS, Snaith RP. Acta Psychiatr Scand 1983.",
  itemsProgramme: ["Trouble anxieux", "Trouble dépressif"],
  fields: HAD_ITEMS.map(([id, label, reverse]) =>
    choseField(
      id,
      label,
      ["Jamais / très peu", "Parfois / un peu", "Souvent / assez", "Presque toujours / beaucoup"],
      reverse,
    ),
  ),
  compute: (i): CalculatorResult => {
    const anxiety = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].reduce(
      (sum, id) => sum + num(i[id]),
      0,
    );
    const depression = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"].reduce(
      (sum, id) => sum + num(i[id]),
      0,
    );
    const worst = Math.max(anxiety, depression);
    const severity: CalculatorResult["severity"] =
      worst <= 7 ? "low" : worst <= 10 ? "medium" : "high";
    const qualifier = (v: number) =>
      v <= 7 ? "dans la norme" : v <= 10 ? "douteux" : "symptomatique";
    return {
      value: `A ${anxiety}/21 · D ${depression}/21`,
      label: `Anxiété : ${qualifier(anxiety)} · Dépression : ${qualifier(depression)}`,
      interpretation: `HAD-A ${anxiety}/21 et HAD-D ${depression}/21. Un sous-score ≥ 11 est en faveur d'un trouble anxieux ou dépressif avéré ; entre 8 et 10, le résultat est douteux et doit être complété par un entretien clinique.`,
      severity,
    };
  },
};

/* ═══════════════════════ 5. PSS-10 ═══════════════════════ */

const PSS_ITEMS: [string, string, boolean][] = [
  ["q1", "Contrarié(e) par un événement inattendu", false],
  ["q2", "Sentiment de ne pas pouvoir contrôler les choses importantes de sa vie", false],
  ["q3", "Sentiment d'être nerveux(se) et stressé(e)", false],
  ["q4", "Sentiment de confiance dans sa capacité à gérer ses problèmes", true],
  ["q5", "Sentiment que les choses allaient comme on le voulait", true],
  ["q6", "Sentiment de ne pas pouvoir faire face à tout", false],
  ["q7", "Capacité à contrôler les irritations de la vie quotidienne", true],
  ["q8", "Sentiment de maîtriser la situation", true],
  ["q9", "Colère à cause d'éléments hors de son contrôle", false],
  ["q10", "Sentiment que les difficultés s'accumulaient", false],
];

const pss: Calculator = {
  id: "pss-10",
  label: "PSS-10 — Stress perçu",
  categorie: "psychiatrie",
  description:
    "Perceived Stress Scale (10 items) : niveau de stress perçu au cours du dernier mois (0–40).",
  reference: "Cohen S, Kamarck T, Mermelstein R. J Health Soc Behav 1983.",
  itemsProgramme: ["Stress", "Psychologie médicale"],
  fields: PSS_ITEMS.map(([id, label, reverse]) =>
    choseField(
      id,
      label,
      ["Jamais", "Presque jamais", "Parfois", "Assez souvent", "Très souvent"],
      reverse,
    ),
  ),
  compute: (i): CalculatorResult => {
    const score = PSS_ITEMS.reduce((sum, [id]) => sum + num(i[id]), 0);
    const severity: CalculatorResult["severity"] =
      score <= 13 ? "low" : score <= 26 ? "medium" : "high";
    const label =
      score <= 13
        ? "Stress perçu faible"
        : score <= 26
          ? "Stress perçu modéré"
          : "Stress perçu élevé";
    return {
      value: `${score}/40`,
      label,
      interpretation:
        score <= 13
          ? "PSS 0–13 : faible niveau de stress perçu — pas de risque psychopathologique particulier lié au stress."
          : score <= 26
            ? "PSS 14–26 : stress perçu modéré — proposer des stratégies de gestion du stress (relaxation, activité physique, soutien)."
            : "PSS 27–40 : stress perçu élevé — évaluation psychologique, dépistage de l'anxiété/dépression et prise en charge adaptée.",
      severity,
    };
  },
};

/* ═══════════════ 6. Edinburgh Postnatal (EPDS) ═══════════════ */

const EPDS_ITEMS: [string, string, boolean][] = [
  ["q1", "J'ai pu rire et voir le bon côté des choses", true],
  ["q2", "J'ai attendu avec plaisir les choses", true],
  ["q3", "Je me suis blâmée sans raison lorsque les choses allaient mal", false],
  ["q4", "Je me suis sentie anxieuse ou nerveuse sans raison", false],
  ["q5", "Je me suis sentie effrayée ou paniquée sans raison", false],
  ["q6", "Les choses m'ont submergée", false],
  ["q7", "Je me suis sentie si malheureuse que j'ai eu du mal à dormir", false],
  ["q8", "Je me suis sentie triste et malheureuse", false],
  ["q9", "Je me suis sentie si malheureuse que je pleurais", false],
  ["q10", "L'idée de me faire du mal m'est venue", false],
];

const epds: Calculator = {
  id: "epds-edinburgh",
  label: "EPDS — Dépression post-natale",
  categorie: "psychiatrie",
  description:
    "Edinburgh Postnatal Depression Scale : dépistage de la dépression du post-partum (10 items, 0–30).",
  reference: "Cox JL, Holden JM, Sagovsky R. Br J Psychiatry 1987.",
  itemsProgramme: ["Dépression du post-partum", "Grossesse et post-partum"],
  fields: EPDS_ITEMS.map(([id, label, reverse]) =>
    choseField(
      id,
      label,
      ["Non, pas du tout", "Pas très souvent", "Oui, assez souvent", "Oui, la plupart du temps"],
      reverse,
    ),
  ),
  compute: (i): CalculatorResult => {
    const score = EPDS_ITEMS.reduce((sum, [id]) => sum + num(i[id]), 0);
    const selfHarm = num(i.q10) > 0;
    const severity: CalculatorResult["severity"] =
      score <= 9 ? "low" : score <= 12 ? "medium" : "high";
    const label =
      score <= 9
        ? "Pas de dépression du post-partum détectée"
        : score <= 12
          ? "Dépression probable"
          : "Dépression du post-partum probable (score élevé)";
    return {
      value: `${score}/30`,
      label,
      interpretation: `EPDS ≥ 10 : en faveur d'une dépression du post-partum — entretien clinique approfondi, soutien et prise en charge (psychothérapie, ISRS compatibles avec l'allaitement si indiqué). EPDS ≥ 13 : dépression probable nécessitant une évaluation spécialisée.${selfHarm ? " ⚠️ L'item 10 (idée de se faire du mal) est positif : évaluer immédiatement le risque suicidaire et l'accès aux soins, la sécurité du bébé et de la mère." : ""}`,
      severity,
    };
  },
};

/* ═══════════════ 7. CAGE-DETA (alcool) ═══════════════ */

const cageDeta: Calculator = {
  id: "cage-deta",
  label: "CAGE-DETA — Alcool",
  categorie: "psychiatrie",
  description: "Dépistage du mésusage d'alcool (4 questions binaires, version française « DETA »).",
  reference: "Ewing JA. JAMA 1984 (CAGE) ; adaptation française DETA (Rueff B, 1996).",
  itemsProgramme: ["Mésusage d'alcool", "Addictologie"],
  fields: [
    {
      id: "diminuer",
      label: "D — Avez-vous déjà ressenti le besoin de diminuer votre consommation d'alcool ?",
      type: "boolean",
      default: false,
    },
    {
      id: "entourage",
      label:
        "E — Votre entourage vous a-t-il déjà fait des remarques au sujet de votre consommation ?",
      type: "boolean",
      default: false,
    },
    {
      id: "trop",
      label: "T — Avez-vous déjà eu l'impression que vous buviez trop ?",
      type: "boolean",
      default: false,
    },
    {
      id: "alcoolMatin",
      label: "A — Avez-vous déjà eu besoin d'alcool dès le matin pour vous sentir en forme ?",
      type: "boolean",
      default: false,
    },
  ],
  compute: (i): CalculatorResult => {
    const score = [bool(i.diminuer), bool(i.entourage), bool(i.trop), bool(i.alcoolMatin)].filter(
      Boolean,
    ).length;
    const positive = score >= 2;
    return {
      value: `${score}/4`,
      label: positive ? "Dépistage positif (≥ 2 oui)" : "Dépistage négatif (< 2 oui)",
      interpretation: positive
        ? "CAGE-DETA ≥ 2 : forte probabilité de trouble de l'usage de l'alcool — mener un entretien structuré, quantifier la consommation (AUDIT), rechercher des complications et proposer une prise en charge."
        : "CAGE-DETA < 2 : pas de repérage d'un mésusage, mais la sensibilité est limitée chez le sujet jeune et aux consommations modérées — compléter par un autre outil (AUDIT) si suspicion clinique.",
      severity: positive ? "high" : "low",
    };
  },
};

/* ═══════════════ 8. CIWA-Ar (sevrage alcoolique) ═══════════════ */

const CIWA_ITEMS: [string, string, number][] = [
  ["nausees", "Nausées / vomissements", 7],
  ["tremblements", "Tremblements", 7],
  ["sueurs", "Sueurs paroxystiques", 7],
  ["anxiete", "Anxiété", 7],
  ["agitation", "Agitation", 7],
  ["tactiles", "Perturbations tactiles", 7],
  ["auditives", "Perturbations auditives", 7],
  ["visuelles", "Perturbations visuelles", 7],
  ["cephalees", "Céphalées", 7],
  ["orientation", "Orientation / confusion (0–4)", 4],
];

const ciwaAr: Calculator = {
  id: "ciwa-ar",
  label: "CIWA-Ar — Sevrage alcoolique",
  categorie: "psychiatrie",
  description:
    "Clinical Institute Withdrawal Assessment for Alcohol, revised : gravité du sevrage alcoolique (10 items, 0–67).",
  reference: "Sullivan JT et al. Br J Addict 1989.",
  itemsProgramme: ["Sevrage alcoolique", "Addictologie"],
  fields: CIWA_ITEMS.map(([id, label, max]) =>
    severityField(
      id,
      label,
      max,
      max === 7 ? "0 = absent · 7 = très sévère" : "0 = orienté · 4 = confus",
    ),
  ),
  compute: (i): CalculatorResult => {
    const score = CIWA_ITEMS.reduce(
      (sum, [id, , max]) => sum + Math.min(max, Math.max(0, num(i[id]))),
      0,
    );
    const severity: CalculatorResult["severity"] =
      score <= 8 ? "low" : score <= 15 ? "medium" : score <= 25 ? "high" : "critical";
    const label =
      score <= 8
        ? "Sevrage léger (surveillance)"
        : score <= 15
          ? "Sevrage modéré (traitement symptomatique)"
          : "Sevrage sévère (traitement médicamenteux)";
    return {
      value: `${score}/67`,
      label,
      interpretation:
        score <= 8
          ? "CIWA-Ar ≤ 8 : sevrage léger — surveillance clinique, hydratation, vitamine B1 (thiamine) et réévaluations régulières (toutes les 4 à 8 h)."
          : score <= 15
            ? "CIWA-Ar 9–15 : sevrage modéré — traitement symptomatique à la demande guidé par le score (benzodiazépines), thiamine, surveillance rapprochée et prévention du delirium."
            : "CIWA-Ar > 15 : sevrage sévère — benzodiazépines en protocole (titration), surveillance en unité adaptée, référer rapidement en cas de delirium tremens (confusion, hallucinations, hyperthermie, convulsions).",
      severity,
    };
  },
};

/* ═══════════════ 9. SCOFF (troubles du comportement alimentaire) ═══════════════ */

const scoff: Calculator = {
  id: "scoff",
  label: "SCOFF — TCA",
  categorie: "psychiatrie",
  description:
    "Dépistage des troubles du comportement alimentaire (5 questions binaires ; ≥ 2 oui = suspicion).",
  reference: "Morgan JF, Reid F, Lacey JH. BMJ 1999 (SCOFF questionnaire).",
  itemsProgramme: ["Troubles du comportement alimentaire", "Anorexie", "Boulimie"],
  fields: [
    {
      id: "sick",
      label: "S — Vous faites-vous vomir lorsque vous vous sentez trop rassasié(e) ?",
      type: "boolean",
      default: false,
    },
    {
      id: "control",
      label: "C — Craignez-vous de perdre le contrôle de votre alimentation ?",
      type: "boolean",
      default: false,
    },
    {
      id: "oneStone",
      label: "O — Avez-vous perdu récemment plus de 6 kg en 3 mois ?",
      type: "boolean",
      default: false,
    },
    {
      id: "fat",
      label: "F — Vous trouvez-vous gros(se) alors que les autres vous trouvent mince ?",
      type: "boolean",
      default: false,
    },
    {
      id: "food",
      label: "F — La nourriture domine-t-elle votre vie ?",
      type: "boolean",
      default: false,
    },
  ],
  compute: (i): CalculatorResult => {
    const score = [
      bool(i.sick),
      bool(i.control),
      bool(i.oneStone),
      bool(i.fat),
      bool(i.food),
    ].filter(Boolean).length;
    const positive = score >= 2;
    return {
      value: `${score}/5`,
      label: positive ? "Dépistage positif (≥ 2 oui)" : "Dépistage négatif",
      interpretation: positive
        ? "SCOFF ≥ 2 : suspicion de trouble du comportement alimentaire — entretien diagnostique approfondi, évaluation somatique (poids, IMC, ionogramme, ECG) et orientation spécialisée."
        : "SCOFF < 2 : pas de repérage d'un trouble du comportement alimentaire — poursuivre l'évaluation clinique si la situation le justifie.",
      severity: positive ? "high" : "low",
    };
  },
};

export const PSYCHIATRIE_CALCULATORS: Calculator[] = [
  hamA,
  hamD,
  bdi13,
  had,
  pss,
  epds,
  cageDeta,
  ciwaAr,
  scoff,
];
