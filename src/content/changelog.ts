/*
 * Journal des versions public (B19 — Session 17).
 *
 * Versionne l’APPLICATION, pas le contenu médical : la version du contenu
 * vit dans src/content/medical-version.ts, et le champ `changelog` des decks
 * reste un journal éditorial par deck (gelé avec le contenu).
 */
export type ChangelogEntryKind = "new" | "improved" | "fixed";

export type ChangelogEntry = {
  kind: ChangelogEntryKind;
  text: string;
};

export type ChangelogRelease = {
  /** Date de publication au format ISO (YYYY-MM-DD), portée par <time>. */
  date: string;
  /** Date affichée, en clair. */
  dateLabel: string;
  version: string;
  summary: string;
  entries: ChangelogEntry[];
};

export const CHANGELOG_KIND_LABEL: Record<ChangelogEntryKind, string> = {
  new: "Nouveau",
  improved: "Amélioré",
  fixed: "Corrigé",
};

export const APP_CHANGELOG: ChangelogRelease[] = [
  {
    date: "2026-10-17",
    dateLabel: "17 octobre 2026",
    version: "1.0.0",
    summary: "Optimus 1.0 — une application plus légère et plus lisible.",
    entries: [
      { kind: "new", text: "Mode focus du lecteur de quiz : en-tête et navigation masqués pour réviser sans distraction, état mémorisé." },
      { kind: "new", text: "Badges « Nouveau » sur les contenus jamais explorés, et écrans vides avec action (revue, bibliothèque, examen)." },
      { kind: "improved", text: "Application allégée : les données médicales se chargent à la demande au lieu d’alourdir chaque page." },
      { kind: "improved", text: "Carte « Profil local » refondue : statut de synchronisation visible en un coup d’œil (synchronisé, en attente, sur cet appareil)." },
      { kind: "improved", text: "Avatar unifié entre l’accueil et le profil." },
      { kind: "improved", text: "Contrastes renforcés sur toute l’interface (WCAG AA)." },
    ],
  },
  {
    date: "2026-10-16",
    dateLabel: "16 octobre 2026",
    version: "1.0.0-rc",
    summary: "Révisions chronométrées, navigation mobile et fiabilité du contenu.",
    entries: [
      { kind: "new", text: "Examen blanc chronométré : dix minutes par épreuve, rapport de fin avec score et seuil de réussite." },
      { kind: "new", text: "Recherche globale (⌘K / Ctrl+K) sur les pages, cas, démarches, decks et badges." },
      { kind: "improved", text: "Navigation mobile : swipe-back, pull-to-refresh et « Reprendre où vous étiez » depuis l’accueil." },
      { kind: "improved", text: "Auscultation : le tracé affiché correspond désormais exactement au son produit et aux fiches." },
      { kind: "improved", text: "Badges : progression visible badge par badge, du premier cas au niveau suivant." },
      { kind: "fixed", text: "Fibrillation atriale réellement irrégulière sur le tracé d’auscultation." },
    ],
  },
  {
    date: "2026-10-15",
    dateLabel: "15 octobre 2026",
    version: "1.0.0-beta",
    summary: "Première version publique : business model, crédibilité et langues.",
    entries: [
      { kind: "new", text: "Page Tarifs, prix multi-devises (Ariary, USD, EUR) et essai Premium de 7 jours." },
      { kind: "new", text: "Quatre langues : français, anglais, espagnol, portugais." },
      { kind: "new", text: "Gouvernance éditoriale publique : conseil éditorial, validation clinique et sources citées par fiche." },
      { kind: "new", text: "Démarches enrichies sur le pilote « Douleur thoracique » : flashcards et carte mentale." },
    ],
  },
];
