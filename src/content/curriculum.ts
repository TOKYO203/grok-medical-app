import type { CurriculumSpecialty } from "@/core/curriculum";

/**
 * Curricula par spécialité.
 * Chaque spécialité est découpée en branches (pathologie, urgence, etc.)
 * qui regroupent des decks progressifs par niveau.
 *
 * Répartition cible (79 decks, 817 questions, zéro orphelin) :
 *   cardio=36 · fondamentaux=4 · neuro=10 · infectio=22 · dermato=1 · urgences=6
 * Les branches encore vides portent `skeleton: true` (exclues de l'audit).
 */

const LEVELS_PATHO = ["L2", "L3", "L4", "L5", "INTERNE"] as const;

/* ────────────────────────── CARDIOLOGIE ────────────────────────── */
export const CURRICULUM_CARDIO: CurriculumSpecialty = {
  id: "cardio",
  label: "Cardiologie",
  icon: "🫀",
  color: "red",
  description: "36 decks progressifs — 7 pathologies, des bases à l'internat.",
  branches: [
    {
      id: "bases",
      label: "Bases",
      icon: "📚",
      levels: ["L5"],
      description: "Vue d'ensemble de la cardiologie clinique.",
      decks: ["cardio"],
    },
    {
      id: "sca",
      label: "SCA — Syndrome coronarien aigu",
      icon: "💔",
      levels: [...LEVELS_PATHO],
      description: "De la douleur thoracique au SCA compliqué.",
      decks: ["cardio-sca-l2", "cardio-sca-l3", "cardio-sca-l4", "cardio-sca-l5", "cardio-sca-int"],
    },
    {
      id: "ic",
      label: "Insuffisance cardiaque",
      icon: "🫁",
      levels: [...LEVELS_PATHO],
      description: "Notions, bilan étiologique, prise en charge, cas complexes.",
      decks: ["cardio-ic-l2", "cardio-ic-l3", "cardio-ic-l4", "cardio-ic-l5", "cardio-ic-int"],
    },
    {
      id: "hta",
      label: "HTA — Hypertension artérielle",
      icon: "🩺",
      levels: [...LEVELS_PATHO],
      description: "Mesure, bilan étiologique, complications, thérapeutique.",
      decks: ["cardio-hta-l2", "cardio-hta-l3", "cardio-hta-l4", "cardio-hta-l5", "cardio-hta-int"],
    },
    {
      id: "fa",
      label: "Fibrillation atriale",
      icon: "⚡",
      levels: [...LEVELS_PATHO],
      description: "Diagnostic, classification, stratégie thérapeutique.",
      decks: ["cardio-fa-l2", "cardio-fa-l3", "cardio-fa-l4", "cardio-fa-l5", "cardio-fa-int"],
    },
    {
      id: "valvulopathies",
      label: "Valvulopathies",
      icon: "🫀",
      levels: [...LEVELS_PATHO],
      description: "Sémiologie des souffles, évaluation, prise en charge.",
      decks: ["cardio-valv-l2", "cardio-valv-l3", "cardio-valv-l4", "cardio-valv-l5", "cardio-valv-int"],
    },
    {
      id: "arret",
      label: "Arrêt cardiaque",
      icon: "🚨",
      levels: [...LEVELS_PATHO],
      description: "RCP de base, ACLS, post-ROSC, cas complexes.",
      decks: ["cardio-arret-l2", "cardio-arret-l3", "cardio-arret-l4", "cardio-arret-l5", "cardio-arret-int"],
    },
    {
      id: "oap",
      label: "OAP — Œdème aigu du poumon",
      icon: "💨",
      levels: [...LEVELS_PATHO],
      description: "Diagnostic, étiologies, prise en charge initiale et avancée.",
      decks: ["cardio-oap-l2", "cardio-oap-l3", "cardio-oap-l4", "cardio-oap-l5", "cardio-oap-int"],
    },
  ],
};

