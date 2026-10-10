import type { Calculator, CalculatorResult } from "../types";
import { bool, num } from "../utils";

/**
 * Urgences — triage traumatologique, choc et traumatologie osseuse (6 scores).
 * Sources : Vittel (SFMU, Riou 2002), Shock Index (Allgöwer & Burri 1967),
 * TRiP(cast) (Nemeth 2020 / expertise Delphi), Ottawa (Stiell 1992/1995),
 * Revised Trauma Score (Champion 1989).
 */

/* ═══════════════════════ 1. Score de Vittel ═══════════════════════ */

const vittel: Calculator = {
  id: "vittel",
  label: "Vittel — Traumatisé grave",
  categorie: "urgences",
  description:
    "Triage du patient traumatisé à risque de décompensation vitale secondaire : un seul critère (hors terrain) suffit à classer le patient comme traumatisé grave.",
  reference: "Riou B et al. (SFMU) — critères de Vittel, 2002.",
  itemsProgramme: ["Traumatologie", "Polytraumatisme", "Triage préhospitalier"],
  fields: [
    {
      id: "gcs",
      label: "① Glasgow < 13",
      type: "boolean",
      default: false,
      help: "Variables physiologiques",
    },
    {
      id: "sbp",
      label: "① PAS < 90 mmHg",
      type: "boolean",
      default: false,
      help: "Variables physiologiques",
    },
    {
      id: "spo2",
      label: "① SpO₂ < 90 %",
      type: "boolean",
      default: false,
      help: "Variables physiologiques",
    },
    {
      id: "kinetics",
      label:
        "② Cinétique : éjection, autre passager décédé, chute > 6 m, projection/écrasement, blast",
      type: "boolean",
      default: false,
      help: "Éléments de cinétique (y compris déformation du véhicule, absence de ceinture/casque)",
    },
    {
      id: "anatomy",
      label:
        "③ Lésion anatomique grave (trauma pénétrant tête/cou/thorax/abdomen/bassin, volet thoracique, brûlure grave, fracas du bassin, atteinte médullaire, amputation, ischémie de membre)",
      type: "boolean",
      default: false,
      help: "Lésions anatomiques",
    },
    {
      id: "resuscitation",
      label:
        "④ Réanimation préhospitalière (ventilation assistée, remplissage > 1 000 mL, catécholamines, pantalon antichoc)",
      type: "boolean",
      default: false,
      help: "Réanimation préhospitalière",
    },
    {
      id: "age65",
      label: "⑤ Âge > 65 ans",
      type: "boolean",
      default: false,
      help: "Terrain (ne suffit pas seul)",
    },
    {
      id: "comorbidity",
      label: "⑤ Insuffisance cardiaque/coronarienne, respiratoire ou trouble de la crase",
      type: "boolean",
      default: false,
      help: "Terrain (ne suffit pas seul)",
    },
    {
      id: "pregnancy",
      label: "⑤ Grossesse (2ᵉ ou 3ᵉ trimestre)",
      type: "boolean",
      default: false,
      help: "Terrain (ne suffit pas seul)",
    },
  ],
  compute: (i): CalculatorResult => {
    const critical = [
      bool(i.gcs),
      bool(i.sbp),
      bool(i.spo2),
      bool(i.kinetics),
      bool(i.anatomy),
      bool(i.resuscitation),
    ].filter(Boolean).length;
    const terrain = [bool(i.age65), bool(i.comorbidity), bool(i.pregnancy)].filter(Boolean).length;

    if (critical >= 1) {
      return {
        value: "Traumatisé grave",
        label: `${critical} critère${critical > 1 ? "s" : ""} de gravité (hors terrain)`,
        interpretation:
          "Au moins un critère de Vittel (physiologique, cinétique, lésionnel ou de réanimation préhospitalière) est présent : patient traumatisé grave — orientation vers un centre traumatologique, bilan lésionnel complet (scanner corps entier) et réanimation.",
        severity: "critical",
      };
    }
    if (terrain >= 1) {
      return {
        value: "Terrain à risque",
        label: `${terrain} critère${terrain > 1 ? "s" : ""} de terrain isolé${terrain > 1 ? "s" : ""}`,
        interpretation:
          "Aucun critère de gravité franc, mais un terrain à risque est présent : surveillance renforcée, seuil d'hospitalisation abaissé et surveillance de la décompensation vitale secondaire.",
        severity: "medium",
      };
    }
    return {
      value: "Non grave",
      label: "Aucun critère de Vittel",
      interpretation:
        "Aucun critère de Vittel présent : patient traumatisé non grave selon ce score — poursuivre l'évaluation clinique et réévaluer en cas d'évolution.",
      severity: "low",
    };
  },
};

