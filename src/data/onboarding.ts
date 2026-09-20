export const SUBJECT_CATEGORIES: Record<string, string[]> = {
  "Spécialités": [
    "Cardiologie", "Neurologie", "Infectiologie", "Pédiatrie",
    "Gynécologie-Obstétrique", "Pneumologie", "Gastro-entérologie",
    "Endocrinologie", "Dermatologie", "Psychiatrie", "Rhumatologie",
    "Néphrologie", "Hématologie", "Ophtalmologie", "ORL",
  ],
  "Fondamentaux": [
    "Sémiologie", "Pharmacologie", "Anatomie", "Physiologie",
    "Biostatistiques", "Immunologie", "Éthique médicale",
  ],
  "Examens & Stages": [
    "Urgences", "EDN / Collèges", "Internat qualifiant",
    "Garde et clinique", "ECOS",
  ],
};

export const DAILY_GOALS = [
  { id: "15min", label: "15 min / jour",     description: "Rythme léger, pour tenir sur la durée",  target: 3  },
  { id: "30min", label: "30 min / jour",     description: "Le sweet spot : régulier sans épuiser", target: 6  },
  { id: "1h",    label: "1 h / jour",        description: "Rythme soutenu, progression rapide",    target: 12 },
  { id: "2h",    label: "2 h / jour",        description: "Intensif, avant un examen",             target: 24 },
  { id: "10qcm", label: "10 QCMs / jour",    description: "Priorité à la pratique",                target: 10 },
  { id: "1chap", label: "1 chapitre / jour", description: "Priorité au contenu de fond",           target: 8  },
] as const;

export type DailyGoalId = typeof DAILY_GOALS[number]["id"];
