import type { BadgeId } from "@/content/badges";
import type { DeckProgress } from "@/core/types";

/**
 * Badges progressifs — Mission International, Session 1 (A07).
 *
 * `nextBadgeGoal` calcule le prochain objectif atteignable (« Encore 3 cas… »)
 * à partir des MÊMES signaux que `unlockBadges` (src/state/store.ts) : une
 * seule source de vérité pour les seuils, aucune divergence possible entre
 * l'obtention réelle d'un badge et sa progression affichée.
 *
 * Les badges sans seuil comptable (examen blanc réussi à 70 %, précision
 * cardiologie déjà au-delà de 6 questions vues) n'exposent pas d'objectif
 * chiffré : ils restent « À débloquer » sans message de progression.
 */

export type BadgeProgressSignals = {
  badges: BadgeId[];
  streak: number;
  reviewsSucceeded: number;
  casesCompleted: number;
  diagnosticsCompleted: number;
  importedDecks: number;
  progress: Record<string, DeckProgress>;
};

export type BadgeGoal = {
  id: BadgeId;
  remaining: number;
  unit: string;
  /** Message de motivation affiché, ex. « Encore 3 cas… ». */
  hint: string;
};

function countAnswered(progress: Record<string, DeckProgress>): number {
  return Object.values(progress).reduce(
    (total, deckProgress) =>
      total +
      Object.values(deckProgress.seen).reduce((sum, stats) => sum + stats.repetitions, 0),
    0,
  );
}

export function badgeGoals(signals: BadgeProgressSignals): BadgeGoal[] {
  const earned = new Set(signals.badges);
  const goals: BadgeGoal[] = [];

  const push = (id: BadgeId, remaining: number, unit: string, unitPlural?: string) => {
    const left = Math.max(0, Math.ceil(remaining));
    if (earned.has(id) || left <= 0) return;
    const unitText = left > 1 && unitPlural ? unitPlural : unit;
    goals.push({ id, remaining: left, unit: unitText, hint: `Encore ${left} ${unitText}…` });
  };

  push("streak7", 7 - signals.streak, "jour de série", "jours de série");
  push("q100", 100 - countAnswered(signals.progress), "question", "questions");
  push("firstCase", 1 - signals.casesCompleted, "cas");
  push("diagnostic", 1 - signals.diagnosticsCompleted, "démarche");
  push("reviewer", 20 - signals.reviewsSucceeded, "révision", "révisions");
  const walked = Object.values(signals.progress).filter(
    (deckProgress) => Object.keys(deckProgress.seen).length > 0,
  ).length;
  push("modules5", 5 - walked, "module", "modules");
  push("firstImport", 1 - signals.importedDecks, "deck importé");
  const tropicalSeen = Object.keys(signals.progress.tropical?.seen ?? {}).length;
  push("tropical", 6 - tropicalSeen, "question de médecine tropicale", "questions de médecine tropicale");
  const cardioSeen = Object.keys(signals.progress.cardio?.seen ?? {}).length;
  if (cardioSeen < 6) {
    push("cardio90", 6 - cardioSeen, "question de cardiologie", "questions de cardiologie");
  }

  goals.sort((a, b) => a.remaining - b.remaining);
  return goals;
}

/** Prochain objectif, le plus proche du déblocage. */
export function nextBadgeGoal(signals: BadgeProgressSignals): BadgeGoal | null {
  return badgeGoals(signals)[0] ?? null;
}