/* ═══════════════════════ 2. Shock Index ═══════════════════════ */

const shockIndex: Calculator = {
  id: "shock-index",
  label: "Shock Index (FC/PAS)",
  categorie: "urgences",
  description:
    "Ratio fréquence cardiaque / pression artérielle systolique, plus sensible que la tachycardie ou l'hypotension isolées pour détecter un choc précoce.",
  reference: "Allgöwer M, Burri C. Dtsch Med Wochenschr 1967 ; Cannon CM et al. J Trauma 2009.",
  itemsProgramme: ["Choc", "Hémorragie", "Urgences obstétricales"],
  fields: [
    {
      id: "fc",
      label: "Fréquence cardiaque",
      type: "number",
      unit: "bpm",
      min: 10,
      max: 300,
      default: 92,
    },
    {
      id: "pas",
      label: "Pression artérielle systolique",
      type: "number",
      unit: "mmHg",
      min: 20,
      max: 300,
      default: 118,
    },
  ],
  compute: (i): CalculatorResult => {
    const fc = num(i.fc);
    const pas = num(i.pas);
    if (pas <= 0) {
      return {
        value: "—",
        interpretation: "Renseignez la fréquence cardiaque et la pression systolique.",
        severity: "low",
      };
    }
    const value = Math.round((fc / pas) * 100) / 100;
    const severity: CalculatorResult["severity"] =
      value < 0.7 ? "low" : value < 0.9 ? "medium" : value < 1.1 ? "high" : "critical";
    const label =
      value < 0.7
        ? "Hémodynamique normale"
        : value < 0.9
          ? "Limite haute (à surveiller)"
          : value < 1.1
            ? "Choc probable"
            : "Choc sévère";
    const interpretation =
      value < 0.9
        ? "Shock Index < 0,9 : hémodynamique globale compensée. Une valeur entre 0,7 et 0,9 doit faire poursuivre la surveillance rapprochée (choc compensé possible chez le sujet jeune)."
        : value < 1.1
          ? "Shock Index ≥ 0,9 : évocateur d'un choc ou d'une décompensation imminente — rechercher une cause (hémorragie, sepsis, déshydratation), remplissage guidé et réévaluation répétée."
          : "Shock Index > 1,1 : choc sévère — remplissage vasculaire guidé, vasopresseurs et transfusion selon l'étiologie, prise en charge réanimatoire.";
    return { value: String(value), label, interpretation, severity };
  },
};

/* ═══════════════════════ 3. TRiP(cast) ═══════════════════════ */

