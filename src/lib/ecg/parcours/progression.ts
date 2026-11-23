import type { Level } from "./types";

const STORAGE_KEY = "ecg-parcours-v1";

export interface Progression {
  completedLessons: string[];
  quizScores: Record<string, number>;
  updatedAt: string;
}

const EMPTY: Progression = { completedLessons: [], quizScores: {}, updatedAt: "" };

export function loadProgression(): Progression {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progression>;
    if (!parsed || !Array.isArray(parsed.completedLessons)) return EMPTY;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

export function saveProgression(p: Progression): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...p, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota / navigation privée : ignoré silencieusement */
  }
}

export function markLessonComplete(id: string, score: number): Progression {
  const p = loadProgression();
  const set = new Set(p.completedLessons);
  set.add(id);
  const next: Progression = {
    completedLessons: Array.from(set),
    quizScores: { ...p.quizScores, [id]: score },
    updatedAt: new Date().toISOString(),
  };
  saveProgression(next);
  return next;
}

export function isLessonComplete(id: string): boolean {
  return loadProgression().completedLessons.includes(id);
}

export function levelProgress(
  level: Level,
  lessonIds: string[],
): { done: number; total: number; pct: number } {
  const p = loadProgression();
  const done = lessonIds.filter((id) => p.completedLessons.includes(id)).length;
  const total = lessonIds.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}
