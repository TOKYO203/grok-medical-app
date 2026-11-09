import type { Deck } from "@/core/types";

/**
 * Modèle PUR du défi hebdomadaire (LB-2) — aucun import de framework, donc
 * chargeable sous `node --experimental-strip-types` et testable directement.
 *
 * Le deck désigné est une fonction DÉTERMINISTE de la clé de semaine : tous les
 * clients voient le même défi sans appel serveur, et le serveur n'a jamais
 * besoin de connaître le catalogue.
 */

/** Même formule que src/state/store.ts (weekKey) — une seule source par contrat. */
export function currentWeekKey(ts = Date.now()): string {
  const d = new Date(ts);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function hashKey(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Deck éligible au défi : intégré, gratuit, publié. */
export function weeklyChallengeDeck(weekKey: string, decks: Deck[]): Deck | null {
  const eligible = decks.filter(
    (deck) =>
      !deck.imported &&
      deck.access_policy?.tier === "free" &&
      deck.status !== "draft" &&
      deck.status !== "deprecated" &&
      deck.questions.length > 0,
  );
  if (eligible.length === 0) return null;
  const byId = new Map(eligible.map((deck) => [deck.id, deck]));
  const ids = [...byId.keys()].sort();
  return byId.get(ids[hashKey(weekKey) % ids.length]) ?? null;
}

export interface ChallengeScore {
  score: number;
  total: number;
}

/**
 * Score du défi = bonnes réponses cumulées sur le deck désigné (contraintes :
 * le serveur plafonne 0 <= score <= total <= 500). `seen` porte les stats de
 * répétition espacée par question : correct/wrong sont cumulatifs, c'est donc
 * un score de MAÎTRISE du deck, pas de vélocité — assumer en UI.
 */
export function challengeScore(deck: Deck, seen: Record<string, { correct: number; wrong: number }> | undefined): ChallengeScore {
  if (!seen) return { score: 0, total: 0 };
  const ids = new Set(deck.questions.map((q) => q.id));
  let score = 0;
  let total = 0;
  for (const [questionId, stats] of Object.entries(seen)) {
    if (!ids.has(questionId)) continue;
    score += stats.correct;
    total += stats.correct + stats.wrong;
  }
  return { score: Math.min(score, 500), total: Math.min(total, 500) };
}
