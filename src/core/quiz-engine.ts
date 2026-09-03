import type { Deck, DeckProgress, Question } from "./types";
import { itemMastery } from "./mastery";
import { isDue } from "./spaced-repetition";

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

const LESSON_COMPETENCY: Record<number, string[]> = {
  0: ["recognize", "semiology"],
  1: ["semiology", "diagnostic_orientation"],
  2: ["diagnosis", "clinical_reasoning"],
  3: ["management", "diagnosis"],
  4: ["clinical_reasoning", "management", "diagnosis"],
};

export const LESSONS = [
  { index: 0, title: "Reconnaître", detail: "Repérer le signe, nommer la lésion, trier l’urgence." },
  { index: 1, title: "Sémiologie", detail: "Interrogatoire, examen, manœuvres, langage clinique." },
  { index: 2, title: "Orientation", detail: "Syndromes, hypothèses, examens de première ligne." },
  { index: 3, title: "Prise en charge", detail: "Ce qui change le pronostic — et les erreurs à ne plus faire." },
  { index: 4, title: "Situation complexe", detail: "Mélange, pièges, raisonnement sous contrainte." },
] as const;

export type SessionMode = "lesson" | "revue" | "today" | "exam" | "preview";

export function pickLessonQuestions(
  deck: Deck,
  lessonIndex: number,
  progress: DeckProgress | undefined,
  mode: SessionMode = "lesson",
): Question[] {
  const questions = deck.questions;
  if (questions.length === 0) return [];
  if (mode === "preview") return questions.slice(0, 3);
  if (mode === "revue") {
    const missed = questions.filter((q) => (progress?.seen[q.id]?.wrong ?? 0) > 0);
    const due = questions.filter((q) => isDue(progress?.seen[q.id]));
    const pool = due.length > 0 ? due : missed.length > 0 ? missed : questions;
    return shuffle(pool).slice(0, Math.min(8, pool.length));
  }
  const idx = Math.max(0, Math.min(4, lessonIndex));
  const seen = progress?.seen ?? {};
  const wanted = LESSON_COMPETENCY[idx] ?? ["diagnosis"];
  if (idx === 3) {
    const weak = [...questions].sort(
      (a, b) => itemMastery(seen[a.id]) - itemMastery(seen[b.id]),
    );
    return weak.slice(0, Math.min(8, weak.length));
  }
  if (idx === 4) return shuffle(questions).slice(0, Math.min(10, questions.length));
  const byComp = questions.filter((q) => wanted.includes(q.competency));
  const byDiff =
    idx === 0
      ? questions.filter((q) => q.difficulty === "base")
      : idx === 2
        ? questions.filter((q) => q.difficulty === "avance")
        : [];
  const merged = [...byComp, ...byDiff, ...shuffle(questions)].filter(
    (q, i, arr) => arr.findIndex((x) => x.id === q.id) === i,
  );
  return merged.slice(0, Math.min(8, merged.length));
}

export function pickTodayQuestions(
  decks: Deck[],
  progressMap: Record<string, DeckProgress>,
  limit = 10,
): { deck: Deck; question: Question }[] {
  const due: { deck: Deck; question: Question; score: number }[] = [];
  const fresh: { deck: Deck; question: Question; score: number }[] = [];
  for (const deck of decks) {
    const seen = progressMap[deck.id]?.seen ?? {};
    for (const question of deck.questions) {
      const stats = seen[question.id];
      if (isDue(stats)) {
        due.push({ deck, question, score: itemMastery(stats) });
      } else if (!stats || stats.repetitions === 0) {
        fresh.push({ deck, question, score: 0 });
      } else if ((stats.wrong ?? 0) > (stats.correct ?? 0)) {
        due.push({ deck, question, score: itemMastery(stats) });
      }
    }
  }
  due.sort((a, b) => a.score - b.score);
  const mixed = [...due, ...shuffle(fresh)];
  const uniq = mixed.filter(
    (row, i, arr) => arr.findIndex((x) => x.question.id === row.question.id) === i,
  );
  return uniq.slice(0, limit).map(({ deck, question }) => ({ deck, question }));
}

export function pickExamQuestions(decks: Deck[], n = 15): { deck: Deck; question: Question }[] {
  const pool = decks.flatMap((deck) => deck.questions.map((question) => ({ deck, question })));
  return shuffle(pool).slice(0, Math.min(n, pool.length));
}

export function comboBonus(streak: number): number {
  if (streak < 3) return 0;
  return Math.min(8, (streak - 2) * 2);
}

export function questionXp(difficulty: Question["difficulty"], combo: number, ok: boolean): number {
  if (!ok) return 0;
  const base = difficulty === "avance" ? 16 : 10;
  return base + comboBonus(combo);
}

export function lessonXp(correctCount: number, total: number, maxCombo: number): number {
  const base = correctCount * 10;
  const combo = Math.min(20, maxCombo * 2);
  const perfect = correctCount === total && total > 0 ? 25 : 0;
  const clear = total > 0 && correctCount / total >= 0.7 ? 40 : 0;
  return base + combo + perfect + clear;
}

export function caseXp(correct: number, total: number): number {
  const base = 40 + correct * 12;
  const perfect = correct === total && total > 0 ? 30 : 0;
  return base + perfect;
}
