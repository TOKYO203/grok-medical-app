/**
 * Domaine « Fiche de nosographie » — contenu long-format d'un item du
 * programme national (pilote : Paludisme, item n° 4).
 *
 * Une fiche de nosographie est le CONTENU DE COURS attaché à un item du
 * référentiel (`programmeItem.id`), là où une démarche (`DemarcheContent`) est
 * attachée à un QCM d'orientation diagnostique (`diagnosticId`). Les deux
 * partagent le même socle (`FicheContent`) : fiche, flashcards et carte
 * mentale sont donc rendues par les mêmes composants.
 *
 * ⚠️ Ce domaine est ADDITIF : il ne modifie ni `programmes/madagascar-2025.json`
 * ni le catalogue des decks. Le rattachement se fait par valeur (`slug` =
 * identifiant d'item), jamais par mutation du référentiel.
 */
import type { FicheContent } from "@/core/demarche";

/** État de relecture médicale — affiché à l'utilisateur, jamais masqué. */
export type PathologyReviewStatus =
  | "pending-medical-review"
  | "in-medical-review"
  | "reviewed"
  | "deprecated";

/** Place de la fiche dans le référentiel national. */
export type PathologyCurriculum = {
  /** Collection éditoriale affichée (ex. « Nosographie — spécialité médicale »). */
  collection: string;
  /** Numéro du chapitre dans le document source. */
  chapterNumber: number;
  specialty: string;
  referential: {
    /** Identifiant du référentiel (`Programme.id`), ex. « madagascar-2025 ». */
    programme: string;
    /** Rang de l'item dans le référentiel (1 → 240). */
    ordinal: number;
    /** Numéro de l'item tel qu'imprimé dans le document source. */
    localNumber: number;
    sectionLabel: string;
    title: string;
    specialty: string;
  };
};

/** Contenus compagnons — jamais dupliqués ici, seulement référencés. */
export type PathologyRelated = {
  /** `id` de decks (`data/decks.json`). */
  deckIds: string[];
  /** `id` de cas cliniques (`data/cases.json`). */
  caseIds: string[];
};

/**
 * Traçabilité éditoriale. Ces champs sont affichés (état de relecture,
 * notes de vérification) : une fiche de cours non relue doit se voir comme
 * telle, c'est la condition pour publier du contenu généré sans mentir.
 */
export type PathologyEditorial = {
  sourceDocument: {
    filename: string;
    title: string;
    pages: number;
    receivedAt: string;
    /** Rôle réel du document : « référence de structure uniquement », jamais source de données. */
    role: string;
  };
  reformulation: string;
  reviewStatus: string;
  reviewedBy: string | null;
  verificationNotes: string[];
  qcChecklist: string[];
};

export type PathologyContent = FicheContent & {
  kind: "pathology";
  language: string;
  reviewStatus: PathologyReviewStatus;
  curriculum: PathologyCurriculum;
  related: PathologyRelated;
  editorial: PathologyEditorial;
};

export type PathologyIndexEntry = {
  slug: string;
  title: string;
  specialty: string;
  /** Nom de fichier sous `src/content/data/pathologies/`. */
  file: string;
  status: "available" | "planned";
  /** `id` de l'item correspondant dans le référentiel national. */
  programmeId: string;
  programmeOrdinal: number;
};

export type PathologyIndex = {
  schemaVersion: number;
  updatedAt: string;
  purpose: string;
  fiches: PathologyIndexEntry[];
};