/* ─────────────────── FONDAMENTAUX & SÉMIOLOGIE ─────────────────── */
export const CURRICULUM_FONDAMENTAUX: CurriculumSpecialty = {
  id: "fondamentaux",
  label: "Fondamentaux & Sémiologie",
  icon: "🎓",
  color: "sky",
  description: "Base transversale pour tous les cliniciens.",
  branches: [
    {
      id: "anatomie",
      label: "Anatomie",
      icon: "🦴",
      levels: ["L1"],
      description: "Repères utiles au lit du malade.",
      decks: ["anatomie"],
    },
    {
      id: "physiologie",
      label: "Physiologie",
      icon: "⚙️",
      levels: ["L2"],
      description: "Ce qui fait tourner la machine.",
      decks: ["physio"],
    },
    {
      id: "semiologie",
      label: "Sémiologie",
      icon: "🔍",
      levels: ["L3"],
      description: "Signes, manœuvres, langage clinique.",
      decks: ["semio"],
    },
    {
      id: "pharmacologie",
      label: "Pharmacologie",
      icon: "💊",
      levels: ["L2"],
      description: "Mécanismes, doses, antidotes.",
      decks: ["pharmaco"],
    },
  ],
};

/* ────────────────────────── NEUROLOGIE ────────────────────────── */
export const CURRICULUM_NEURO: CurriculumSpecialty = {
  id: "neuro",
  label: "Neurologie",
  icon: "🧠",
  color: "violet",
  description: "AVC, épilepsie, syndromes dégénératifs.",
  branches: [
    {
      id: "general",
      label: "Généralités",
      icon: "🧠",
      levels: ["L5"],
      description: "Vue d'ensemble de la neurologie.",
      decks: ["neuro"],
    },
    {
      id: "avc",
      label: "AVC",
      icon: "🚨",
      levels: ["L2", "L3", "L4", "L5", "INTERNE"],
      description: "Ischémique, hémorragique, thrombolyse.",
      decks: ["neuro-avc-l2", "neuro-avc-l3", "neuro-avc-l4", "neuro-avc-l5", "neuro-avc-int"],
    },
    {
      id: "epilepsie",
      label: "Épilepsie",
      icon: "⚡",
      levels: ["L3", "L4", "L5", "INTERNE"],
      description: "Crises, classification, traitement.",
      decks: ["neuro-epi-l3", "neuro-epi-l4", "neuro-epi-l5", "neuro-epi-int"],
    },
    { id: "degeneratif", label: "Syndromes dégénératifs", icon: "🧬", levels: ["L4", "L5", "INTERNE"], description: "Parkinson, Alzheimer, SLA.", decks: [], skeleton: true },
    { id: "nerfs", label: "Nerfs périphériques", icon: "🪢", levels: ["L3", "L4"], description: "Neuropathies, syndromes canalaires.", decks: [], skeleton: true },
  ],
};

