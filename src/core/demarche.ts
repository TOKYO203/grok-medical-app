/**
 * Domaine « Démarche enrichie » — contenu multi-format d'un chapitre
 * d'orientation diagnostique (pilote : Douleur thoracique).
 *
 * Trois vues partagent un même contenu :
 *  1. Fiche    → `sections` (accordéons) + `mnemonics`
 *  2. Flashcards → `flashcards` (Q/R)
 *  3. Mindmap  → `mindmap` (radial, zoom/pan)
 *
 * ⚠️ Ce domaine est ADDITIF : il ne remplace ni `DiagnosticCase` (le QCM de
 * `/demarche/$id`) ni `diagnostics.json`. Le lien entre les deux se fait par
 * `diagnosticId`, jamais par mutation du catalogue existant.
 */
import type { Source } from "@/core/types";

/* ═══════════ 1. ENCADRÉS TYPÉS ═══════════ */

/** Tons des encadrés de la fiche — mapping visuel dans `fiche-view.tsx`. */
export type CalloutTone = "urgence" | "prudence" | "reflexe" | "retenir" | "memo";

export const CALLOUT_TONES: readonly CalloutTone[] = [
  "urgence",
  "prudence",
  "reflexe",
  "retenir",
  "memo",
] as const;

/* ═══════════ 2. VUE FICHE ═══════════ */

export type FicheBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "callout"; tone: CalloutTone; title: string; text: string };

/**
 * Référence citée par une section précise (traçabilité éditoriale).
 * Volontairement plus légère que `Source` : une section renvoie à une source
 * déjà décrite en pied de fiche, elle n'a pas à la re-citer en entier.
 */
export type FicheSectionSource = {
  id: string;
  organization?: string;
  title: string;
  year?: number;
  url?: string;
};

export type FicheSection = {
  id: string;
  /** Titre affiché, ex. « I. Introduction ». */
  title: string;
  /** Chapeau optionnel (1 phrase) affiché sous le titre. */
  summary?: string;
  blocks: FicheBlock[];
  /** Sources mobilisées par cette section (affichées en pied de section). */
  sources?: FicheSectionSource[];
};

/** Moyen mnémotechnique (DANGER, T.O.R.A.C., 3 E, A.I.R.). */
export type Mnemonic = {
  id: string;
  /** Mot-clé déclencheur, ex. « DANGER ». */
  label: string;
  /** Phrase d'accroche optionnelle. */
  intro?: string;
  /** Chaque lettre et son contenu. */
  entries: { key: string; term: string }[];
  note?: string;
};

/* ═══════════ 3. VUE FLASHCARDS ═══════════ */

export type Flashcard = {
  id: string;
  /** Question posée au recto. */
  front: string;
  /** Réponse révélée au verso. */
  back: string;
  /** Étiquettes libres (urgence, piège, examens…). */
  tags?: string[];
};

/* ═══════════ 4. VUE MINDMAP ═══════════ */

export type MindmapLeaf = { id: string; label: string; detail?: string };

export type MindmapNode = {
  id: string;
  label: string;
  /** Ton repris des encadrés (surlignage de branche). */
  tone?: CalloutTone;
  detail?: string;
  leaves?: MindmapLeaf[];
};

export type MindmapBranch = {
  id: string;
  label: string;
  tone?: CalloutTone;
  /** Texte affiché au tap (panneau de détail). */
  detail: string;
  children: MindmapNode[];
};

export type Mindmap = {
  root: { id: string; label: string; detail: string };
  branches: MindmapBranch[];
};

/* ═══════════ 5. CONTENU COMPLET + INDEX ═══════════ */

/**
 * Socle commun à tout contenu « fiche » : une démarche d'orientation
 * diagnostique (`DemarcheContent`) et une fiche de nosographie
 * (`PathologyContent`, cf. `@/core/pathology`) partagent exactement ces
 * champs — c'est ce qui permet aux trois vues (fiche, flashcards, carte
 * mentale) d'être rendues par les MÊMES composants.
 */
export type FicheContent = {
  schemaVersion: number;
  slug: string;
  title: string;
  subtitle: string;
  /** Objectif de concours, une phrase (affichée en tête de fiche). */
  objective: string;
  updatedAt: string;
  sections: FicheSection[];
  mnemonics: Mnemonic[];
  flashcards: Flashcard[];
  mindmap: Mindmap;
  sources: Source[];
};

export type DemarcheContent = FicheContent & {
  /** Clé de rattachement au QCM : `id` d'un `DiagnosticCase`. */
  diagnosticId: string;
};

export type DemarcheIndexEntry = {
  diagnosticId: string;
  slug: string;
  title: string;
  /** Nom de fichier sous `src/content/data/demarches/`. */
  file: string;
  status: "available" | "planned";
};
