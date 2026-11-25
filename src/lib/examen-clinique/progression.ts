// Progression locale du module « Examen clinique » (parcours guidé NEURO).
// Modèle ECG : progression dans le localStorage, déblocage progressif quand la
// leçon précédente est validée, drapeau « tout déverrouiller » pour les démos
// et la formation. Le verrou PREMIUM, lui, reste côté serveur (jeton de contenu).

const PROGRESSION_STORAGE_ID = "examen-clinique-v1";

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

function saveProgression(p: Progression): void {
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

/** Le score retenu est le MEILLEUR obtenu : on peut repasser sans régression. */
export function markLessonComplete(id: string, score: number): Progression {
  const p = loadProgression();
  const set = new Set(p.completedLessons);
  set.add(id);
  const next: Progression = {
    completedLessons: Array.from(set),
    quizScores: { ...p.quizScores, [id]: Math.max(p.quizScores[id] ?? 0, score) },
    updatedAt: new Date().toISOString(),
  };
  saveProgression(next);
  return next;
}

export function isLessonComplete(id: string): boolean {
  return loadProgression().completedLessons.includes(id);
}

export function bestScore(id: string): number {
  return loadProgression().quizScores[id] ?? 0;
}

// ── Déblocage progressif ────────────────────────────────────────────────────
const UNLOCK_THRESHOLD_PCT = 80;
const UNLOCK_ALL_KEY = "examen-clinique-unlock-all";

export function getUnlockThreshold(): number {
  return UNLOCK_THRESHOLD_PCT;
}

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

/**
 * La leçon d ordre N est débloquée si :
 *  - c est la leçon 1 (toujours accessible) ;
 *  - le mode « tout déverrouiller » est actif ;
 *  - la leçon d ordre N-1 est validée avec au moins UNLOCK_THRESHOLD_PCT.
 */
export function isLessonUnlocked(order: number, previousLessonId: string | undefined): boolean {
  if (order <= 1) return true;
  if (isUnlockAllActive()) return true;
  if (!previousLessonId) return false;
  return isLessonComplete(previousLessonId) && bestScore(previousLessonId) >= UNLOCK_THRESHOLD_PCT;
}