/* ────────────────────────── INFECTIOLOGIE ────────────────────────── */
export const CURRICULUM_INFECTIO: CurriculumSpecialty = {
  id: "infectio",
  label: "Infectiologie",
  icon: "🦠",
  color: "amber",
  description: "Sepsis, antibiothérapie, tropicales.",
  branches: [
    {
      id: "infections-generales",
      label: "Infections générales",
      icon: "🦠",
      levels: ["L4"],
      description: "Démarche diagnostique et prise en charge globale.",
      decks: ["infectio"],
    },
    {
      id: "tropical",
      label: "Maladies tropicales",
      icon: "🌍",
      levels: ["L4"],
      description: "Paludisme, vecteurs, urgences de l'océan Indien.",
      decks: ["tropical"],
    },
    {
      id: "typho",
      label: "Fièvres typhoïdes",
      icon: "🧫",
      levels: [...LEVELS_PATHO],
      description: "Reconnaître, diagnostiquer et traiter la fièvre typhoïde.",
      decks: ["infectio-typho-l2", "infectio-typho-l3", "infectio-typho-l4", "infectio-typho-l5", "infectio-typho-int"],
    },

    { id: "sepsis", label: "Sepsis et choc septique", icon: "🚨", levels: ["L4", "L5", "INTERNE"], description: "Reconnaissance, antibiothérapie, réanimation.", decks: [], skeleton: true },
    { id: "atb", label: "Antibiothérapie", icon: "💊", levels: ["L3", "L4", "L5"], description: "Classes, spectre, résistances.", decks: [], skeleton: true },
    {
      id: "vih",
      label: "VIH et IST",
      icon: "🎗️",
      levels: [...LEVELS_PATHO],
      description: "Dépistage, traitements, prophylaxie.",
      decks: ["infectio-vih-l2", "infectio-vih-l3", "infectio-vih-l4", "infectio-vih-l5", "infectio-vih-int"],
    },

    {
      id: "tetanos",
      label: "Tétanos",
      icon: "🧫",
      levels: [...LEVELS_PATHO],
      description: "Reconnaître l'urgence, traiter les spasmes, prévenir par la vaccination.",
      decks: ["infectio-tetanos-l2", "infectio-tetanos-l3", "infectio-tetanos-l4", "infectio-tetanos-l5", "infectio-tetanos-int"],
    },
    {
      id: "rougeole",
      label: "Rougeole",
      icon: "🤒",
      levels: [...LEVELS_PATHO],
      description: "Reconnaître l'éruption, traiter les complications, prévenir par la vaccination.",
      decks: ["infectio-rougeole-l2", "infectio-rougeole-l3", "infectio-rougeole-l4", "infectio-rougeole-l5", "infectio-rougeole-int"],
    },
  ],
};

/* ────────────────────────── PNEUMOLOGIE ────────────────────────── */
export const CURRICULUM_PNEUMO: CurriculumSpecialty = {
  id: "pneumo",
  label: "Pneumologie",
  icon: "🫁",
  color: "sky",
  description: "Asthme, BPCO, infections respiratoires.",
  branches: [
    { id: "asthme", label: "Asthme", icon: "💨", levels: ["L2", "L3", "L4"], description: "Diagnostic, contrôle, exacerbations.", decks: [], skeleton: true },
    { id: "bpco", label: "BPCO", icon: "🚬", levels: ["L4", "L5"], description: "Dépistage, exacerbations, réhabilitation.", decks: [], skeleton: true },
    { id: "infections", label: "Infections respiratoires", icon: "🦠", levels: ["L3", "L4", "L5"], description: "Pneumonies, tuberculose.", decks: [], skeleton: true },
  ],
};

/* ────────────────────────── PÉDIATRIE ────────────────────────── */
export const CURRICULUM_PEDIATRIE: CurriculumSpecialty = {
  id: "pediatrie",
  label: "Pédiatrie",
  icon: "👶",
  color: "pink",
  description: "Nourrisson, croissance, urgences pédiatriques.",
  branches: [
    { id: "nouveau-ne", label: "Nouveau-né", icon: "🍼", levels: ["L3", "L4", "L5"], description: "Ictère, détresse respiratoire, infections.", decks: [], skeleton: true },
    { id: "croissance", label: "Croissance et développement", icon: "📏", levels: ["L2", "L3"], description: "Courbes, puberté, dépistage.", decks: [], skeleton: true },
    { id: "urgences-ped", label: "Urgences pédiatriques", icon: "🚨", levels: ["L4", "L5", "INTERNE"], description: "Convulsions, déshydratation, choc.", decks: [], skeleton: true },
  ],
};