const tripCast: Calculator = {
  id: "trip-cast",
  label: "TRiP(cast) — Immobilisation",
  categorie: "urgences",
  description:
    "Thrombosis Risk Prediction following Cast immobilization : décide de l'anticoagulation préventive après immobilisation d'un membre inférieur (adulte).",
  reference: "Nemeth B et al. (score TRiP(cast)) ; utilisation dans l'essai CASTING, Lancet 2025.",
  itemsProgramme: ["Maladie thrombo-embolique veineuse", "Immobilisation plâtrée"],
  fields: [
    {
      id: "trauma",
      label: "1. Nature du traumatisme",
      type: "select",
      default: "1",
      options: [
        {
          value: "1",
          label:
            "Bas risque — fracture unimalléolaire, entorse stade 1–2, fracture tarse/avant-pied (+1)",
        },
        {
          value: "2",
          label:
            "Risque intermédiaire — fracture bi/trimalléolaire, patellaire, entorse sévère (+2)",
        },
        {
          value: "3",
          label:
            "Haut risque — fracture diaphyse tibio-fibulaire, plateau tibial, rupture d'Achille (+3)",
        },
      ],
    },
    {
      id: "immobilisation",
      label: "2. Type d'immobilisation",
      type: "select",
      default: "2",
      options: [
        { value: "0", label: "Autre immobilisation avec appui plantaire (0)" },
        { value: "1", label: "Plâtre du pied (cheville libre) ou semi-rigide (1)" },
        { value: "2", label: "Botte plâtrée ou résine (2)" },
        { value: "3", label: "Plâtre cruropédieux (genou + cheville) (3)" },
      ],
    },
    {
      id: "age",
      label: "3. Âge",
      type: "select",
      default: "1",
      options: [
        { value: "0", label: "< 35 ans (0)" },
        { value: "1", label: "35–54 ans (1)" },
        { value: "2", label: "55–74 ans (2)" },
        { value: "3", label: "≥ 75 ans (3)" },
      ],
    },
    { id: "male", label: "4. Sexe masculin", type: "boolean", default: false, help: "+1" },
    {
      id: "bmi",
      label: "5. Indice de masse corporelle",
      type: "select",
      default: "0",
      options: [
        { value: "0", label: "< 25 kg/m² (0)" },
        { value: "1", label: "25–34 kg/m² (1)" },
        { value: "2", label: "≥ 35 kg/m² (2)" },
      ],
    },
    {
      id: "familyVte",
      label: "6. Antécédent familial de MTEV (1ᵉʳ degré)",
      type: "boolean",
      default: false,
      help: "+2",
    },
    {
      id: "personalVte",
      label: "7. Antécédent personnel de MTEV ou thrombophilie majeure",
      type: "boolean",
      default: false,
      help: "+4",
    },
    {
      id: "estrogen",
      label: "8. Contraception œstrogénique ou traitement hormonal",
      type: "boolean",
      default: false,
      help: "+4",
    },
    {
      id: "cancer",
      label: "9. Cancer dans les 5 dernières années",
      type: "boolean",
      default: false,
      help: "+3",
    },
    {
      id: "pregnancy",
      label: "10. Grossesse ou post-partum",
      type: "boolean",
      default: false,
      help: "+3",
    },
    {
      id: "recentImmobilisation",
      label: "11. Immobilisation dans les 3 derniers mois",
      type: "boolean",
      default: false,
      help: "+2",
    },
    {
      id: "surgery",
      label: "12. Chirurgie dans les 3 mois précédents",
      type: "boolean",
      default: false,
      help: "+2",
    },
    {
      id: "comorbidity",
      label: "13. Comorbidités (insuffisance cardiaque, BPCO, MICI, rhumatisme inflammatoire, IRC)",
      type: "boolean",
      default: false,
      help: "+1",
    },
    {
      id: "venousInsufficiency",
      label: "14. Insuffisance veineuse chronique",
      type: "boolean",
      default: false,
      help: "+1",
    },
  ],
  compute: (i): CalculatorResult => {
    const score =
      num(i.trauma) +
      num(i.immobilisation) +
      num(i.age) +
      (bool(i.male) ? 1 : 0) +
      num(i.bmi) +
      (bool(i.familyVte) ? 2 : 0) +
      (bool(i.personalVte) ? 4 : 0) +
      (bool(i.estrogen) ? 4 : 0) +
      (bool(i.cancer) ? 3 : 0) +
      (bool(i.pregnancy) ? 3 : 0) +
      (bool(i.recentImmobilisation) ? 2 : 0) +
      (bool(i.surgery) ? 2 : 0) +
      (bool(i.comorbidity) ? 1 : 0) +
      (bool(i.venousInsufficiency) ? 1 : 0);

    const severity: CalculatorResult["severity"] =
      score < 7 ? "low" : score < 12 ? "high" : "critical";
    const label =
      score < 7
        ? "Risque faible (< 7)"
        : score < 12
          ? "Risque intermédiaire (7–11)"
          : "Risque élevé (≥ 12)";
    const interpretation =
      score < 7
        ? "Score < 7 : pas de thromboprophylaxie pharmacologique indiquée — mobilisation précoce encouragée et surveillance clinique."
        : score < 12
          ? "Score 7–11 : anticoagulation préventive recommandée (HBPM ou fondaparinux) pendant toute la durée de l'immobilisation, après évaluation du risque hémorragique."
          : "Score ≥ 12 : anticoagulation préventive fortement recommandée (HBPM ou fondaparinux) et surveillance clinique étroite de la maladie thrombo-embolique.";
    return { value: String(score), label, interpretation, severity };
  },
};

