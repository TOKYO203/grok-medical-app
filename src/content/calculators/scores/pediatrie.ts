import type { Calculator, CalculatorField, CalculatorResult } from "../types";
import { bool, num, str } from "../utils";

/**
 * Pédiatrie — détresse respiratoire, gravité du nouveau-né et du nourrisson,
 * croissance et ictère néonatal (10 scores).
 * Sources : Apgar 1953, Silverman & Andersen 1956, Blantyre 1995 (Taylor 2009),
 * Wang 1992, Wood-Downes-Ferrés 1972, Chalut 2000 (PRAM), Guarino 2014 (ESPGHAN),
 * Tanner (taille cible), AAP 2022 (rapport bilirubine/albumine).
 */

/** Champ coté en points : le libellé décrit l'option, la valeur = points. */
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

/* ═══════════════════════ 1. Apgar ═══════════════════════ */

const apgar: Calculator = {
  id: "apgar",
  label: "Apgar",
  categorie: "pediatrie",
  description:
    "Évaluation de l'adaptation à la vie extra-utérine du nouveau-né (5 items cotés 0–2), réalisée à 1, 5 et 10 minutes.",
  reference: "Apgar V. Curr Res Anesth Analg 1953.",
  itemsProgramme: ["Nouveau-né", "Réanimation néonatale"],
  fields: [
    scoredField(
      "couleur",
      "Apparence (couleur)",
      ["Bleu / pâle généralisé", "Corps rose, extrémités bleues", "Rose partout"],
      "2",
    ),
    scoredField("fc", "Pouls (fréquence cardiaque)", ["Absent", "< 100/min", "≥ 100/min"], "2"),
    scoredField(
      "reflexe",
      "Grimace (réflexes)",
      ["Aucune réaction", "Grimace / moue", "Cri, toux, éternuement"],
      "2",
    ),
    scoredField(
      "tonus",
      "Activité (tonus musculaire)",
      ["Flasque", "Flexion légère des membres", "Mouvements actifs"],
      "2",
    ),
    scoredField(
      "respiration",
      "Respiration",
      ["Absente", "Faible, irrégulière", "Bonne, cri vigoureux"],
      "2",
    ),
  ],
  compute: (i): CalculatorResult => {
    const score = apgar.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    let severity: CalculatorResult["severity"];
    let label: string;
    let interpretation: string;
    if (score >= 7) {
      severity = "low";
      label = "Bonne adaptation";
      interpretation =
        "Apgar 7–10 : adaptation normale. Poursuivre les soins de routine et la surveillance clinique.";
    } else if (score >= 4) {
      severity = "high";
      label = "Dépression modérée";
      interpretation =
        "Apgar 4–6 : dépression modérée — aspiration, stimulation, oxygénation et surveillance rapprochée ; réévaluer à 5 et 10 minutes.";
    } else {
      severity = "critical";
      label = "Dépression sévère";
      interpretation =
        "Apgar 0–3 : dépression sévère — réanimation néonatale immédiate (ventilation au masque puis intubation), réévaluer à 5 et 10 minutes. Un Apgar < 5 à 10 min est un marqueur de risque neurologique.";
    }
    return { value: `${score}/10`, label, interpretation, severity };
  },
};

/* ═══════════════ 2. Silverman-Andersen ═══════════════ */

