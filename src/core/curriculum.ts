/**
 * Curriculum — Système de progression en spirale.
 * Un même sujet décliné en profondeur croissante selon le niveau.
 */

export type Level =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "INTERNE"
  | "RESIDENT"
  | "SENIOR";

export const LEVEL_LABEL: Record<Level, string> = {
  L1: "1ère année",
  L2: "2ème année",
  L3: "3ème année",
  L4: "4ème année",
  L5: "5ème année",
  INTERNE: "Interne",
  RESIDENT: "Résident",
  SENIOR: "Senior",
};

export const LEVEL_SHORT: Record<Level, string> = {
  L1: "L1",
  L2: "L2",
  L3: "L3",
  L4: "L4",
  L5: "L5",
  INTERNE: "INT",
  RESIDENT: "RES",
  SENIOR: "SEN",
};

export const LEVEL_ORDER: Level[] = [
  "L1", "L2", "L3", "L4", "L5", "INTERNE", "RESIDENT", "SENIOR",
];

/** Identifiant de branche — ouvert pour permettre l'ajout de nouvelles branches sans toucher au type. */
export type BranchId = string;

const BRANCH_LABELS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  pathologies: "Pathologies",
  urgences: "Urgences",
  cas: "Cas cliniques",
  guidelines: "Guidelines",
};

export function branchLabel(id: string): string {
  return BRANCH_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

const BRANCH_ICONS: Record<string, string> = {
  fondamentaux: "📚",
  pathologies: "🔬",
  urgences: "🚨",
  cas: "🏥",
  guidelines: "📖",
};

export function branchIcon(id: string): string {
  return BRANCH_ICONS[id] ?? "📂";
}

/** Identifiant de spécialité — ouvert pour permettre l'ajout de nouvelles spécialités. */
export type SpecialtyId = string;

export type CurriculumBranch = {
  id: BranchId;
  label: string;
  icon: string;
  levels: Level[];
  description: string;
  decks: string[];
  /**
   * Branche « squelette » : structure prévue mais encore vide.
   * Exclue des contrôles d'intégrité (audit-content) et du rendu.
   */
  skeleton?: boolean;
};

export type CurriculumSpecialty = {
  id: SpecialtyId;
  label: string;
  icon: string;
  color: string;
  description: string;
  branches: CurriculumBranch[];
};

/**
 * Vérifie si un niveau est "au-dessus" du niveau utilisateur.
 * Sert au système de guidage (pas de blocage).
 */
export function isAboveLevel(userLevel: Level, contentLevel: Level): boolean {
  return LEVEL_ORDER.indexOf(contentLevel) > LEVEL_ORDER.indexOf(userLevel);
}

/**
 * Retourne un label court pour l'écart de niveau.
 */
export function levelGapLabel(userLevel: Level, contentLevel: Level): string | null {
  const userIdx = LEVEL_ORDER.indexOf(userLevel);
  const contentIdx = LEVEL_ORDER.indexOf(contentLevel);
  const gap = contentIdx - userIdx;
  if (gap <= 0) return null;
  if (gap === 1) return "⬆️ Niveau supérieur";
  if (gap === 2) return "⬆️ Avancé";
  return "⬆️ Très avancé";
}