/* ═══════════════ 4. Ottawa — Cheville ═══════════════ */

const ottawaCheville: Calculator = {
  id: "ottawa-cheville",
  label: "Ottawa — Cheville",
  categorie: "urgences",
  description:
    "Règle de décision pour ne prescrire une radiographie qu'en cas de critère après entorse de cheville (adulte).",
  reference: "Stiell IG et al. Ann Emerg Med 1992 ; JAMA 1993.",
  itemsProgramme: ["Entorse de cheville", "Traumatologie"],
  fields: [
    {
      id: "applicable",
      label:
        "Critères d'application respectés (≥ 18 ans, pas d'intoxication, aucune lésion distrayante)",
      type: "boolean",
      default: true,
    },
    {
      id: "malleoleExterne",
      label:
        "Douleur à la palpation du bord postérieur ou de la pointe de la malléole externe (6 cm)",
      type: "boolean",
      default: false,
    },
    {
      id: "malleoleInterne",
      label:
        "Douleur à la palpation du bord postérieur ou de la pointe de la malléole interne (6 cm)",
      type: "boolean",
      default: false,
    },
    {
      id: "baseM5",
      label: "Douleur à la palpation de la base du 5ᵉ métatarsien",
      type: "boolean",
      default: false,
    },
    {
      id: "naviculaire",
      label: "Douleur à la palpation de l'os naviculaire",
      type: "boolean",
      default: false,
    },
    {
      id: "quatrepas",
      label: "Incapacité de faire 4 pas immédiatement et aux urgences",
      type: "boolean",
      default: false,
    },
  ],
  compute: (i): CalculatorResult => {
    if (!bool(i.applicable)) {
      return {
        value: "Non applicable",
        label: "Hors critères d'application",
        interpretation:
          "La règle d'Ottawa n'est validée que chez l'adulte de 18 ans ou plus, non intoxiqué et sans lésion distrayante. Une radiographie est souvent justifiée d'emblée dans ces situations.",
        severity: "medium",
      };
    }
    const criteria = [
      bool(i.malleoleExterne),
      bool(i.malleoleInterne),
      bool(i.baseM5),
      bool(i.naviculaire),
      bool(i.quatrepas),
    ].filter(Boolean).length;
    const radiograph = criteria >= 1;
    return {
      value: radiograph ? "Radiographie indiquée" : "Radiographie inutile",
      label: `${criteria} critère${criteria > 1 ? "s" : ""} présent${criteria > 1 ? "s" : ""}`,
      interpretation: radiograph
        ? "Au moins un critère d'Ottawa est présent : radiographie de cheville (et du pied selon la douleur) indiquée — haute sensibilité pour exclure une fracture."
        : "Aucun critère d'Ottawa : la radiographie n'est pas nécessaire — traitement fonctionnel de l'entorse et réévaluation en cas d'aggravation.",
      severity: radiograph ? "medium" : "low",
    };
  },
};

/* ═══════════════ 5. Ottawa — Genou ═══════════════ */

