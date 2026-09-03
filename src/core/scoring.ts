import type { Deck, DeckProgress } from "./types";
import { deckMastery } from "./mastery";

export const TITLES = [
  { min: 1, title: "Débutant" },
  { min: 10, title: "Étudiant actif" },
  { min: 25, title: "Étudiant confirmé" },
  { min: 50, title: "Clinicien junior" },
  { min: 75, title: "Expert" },
  { min: 100, title: "Optimus Master" },
] as const;

export function levelFromXp(xp: number): number {
  return Math.min(100, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 8)));
}

export function xpForLevel(level: number): number {
  return Math.round(8 * (Math.max(1, Math.min(100, level)) - 1) ** 2);
}

export function levelInfo(xp: number) {
  const level = levelFromXp(xp);
  const title = [...TITLES].reverse().find((t) => level >= t.min)?.title ?? "Débutant";
  const floor = xpForLevel(level);
  const ceil = level >= 100 ? floor : xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const xpInto = Math.max(0, xp - floor);
  return {
    level,
    title,
    xpInto,
    xpForNext: span,
    progress: level >= 100 ? 100 : Math.min(100, Math.round((xpInto / span) * 100)),
  };
}

export const LEAGUES = [
  { id: "bronze", label: "Bronze", minWeekly: 0 },
  { id: "argent", label: "Argent", minWeekly: 80 },
  { id: "or", label: "Or", minWeekly: 180 },
  { id: "platine", label: "Platine", minWeekly: 320 },
  { id: "diamant", label: "Diamant", minWeekly: 500 },
  { id: "master", label: "Master", minWeekly: 750 },
] as const;

export type LeagueId = (typeof LEAGUES)[number]["id"];

export function leagueFromWeeklyXp(weeklyXp: number): (typeof LEAGUES)[number] {
  return [...LEAGUES].reverse().find((l) => weeklyXp >= l.minWeekly) ?? LEAGUES[0];
}

/** Optimus Score — not just question count. */
export function optimusScore(opts: {
  xp: number;
  streak: number;
  casesCompleted: number;
  decks: Deck[];
  progressMap: Record<string, DeckProgress>;
  weeklyXp: number;
}): number {
  const mastery =
    opts.decks.length === 0
      ? 0
      : opts.decks.reduce((a, d) => a + deckMastery(d, opts.progressMap[d.id]), 0) / opts.decks.length;
  const answered = Object.values(opts.progressMap).reduce(
    (n, p) => n + Object.values(p.seen).reduce((a, s) => a + s.repetitions, 0),
    0,
  );
  const accuracyPool = Object.values(opts.progressMap).flatMap((p) => Object.values(p.seen));
  const acc =
    accuracyPool.length === 0
      ? 0
      : accuracyPool.reduce((a, s) => a + s.correct, 0) /
        Math.max(1, accuracyPool.reduce((a, s) => a + s.correct + s.wrong, 0));
  const raw =
    mastery * 4.2 +
    acc * 180 +
    Math.min(120, opts.streak * 8) +
    Math.min(150, opts.casesCompleted * 22) +
    Math.min(80, Math.sqrt(answered) * 6) +
    Math.min(100, opts.weeklyXp * 0.12);
  return Math.round(raw);
}