const silverman: Calculator = {
  id: "silverman-andersen",
  label: "Silverman-Andersen",
  categorie: "pediatrie",
  description:
    "Quantification de la détresse respiratoire du nouveau-né prématuré (5 signes cotés 0–2).",
  reference: "Silverman WA, Andersen DH. Pediatrics 1956.",
  itemsProgramme: ["Détresse respiratoire néonatale", "Prématurité"],
  fields: [
    scoredField("thorax", "Mouvements thoraco-abdominaux", [
      "Synchrones",
      "Retard léger du thorax",
      "Balancement (voir-scie)",
    ]),
    scoredField("intercostal", "Tirage intercostal", ["Absent", "Léger", "Marqué"]),
    scoredField("xiphoid", "Tirage xiphoïdien (sous-sternal)", ["Absent", "Léger", "Marqué"]),
    scoredField("nez", "Battement des ailes du nez", ["Absent", "Minime", "Marqué"]),
    scoredField("geignement", "Geignement expiratoire", [
      "Absent",
      "Audible au stéthoscope",
      "Audible à l'oreille",
    ]),
  ],
  compute: (i): CalculatorResult => {
    const score = silverman.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 5 ? "medium" : score <= 7 ? "high" : "critical";
    return {
      value: `${score}/10`,
      label:
        score <= 3 ? "Détresse respiratoire absente ou minime" : "Détresse respiratoire présente",
      interpretation:
        score <= 3
          ? "Score 0–3 : pas de détresse significative — surveillance clinique simple."
          : score <= 5
            ? "Score 4–5 : détresse modérée — oxygénothérapie et surveillance rapprochée, recherche étiologique (TTN, maladie des membranes hyalines)."
            : "Score ≥ 6 : détresse sévère — assistance respiratoire (CPAP ou ventilation) et prise en charge en néonatologie.",
      severity,
    };
  },
};

/* ═══════════════════════ 3. Blantyre ═══════════════════════ */

const blantyre: Calculator = {
  id: "blantyre",
  label: "Blantyre — Coma de l'enfant",
  categorie: "pediatrie",
  description:
    "Score de coma du jeune enfant (dérivé du Glasgow), utilisé notamment dans le neuropaludisme.",
  reference: "Molyneux ME et al. Q J Med 1989 ; Taylor TE, Trans R Soc Trop Med Hyg 2009.",
  itemsProgramme: ["Paludisme grave", "Coma", "Neuropaludisme"],
  fields: [
    scoredField(
      "motrice",
      "Meilleure réponse motrice",
      [
        "Réponse non spécifique ou absente",
        "Retrait du membre à la douleur",
        "Localise le stimulus douloureux",
      ],
      "2",
    ),
    scoredField(
      "verbale",
      "Meilleure réponse verbale",
      ["Aucune", "Gémissements ou pleurs inappropriés", "Pleurs appropriés ou parle"],
      "2",
    ),
    scoredField(
      "yeux",
      "Mouvement des yeux",
      ["Ne suit pas du regard", "Regarde ou suit du regard"],
      "1",
    ),
  ],
  compute: (i): CalculatorResult => {
    const motrice = num(i.motrice);
    const verbale = num(i.verbale);
    const yeux = num(i.yeux);
    const score = motrice + verbale + yeux;

    const coma = score <= 2 || (score === 3 && motrice === 0);
    const severity: CalculatorResult["severity"] =
      score <= 2 ? "critical" : score <= 3 ? "high" : score <= 4 ? "medium" : "low";
    return {
      value: `${score}/5`,
      label: coma
        ? "Coma (paludisme cérébral)"
        : score === 5
          ? "Conscience normale"
          : "Conscience altérée",
      interpretation: coma
        ? "Blantyre ≤ 2 (ou ≤ 3 sans localisation de la douleur) : coma — traiter comme un neuropaludisme grave : artésunate IV, glycémie, anticonvulsivants si convulsions, recherche de causes associées (méningite, hypoglycémie)."
        : "Blantyre 3–5 : conscience altérée mais non comateuse — surveillance neurologique rapprochée et recherche de la cause.",
      severity,
    };
  },
};

/* ═══════════════════════ 4. Wang (bronchiolite) ═══════════════════════ */

