import type { Level } from "./types";

const PROGRESSION_STORAGE_ID = ["ecg", "parcours", "v1"].join("-");

export interface Progression {
  completedLessons: string[];
  quizScores: Record<string, number>;
  updatedAt: string;
}

const EMPTY: Progression = { completedLessons: [], quizScores: {}, updatedAt: "" };

export function loadProgression(): Progression {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(PROGRESSION_STORAGE_ID);
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
      PROGRESSION_STORAGE_ID,
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


// ── Déblocage progressif des niveaux ────────────────────────────────────────
const UNLOCK_THRESHOLD_PCT = 80;
const UNLOCK_ALL_KEY = "ecg-parcours-unlock-all";

export function isUnlockAllActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(UNLOCK_ALL_KEY) === "true";
  } catch {
    return false;
  }
}

export function setUnlockAll(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) window.localStorage.setItem(UNLOCK_ALL_KEY, "true");
    else window.localStorage.removeItem(UNLOCK_ALL_KEY);
  } catch {
    /* ignore */
  }
}

const LEVEL_ORDER: Level[] = ["A", "B", "C", "D", "E"];

/**
 * Un niveau est débloqué si :
 *  - c'est le niveau A (toujours accessible), OU
 *  - le mode "déverrouiller tout" est actif, OU
 *  - le niveau précédent a atteint UNLOCK_THRESHOLD_PCT (% leçons complétées)
 */
export function isLevelUnlocked(
  level: Level,
  previousLevelLessonIds: string[],
): boolean {
  if (level === "A") return true;
  if (isUnlockAllActive()) return true;

  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return true;

  const prevLevel = LEVEL_ORDER[idx - 1];
  if (previousLevelLessonIds.length === 0) return false;

  const { pct } = levelProgress(prevLevel, previousLevelLessonIds);
  return pct >= UNLOCK_THRESHOLD_PCT;
}

export function getUnlockThreshold(): number {
  return UNLOCK_THRESHOLD_PCT;
}
