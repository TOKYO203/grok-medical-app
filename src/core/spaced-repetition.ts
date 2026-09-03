import type { ReviewStats } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function emptyStats(now = Date.now()): ReviewStats {
  return {
    correct: 0,
    wrong: 0,
    lastReview: 0,
    nextReview: now,
    stability: 0.4,
    difficulty: 0.3,
    repetitions: 0,
    successes: 0,
    failures: 0,
  };
}

/** Simplified SM-2 / FSRS-inspired update. Offline, deterministic. */
export function applyReview(prev: ReviewStats | undefined, ok: boolean, now = Date.now()): ReviewStats {
  const s = prev ? { ...prev } : emptyStats(now);
  s.lastReview = now;
  s.repetitions += 1;
  if (ok) {
    s.correct += 1;
    s.successes += 1;
    s.stability = Math.min(60, s.stability * 1.7 + 0.4);
    s.difficulty = Math.max(0.05, s.difficulty * 0.92);
  } else {
    s.wrong += 1;
    s.failures += 1;
    s.stability = Math.max(0.2, s.stability * 0.45);
    s.difficulty = Math.min(0.95, s.difficulty + 0.12);
  }
  const interval = ok
    ? Math.min(21 * DAY, Math.max(10 * MINUTE, s.stability * HOUR * 6))
    : Math.min(8 * HOUR, Math.max(4 * MINUTE, (1 - s.difficulty) * 25 * MINUTE));
  s.nextReview = now + interval;
  return s;
}

export function isDue(stats: ReviewStats | undefined, now = Date.now()): boolean {
  if (!stats || stats.repetitions === 0) return false;
  return stats.nextReview <= now;
}

export function dueInLabel(stats: ReviewStats, now = Date.now()): string {
  const delta = stats.nextReview - now;
  if (delta <= 0) return "due";
  const m = Math.round(delta / MINUTE);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}