const wang: Calculator = {
  id: "wang",
  label: "Wang — Bronchiolite",
  categorie: "pediatrie",
  description: "Sévérité clinique de la bronchiolite aiguë du nourrisson (4 items cotés 0–3).",
  reference: "Wang EEL et al. Am Rev Respir Dis 1992.",
  itemsProgramme: ["Bronchiolite", "Détresse respiratoire"],
  fields: [
    scoredField("fr", "Fréquence respiratoire", ["< 30/min", "31–45/min", "46–60/min", "> 60/min"]),
    scoredField("wheezing", "Sibilants (wheezing)", [
      "Aucun",
      "Fin d'expiration ou à l'auscultation",
      "Toute l'expiration ou audible sans stéthoscope",
      "Inspiratoire et expiratoire, sans stéthoscope",
    ]),
    scoredField("tirage", "Tirage", [
      "Aucun",
      "Intercostal seulement",
      "Sus-sternal ou xiphoïdien",
      "Sévère avec battement des ailes du nez",
    ]),
    {
      id: "etatGeneral",
      label: "État général",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Normal (0)" },
        { value: "3", label: "Irritable, léthargique, difficultés alimentaires (3)" },
      ],
    },
  ],
  compute: (i): CalculatorResult => {
    const score = num(i.fr) + num(i.wheezing) + num(i.tirage) + num(i.etatGeneral);
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 7 ? "medium" : "critical";
    const label =
      score <= 3
        ? "Bronchiolite sans critère de gravité"
        : score <= 7
          ? "Bronchiolite de gravité modérée"
          : "Bronchiolite sévère";
    const interpretation =
      score <= 3
        ? "Score 0–3 : prise en charge ambulatoire possible (désobstruction rhinopharyngée, fractionnement des repas, surveillance des signes d'alerte)."
        : score <= 7
          ? "Score 4–7 : gravité modérée — évaluer l'hospitalisation, oxygénothérapie si SpO₂ < 90–92 %, surveillance rapprochée."
          : "Score 8–12 : bronchiolite sévère — hospitalisation, oxygénothérapie, hydratation, assistance respiratoire à envisager.";
    return { value: `${score}/12`, label, interpretation, severity };
  },
};

/* ═══════════════ 5. Wood-Downes-Ferrés ═══════════════ */

const woodDownes: Calculator = {
  id: "wood-downes-ferres",
  label: "Wood-Downes-Ferrés",
  categorie: "pediatrie",
  description: "Sévérité de la crise d'asthme / bronchiolite de l'enfant (6 items, score 0–14).",
  reference:
    "Wood DW, Downes JJ, Leeks HI. Am J Dis Child 1972 ; modification de Ferrés (bronchiolite).",
  itemsProgramme: ["Asthme aigu grave", "Bronchiolite", "Crise d'asthme"],
  fields: [
    scoredField("sibilants", "Sibilants", [
      "Aucun",
      "Fin de l'expiration",
      "Toute l'expiration",
      "Inspiration et expiration",
    ]),
    scoredField("tirage", "Tirage", [
      "Aucun",
      "Sous-costal / intercostal",
      "+ sus-claviculaire et battement des ailes du nez",
      "+ sus-sternal",
    ]),
    scoredField("fr", "Fréquence respiratoire", ["< 30/min", "31–45/min", "46–60/min", "> 60/min"]),
    scoredField("fc", "Fréquence cardiaque", ["< 120/min", "≥ 120/min"]),
    scoredField("airEntry", "Entrée d'air", [
      "Bonne",
      "Moyenne",
      "Très diminuée",
      "Thorax silencieux, sibilants absents",
    ]),
    scoredField("cyanose", "Cyanose", ["Absente", "Présente"]),
  ],
  compute: (i): CalculatorResult => {
    const score =
      num(i.sibilants) + num(i.tirage) + num(i.fr) + num(i.fc) + num(i.airEntry) + num(i.cyanose);
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 7 ? "high" : "critical";
    const label = score <= 3 ? "Crise légère" : score <= 7 ? "Crise modérée" : "Crise grave";
    const interpretation =
      score <= 3
        ? "Score 0–3 : crise légère — β2-mimétiques inhalés à la demande, surveillance à domicile et plan d'action écrit."
        : score <= 7
          ? "Score 4–7 : crise modérée — β2-mimétiques répétés, corticothérapie systémique, surveillance hospitalière souvent nécessaire."
          : "Score ≥ 8 : crise grave (asthme aigu grave) — oxygénothérapie, β2-mimétiques et corticoïdes IV, anticholinergiques, transfert en soins intensifs. Attention : un thorax silencieux est un signe de gravité extrême.";
    return { value: `${score}/14`, label, interpretation, severity };
  },
};