/* ────────────────────────── DERMATOLOGIE ────────────────────────── */
export const CURRICULUM_DERMATO: CurriculumSpecialty = {
  id: "dermato",
  label: "Dermatologie",
  icon: "🩹",
  color: "rose",
  description: "Lésions élémentaires, infections cutanées, urgences.",
  branches: [
    {
      id: "general",
      label: "Généralités",
      icon: "🩹",
      levels: ["L4"],
      description: "Lésions élémentaires et démarche diagnostique.",
      decks: ["dermato"],
    },
    { id: "lesions", label: "Lésions élémentaires", icon: "🔍", levels: ["L2", "L3"], description: "Reconnaître et décrire.", decks: [], skeleton: true },
    { id: "infections-cutanees", label: "Infections cutanées", icon: "🦠", levels: ["L3", "L4"], description: "Bactériennes, virales, fongiques.", decks: [], skeleton: true },
    { id: "urgences-derm", label: "Urgences dermatologiques", icon: "🚨", levels: ["L4", "L5", "INTERNE"], description: "Syndrome de Lyell, anaphylaxie, cellulite.", decks: [], skeleton: true },
  ],
};

/* ────────────────────────── URGENCES ────────────────────────── */
export const CURRICULUM_URGENCES: CurriculumSpecialty = {
  id: "urgences",
  label: "Urgences",
  icon: "🚑",
  color: "orange",
  description: "Gestes qui sauvent, tri, prise en charge vitale.",
  branches: [
    {
      id: "detresses",
      label: "Détresses vitales",
      icon: "🚨",
      levels: ["INTERNE"],
      description: "Les gestes qui sauvent.",
      decks: ["urgences"],
    },
    {
      id: "choc",
      label: "Choc — État de choc",
      icon: "🚑",
      levels: [...LEVELS_PATHO],
      description: "Reconnaître, catégoriser et réanimer le choc.",
      decks: ["urgences-choc-l2", "urgences-choc-l3", "urgences-choc-l4", "urgences-choc-l5", "urgences-choc-int"],
    },
    { id: "gestes", label: "Gestes de secours", icon: "🆘", levels: ["L3", "L4"], description: "PLS, RCP, DAE.", decks: [], skeleton: true },
    { id: "intoxications", label: "Intoxications", icon: "☠️", levels: ["L4", "L5"], description: "Médicaments, produits ménagers, champignons.", decks: [], skeleton: true },
  ],
};

/* ────────────────────────── GYNÉCO-OBSTÉTRIQUE ────────────────────────── */
export const CURRICULUM_GYNECO: CurriculumSpecialty = {
  id: "gyneco",
  label: "Gynécologie-Obstétrique",
  icon: "🤰",
  color: "purple",
  description: "Grossesse, accouchement, gynécologie.",
  branches: [
    { id: "grossesse", label: "Grossesse", icon: "🤰", levels: ["L3", "L4", "L5"], description: "Suivi, complications, dépistage.", decks: [], skeleton: true },
    { id: "accouchement", label: "Accouchement", icon: "👶", levels: ["L4", "L5", "INTERNE"], description: "Travail, délivrance, urgences.", decks: [], skeleton: true },
    { id: "gyneco", label: "Gynécologie", icon: "🩺", levels: ["L3", "L4", "L5"], description: "Contraception, ménopause, cancers.", decks: [], skeleton: true },
  ],
};

/* ─────────────────────── REGISTRE GLOBAL ─────────────────────── */
export const CURRICULA: Record<string, CurriculumSpecialty> = {
  cardio: CURRICULUM_CARDIO,
  fondamentaux: CURRICULUM_FONDAMENTAUX,
  neuro: CURRICULUM_NEURO,
  infectio: CURRICULUM_INFECTIO,
  pneumo: CURRICULUM_PNEUMO,
  pediatrie: CURRICULUM_PEDIATRIE,
  dermato: CURRICULUM_DERMATO,
  urgences: CURRICULUM_URGENCES,
  gyneco: CURRICULUM_GYNECO,
};

export function getCurriculum(id: string): CurriculumSpecialty | undefined {
  return CURRICULA[id];
}

export function listCurricula(): CurriculumSpecialty[] {
  return Object.values(CURRICULA);
}
