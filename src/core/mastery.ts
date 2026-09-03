import type { Competency, Deck, DeckProgress, ReviewStats } from "./types";

/** Mastery 0–100: accuracy, recency, repetitions, difficulty, retention. Distinct from progression. */
export function itemMastery(stats: ReviewStats | undefined, now = Date.now()): number {
  if (!stats || stats.repetitions === 0) return 0;
  const attempts = stats.correct + stats.wrong;
  const accuracy = attempts === 0 ? 0 : stats.correct / attempts;
  const recencyDays = stats.lastReview ? (now - stats.lastReview) / 86_400_000 : 30;
  const recency = Math.max(0.15, Math.exp(-recencyDays / 12));
  const reps = Math.min(1, stats.repetitions / 6);
  const failPenalty = Math.min(0.45, stats.failures * 0.08);
  const retention = Math.min(1, stats.stability / 8);
  const raw = (accuracy * 0.45 + recency * 0.15 + reps * 0.15 + retention * 0.25) * 100;
  return Math.max(0, Math.min(100, Math.round(raw - failPenalty * 100)));
}

export function masteryBand(score: number): { id: string; label: string } {
  if (score <= 20) return { id: "unknown", label: "Inconnu" };
  if (score <= 40) return { id: "fragile", label: "Fragile" };
  if (score <= 60) return { id: "learning", label: "Apprentissage" };
  if (score <= 80) return { id: "good", label: "Bon" };
  if (score <= 95) return { id: "mastered", label: "Maîtrisé" };
  return { id: "consolidated", label: "Consolidé" };
}

export function deckProgressPct(deck: Deck, progress: DeckProgress | undefined): number {
  if (deck.questions.length === 0) return 0;
  const seen = progress?.seen ?? {};
  const n = deck.questions.filter((q) => (seen[q.id]?.repetitions ?? 0) > 0).length;
  return Math.round((n / deck.questions.length) * 100);
}

export function deckMastery(deck: Deck, progress: DeckProgress | undefined, now = Date.now()): number {
  if (deck.questions.length === 0) return 0;
  const seen = progress?.seen ?? {};
  const scores = deck.questions.map((q) => itemMastery(seen[q.id], now));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function competencyMastery(
  decks: Deck[],
  progressMap: Record<string, DeckProgress>,
  competency: Competency,
  now = Date.now(),
): number {
  const items: number[] = [];
  for (const deck of decks) {
    const seen = progressMap[deck.id]?.seen ?? {};
    for (const q of deck.questions) {
      if (q.competency !== competency) continue;
      items.push(itemMastery(seen[q.id], now));
    }
  }
  if (items.length === 0) return 0;
  return Math.round(items.reduce((a, b) => a + b, 0) / items.length);
}

export function globalMastery(decks: Deck[], progressMap: Record<string, DeckProgress>, now = Date.now()): number {
  const scores = decks.map((d) => deckMastery(d, progressMap[d.id], now));
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