/* ═══════════════════════ 6. PRAM ═══════════════════════ */

const pram: Calculator = {
  id: "pram",
  label: "PRAM — Asthme de l'enfant",
  categorie: "pediatrie",
  description:
    "Pediatric Respiratory Assessment Measure : sévérité de la crise d'asthme de l'enfant (1 à 17 ans).",
  reference: "Chalut DS et al. J Pediatr 2000 ; Ducharme FM et al. J Pediatr 2008.",
  itemsProgramme: ["Asthme aigu grave", "Crise d'asthme"],
  fields: [
    scoredField("spo2", "Saturation en O₂", ["≥ 95 %", "92–94 %", "< 92 %"]),
    {
      id: "susSternal",
      label: "Tirage sus-sternal",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Absent (0)" },
        { value: "2", label: "Présent (2)" },
      ],
    },
    {
      id: "scalenes",
      label: "Contraction des muscles scalènes",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "Absente (0)" },
        { value: "2", label: "Présente (2)" },
      ],
    },
    scoredField("murmure", "Murmure vésiculaire", [
      "Normal",
      "Diminué à la base",
      "Diminué à l'apex et à la base",
      "Minimal ou absent",
    ]),
    scoredField("sibilances", "Sibilances", [
      "Absentes",
      "Expiratoires seulement",
      "Inspiratoires (± expiratoires)",
      "Audibles sans stéthoscope ou absentes (MV minimal)",
    ]),
  ],
  compute: (i): CalculatorResult => {
    const score =
      num(i.spo2) + num(i.susSternal) + num(i.scalenes) + num(i.murmure) + num(i.sibilances);
    const severity: CalculatorResult["severity"] =
      score <= 3 ? "low" : score <= 7 ? "high" : "critical";
    const label = score <= 3 ? "Crise légère" : score <= 7 ? "Crise modérée" : "Crise sévère";
    const interpretation =
      score <= 3
        ? "PRAM 0–3 : crise légère — β2-mimétiques inhalés, retour à domicile possible avec réévaluation."
        : score <= 7
          ? "PRAM 4–7 : crise modérée — β2-mimétiques répétés, corticothérapie, surveillance hospitalière."
          : "PRAM 8–12 : crise sévère — oxygène, β2-mimétiques et corticoïdes, anticholinergiques, unité de soins intensifs.";
    return { value: `${score}/12`, label, interpretation, severity };
  },
};

/* ═══════════════ 7. Guarino (déshydratation) ═══════════════ */

const guarino: Calculator = {
  id: "guarino",
  label: "Guarino — Déshydratation",
  categorie: "pediatrie",
  description:
    "Sévérité de la déshydratation de l'enfant de moins de 3 ans dans le cadre d'une diarrhée aiguë (ESPGHAN).",
  reference: "Guarino A et al. J Pediatr Gastroenterol Nutr 2014 (ESPGHAN/ESPID).",
  itemsProgramme: ["Diarrhée aiguë", "Déshydratation", "Réhydratation"],
  fields: [
    scoredField("etatGeneral", "État général", [
      "Normal",
      "Soif, agitation, irritable au toucher",
      "Somnolent, hypotonique, froid ou en sueur",
    ]),
    scoredField("yeux", "Yeux", ["Normaux", "Légèrement creux", "Très creux"]),
    scoredField("muqueuses", "Muqueuses (langue)", ["Humides", "Collantes", "Sèches"]),
    scoredField("larmes", "Larmes", ["Larmes présentes", "Diminution des larmes", "Pas de larmes"]),
  ],
  compute: (i): CalculatorResult => {
    const score = guarino.fields.reduce((sum, field) => sum + num(i[field.id]), 0);
    const severity: CalculatorResult["severity"] =
      score === 0 ? "low" : score <= 4 ? "medium" : "high";
    const label =
      score === 0
        ? "Pas de déshydratation"
        : score <= 4
          ? "Déshydratation légère"
          : "Déshydratation modérée à sévère";
    const interpretation =
      score === 0
        ? "Score 0 : pas de déshydratation — réhydratation orale à domicile (SRO ad libitum) et conseils de surveillance."
        : score <= 4
          ? "Score 1–4 : déshydratation légère — solution de réhydratation orale encadrée, réalimentation précoce, réévaluation rapprochée."
          : "Score 5–8 : déshydratation modérée à sévère — hospitalisation, réhydratation IV et surveillance stricte (ionogramme, glycémie).";
    return { value: `${score}/8`, label, interpretation, severity };
  },
};

