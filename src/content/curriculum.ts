import type { CurriculumSpecialty } from "@/core/curriculum";

/**
 * Curriculum Cardiologie — 15 decks répartis en 5 branches.
 * Progression en spirale du L1 au Résident.
 */
export const CURRICULUM_CARDIO: CurriculumSpecialty = {
  id: "cardio",
  label: "Cardiologie",
  icon: "🫀",
  color: "red",
  description: "Du fondamental à l'urgence cardiologique, 15 decks progressifs.",
  branches: [
    {
      id: "fondamentaux",
      label: "Fondamentaux",
      icon: "📚",
      levels: ["L1", "L2", "L3"],
      description: "Bases anatomiques, physiologiques et sémiologiques.",
      decks: [
        "cardio-anatomie-l1",
        "cardio-physio-l2",
        "cardio-semio-l3",
      ],
    },
    {
      id: "pathologies",
      label: "Pathologies",
      icon: "🔬",
      levels: ["L3", "L4", "L5"],
      description: "Pathologies cardiovasculaires courantes et avancées.",
      decks: [
        "cardio-htn-l3",
        "cardio-rythme-l4",
        "cardio-valvulo-l4",
        "cardio-ic-l5",
        "cardio-sca-l5",
        "cardio-congenital-l5",
      ],
    },
    {
      id: "urgences",
      label: "Urgences",
      icon: "🚨",
      levels: ["L5", "INTERNE"],
      description: "Situations critiques et prise en charge urgente.",
      decks: [
        "cardio-arret-l5",
        "cardio-oap-l5",
        "cardio-dissection-intern",
      ],
    },
    {
      id: "cas",
      label: "Cas cliniques",
      icon: "🏥",
      levels: ["L4", "L5", "INTERNE"],
      description: "Dossiers progressifs au format EDN.",
      decks: [
        "cardio-cas-angor-l4",
        "cardio-cas-sca-l5",
      ],
    },
    {
      id: "guidelines",
      label: "Guidelines",
      icon: "📖",
      levels: ["RESIDENT", "SENIOR"],
      description: "Recommandations internationales commentées.",
      decks: [
        "cardio-guidelines-esc-resident",
      ],
    },
  ],
};

/**
 * Tous les curricula disponibles.
 * Ajouter une spécialité = ajouter une entrée ici.
 */
export const CURRICULA: Record<string, CurriculumSpecialty> = {
  cardio: CURRICULUM_CARDIO,
};

export function getCurriculum(id: string): CurriculumSpecialty | undefined {
  return CURRICULA[id];
}

export function listCurricula(): CurriculumSpecialty[] {
  return Object.values(CURRICULA);
}