const ottawaGenou: Calculator = {
  id: "ottawa-genou",
  label: "Ottawa — Genou",
  categorie: "urgences",
  description:
    "Règle de décision pour ne prescrire une radiographie qu'en cas de critère après traumatisme du genou (adulte).",
  reference: "Stiell IG et al. JAMA 1995 (Ottawa Knee Rule).",
  itemsProgramme: ["Traumatisme du genou", "Traumatologie"],
  fields: [
    {
      id: "age55",
      label: "Âge ≥ 55 ans",
      type: "boolean",
      default: false,
    },
    {
      id: "rotule",
      label: "Douleur isolée de la rotule à la palpation",
      type: "boolean",
      default: false,
    },
    {
      id: "perone",
      label: "Douleur à la palpation de la tête du péroné",
      type: "boolean",
      default: false,
    },
    {
      id: "flexion90",
      label: "Flexion du genou limitée à 90°",
      type: "boolean",
      default: false,
    },
    {
      id: "quatrepas",
      label: "Incapacité de faire 4 pas (immédiatement et aux urgences)",
      type: "boolean",
      default: false,
    },
  ],
  compute: (i): CalculatorResult => {
    const criteria = [
      bool(i.age55),
      bool(i.rotule),
      bool(i.perone),
      bool(i.flexion90),
      bool(i.quatrepas),
    ].filter(Boolean).length;
    const radiograph = criteria >= 1;
    return {
      value: radiograph ? "Radiographie indiquée" : "Radiographie inutile",
      label: `${criteria} critère${criteria > 1 ? "s" : ""} présent${criteria > 1 ? "s" : ""}`,
      interpretation: radiograph
        ? "Au moins un critère de la règle d'Ottawa du genou est présent : radiographie indiquée (sensibilité ≈ 100 % pour les fractures cliniquement significatives)."
        : "Aucun critère : radiographie non nécessaire — traitement symptomatique et réévaluation si aggravation.",
      severity: radiograph ? "medium" : "low",
    };
  },
};

/* ═══════════════ 6. Revised Trauma Score ═══════════════ */

const rtsGcs = (gcs: number): number =>
  gcs >= 13 ? 4 : gcs >= 9 ? 3 : gcs >= 6 ? 2 : gcs >= 4 ? 1 : 0;
const rtsSbp = (sbp: number): number =>
  sbp > 89 ? 4 : sbp >= 76 ? 3 : sbp >= 50 ? 2 : sbp >= 1 ? 1 : 0;
const rtsRr = (rr: number): number =>
  rr >= 10 && rr <= 29 ? 4 : rr > 29 ? 3 : rr >= 6 ? 2 : rr >= 1 ? 1 : 0;

const revisedTraumaScore: Calculator = {
  id: "revised-trauma-score",
  label: "Revised Trauma Score",
  categorie: "urgences",
  description:
    "Score physiologique de gravité du traumatisé, utilisé pour le triage et le calcul de la probabilité de survie (TRISS).",
  reference: "Champion HR et al. J Trauma 1989.",
  itemsProgramme: ["Traumatologie", "Polytraumatisme"],
  fields: [
    { id: "gcs", label: "Score de Glasgow", type: "number", min: 3, max: 15, default: 15 },
    {
      id: "sbp",
      label: "Pression artérielle systolique",
      type: "number",
      unit: "mmHg",
      min: 0,
      max: 300,
      default: 120,
    },
    {
      id: "rr",
      label: "Fréquence respiratoire",
      type: "number",
      unit: "/min",
      min: 0,
      max: 90,
      default: 18,
    },
  ],
  compute: (i): CalculatorResult => {
    const gcs = Math.min(15, Math.max(3, num(i.gcs, 15)));
    const sbp = num(i.sbp);
    const rr = num(i.rr);
    const codedGcs = rtsGcs(gcs);
    const codedSbp = rtsSbp(sbp);
    const codedRr = rtsRr(rr);
    const trts = codedGcs + codedSbp + codedRr;
    const rts = Math.round((0.9368 * codedGcs + 0.7326 * codedSbp + 0.2908 * codedRr) * 100) / 100;

    const severity: CalculatorResult["severity"] =
      rts >= 7 ? "low" : rts >= 6 ? "medium" : rts >= 4 ? "high" : "critical";
    return {
      value: String(rts),
      label: `Score codé (T-RTS) ${trts}/12`,
      interpretation:
        rts >= 7
          ? "RTS ≥ 7 : atteinte physiologique minime — triage vers un centre de traumatologie de proximité selon le bilan lésionnel."
          : rts >= 4
            ? "RTS 4–7 : atteinte physiologique significative — orientation vers un centre traumatologique, réanimation et bilan lésionnel complet."
            : "RTS < 4 : atteinte physiologique sévère — pronostic vital engagé, prise en charge réanimatoire immédiate et transfert en centre de traumatologie de niveau élevé.",
      severity,
    };
  },
};

export const URGENCES_CALCULATORS: Calculator[] = [
  vittel,
  shockIndex,
  tripCast,
  ottawaCheville,
  ottawaGenou,
  revisedTraumaScore,
];