/* ═══════════════════════ 8. Âge corrigé ═══════════════════════ */

const ageCorrige: Calculator = {
  id: "age-corrige",
  label: "Âge corrigé (prématuré)",
  categorie: "pediatrie",
  description:
    "Âge corrigé d'un enfant né prématuré : âge chronologique diminué du degré de prématurité. À utiliser jusqu'à 2 ans pour la croissance et le développement.",
  reference: "American Academy of Pediatrics — Committee on Fetus and Newborn, 2004.",
  itemsProgramme: ["Prématurité", "Croissance", "Développement psychomoteur"],
  fields: [
    {
      id: "terme",
      label: "Terme de naissance",
      type: "number",
      unit: "SA",
      min: 22,
      max: 42,
      default: 32,
      help: "Semaines d'aménorrhée à la naissance",
    },
    {
      id: "chrono",
      label: "Âge chronologique",
      type: "number",
      unit: "semaines",
      min: 0,
      max: 200,
      default: 12,
      help: "Semaines depuis la naissance",
    },
  ],
  compute: (i): CalculatorResult => {
    const terme = num(i.terme, 40);
    const chrono = num(i.chrono);
    const prematurity = Math.max(0, 40 - terme);
    const corrected = Math.max(0, chrono - prematurity);
    const severity: CalculatorResult["severity"] = "low";
    return {
      value: `${Math.round(corrected * 10) / 10} sem.`,
      label:
        prematurity <= 0
          ? "Né à terme — pas de correction nécessaire"
          : `Prématurité de ${prematurity} semaines`,
      interpretation:
        prematurity <= 0
          ? "Enfant né à terme : l'âge corrigé est identique à l'âge chronologique."
          : `Âge corrigé ≈ ${Math.round((corrected / 4.345) * 10) / 10} mois. Utiliser l'âge corrigé pour interpréter la croissance (poids, taille, périmètre crânien) et les acquisitions jusqu'à 24 mois (voire 36 mois pour les grands prématurés).`,
      severity,
    };
  },
};

/* ═══════════════════════ 9. Taille cible ═══════════════════════ */

const tailleCible: Calculator = {
  id: "taille-cible",
  label: "Taille cible (parentale)",
  categorie: "pediatrie",
  description:
    "Taille cible génétique d'un enfant à partir de la taille des parents (méthode de Tanner).",
  reference: "Tanner JM, Goldstein H, Whitehouse RH. Arch Dis Child 1970.",
  itemsProgramme: ["Croissance staturale", "Retard de croissance"],
  fields: [
    {
      id: "sexe",
      label: "Sexe de l'enfant",
      type: "select",
      default: "m",
      options: [
        { value: "m", label: "Masculin" },
        { value: "f", label: "Féminin" },
      ],
    },
    {
      id: "pere",
      label: "Taille du père",
      type: "number",
      unit: "cm",
      min: 120,
      max: 230,
      default: 175,
    },
    {
      id: "mere",
      label: "Taille de la mère",
      type: "number",
      unit: "cm",
      min: 120,
      max: 220,
      default: 163,
    },
  ],
  compute: (i): CalculatorResult => {
    const pere = num(i.pere);
    const mere = num(i.mere);
    const masculin = str(i.sexe, "m") === "m";
    const midParental = masculin ? (pere + mere + 13) / 2 : (pere + mere - 13) / 2;
    const target = Math.round(midParental * 10) / 10;
    const lower = Math.round((target - 6.5) * 10) / 10;
    const upper = Math.round((target + 6.5) * 10) / 10;
    return {
      value: `${target} cm`,
      label: `Intervalle cible ${lower} – ${upper} cm`,
      interpretation: `Taille cible ${target} cm (± 6,5 cm). Une taille de l'enfant située dans cet intervalle est compatible avec son potentiel génétique ; en dehors, rechercher une cause de retard ou d'avance staturale et interpréter sur la courbe de croissance et la vitesse de croissance.`,
      severity: "low",
    };
  },
};

