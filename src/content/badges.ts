export const BADGE_CATALOG = [
  { id: "streak7", title: "Garde de 7 jours", detail: "Série quotidienne d'une semaine." },
  { id: "q100", title: "Centurion", detail: "100 questions répondues." },
  { id: "firstCase", title: "Premier cas", detail: "Un dossier clinique mené à terme." },
  { id: "cardio90", title: "Cœur sûr", detail: "90 % de réussite en cardiologie." },
  { id: "modules5", title: "Cinq stations", detail: "Cinq modules entièrement parcourus." },
  { id: "firstImport", title: "Bibliothécaire", detail: "Premier deck JSON accepté." },
  { id: "diagnostic", title: "Clinicien", detail: "Démarche diagnostique complète." },
  { id: "reviewer", title: "Mémoire vive", detail: "20 révisions espacées réussies." },
  { id: "tropical", title: "Côte Est", detail: "Deck médecine tropicale parcouru." },
  { id: "exam", title: "Blanc réussi", detail: "Examen blanc à 70 % ou plus." },
] as const;

export type BadgeId = (typeof BADGE_CATALOG)[number]["id"];