/* ═══════════ 10. Rapport bilirubine / albumine ═══════════ */

const biliAlbumine: Calculator = {
  id: "rapport-bili-albumine",
  label: "Rapport bilirubine/albumine",
  categorie: "pediatrie",
  description:
    "Rapport B/A comme reflet de la bilirubine libre, à interpréter avec la bilirubine totale pour décider d'une exsanguino-transfusion (AAP 2022).",
  reference: "Kemper AR et al. Pediatrics 2022 (AAP — hyperbilirubinémie du nouveau-né ≥ 35 SA).",
  itemsProgramme: ["Ictère néonatal", "Hyperbilirubinémie"],
  fields: [
    {
      id: "bili",
      label: "Bilirubine totale (TSB)",
      type: "number",
      unit: "mg/dL",
      min: 0,
      max: 50,
      step: 0.1,
      default: 12,
    },
    {
      id: "albumine",
      label: "Albumine sérique",
      type: "number",
      unit: "g/dL",
      min: 0,
      max: 6,
      step: 0.1,
      default: 3.2,
    },
    {
      id: "terme",
      label: "Terme",
      type: "select",
      default: "38",
      options: [
        { value: "38", label: "≥ 38 SA" },
        { value: "35", label: "35–37 SA" },
      ],
    },
    {
      id: "neurotoxicite",
      label:
        "Facteur de neurotoxicité (maladie hémolytique, G6PD, sepsis, albumine < 3 g/dL, instabilité clinique)",
      type: "boolean",
      default: false,
    },
  ],
  compute: (i): CalculatorResult => {
    const bili = num(i.bili);
    const albumine = num(i.albumine);
    if (bili <= 0 || albumine <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez la bilirubine totale et l'albumine.",
        severity: "low",
      };
    }
    const ratio = Math.round((bili / albumine) * 100) / 100;
    const late = str(i.terme, "38") === "38";
    const risk = bool(i.neurotoxicite);

    const threshold = late ? (risk ? 7.2 : 8.0) : risk ? 6.8 : 7.2;
    const above = ratio >= threshold;
    const severity: CalculatorResult["severity"] = above
      ? "critical"
      : ratio >= threshold - 1
        ? "high"
        : "low";
    return {
      value: ratio.toFixed(2),
      label: `Seuil d'exchange ≈ ${threshold} mg/g — ${above ? "atteint" : "non atteint"}`,
      interpretation: above
        ? `Rapport B/A ${ratio} ≥ ${threshold} : seuil d'exsanguino-transfusion atteint selon l'AAP 2022 — en association avec la bilirubine totale, discuter l'exchange transfusion en urgence et intensifier la photothérapie.`
        : `Rapport B/A ${ratio} < ${threshold} : en dessous du seuil d'exchange transfusion (AAP 2022) pour ce terme et ce niveau de risque. Le rapport B/A s'utilise TOUJOURS avec la bilirubine totale, jamais seul.`,
      severity,
    };
  },
};

export const PEDIATRIE_CALCULATORS: Calculator[] = [
  apgar,
  silverman,
  blantyre,
  wang,
  woodDownes,
  pram,
  guarino,
  ageCorrige,
  tailleCible,
  biliAlbumine,
];
