// Catalogue du module « Examen clinique » — parcours guidé par système.
//
// Modèle ECG : les métadonnées de navigation vivent ici, en TypeScript, sans
// payload pédagogique. Les leçons sont des JSON servis à la demande :
//   • leçon 1 : actif PUBLIC (public/content/examen-clinique/neuro-01.json),
//     la vitrine du module, lisible sans licence ;
//   • leçons 2 à 10 : private/content/examen-clinique/, servies sous jeton de
//     contenu par le garde commun /content/$type/$file (famille
//     "examen-clinique").
//
// ⚠️ Aucun JSON de leçon n est importé statiquement : rien du contenu premium
// ne doit entrer dans le bundle client (scripts/bundle-content.test.mjs).

import { fetchWithAuth } from "@/lib/auth/session";
import type { Lesson, LessonMeta, SystemMeta } from "./types";

export const EXAMEN_CLINIQUE_ASSET_BASE = "/content/examen-clinique";

export const NEURO_SYSTEM: SystemMeta = {
  id: "NEURO",
  title: "Neurologie",
  subtitle: "Du GCS aux réflexes",
  description:
    "Le système d examen le plus redouté des étudiants, déroulé en 10 leçons guidées : un ordre, des gestes précis, un vocabulaire reproductible.",
  objective:
    "Dérouler un examen neurologique complet, orienté et reproductible — et décrire ce qu on voit avec le bon vocabulaire.",
  estimatedMin: 108,
};

/** Ordre éditorial NEURO : leçon 1 publique, 2-9 thématiques, 10 examen final. */
export const NEURO_LESSONS: LessonMeta[] = [
  { id: "neuro-01", system: "NEURO", order: 1, title: "Les 9 temps de l examen neurologique", durationMin: 8, isFree: true },
  { id: "neuro-02", system: "NEURO", order: 2, title: "Conscience : le GCS en pratique", durationMin: 10 },
  { id: "neuro-03", system: "NEURO", order: 3, title: "Langage : dépister une aphasie en 3 minutes", durationMin: 10 },
  { id: "neuro-04", system: "NEURO", order: 4, title: "Les paires crâniennes, de I à XII", durationMin: 12 },
  { id: "neuro-05", system: "NEURO", order: 5, title: "Motricité : tonus et force (MRC 0 à 5)", durationMin: 10 },
  { id: "neuro-06", system: "NEURO", order: 6, title: "Réflexes : ROT, Babinski et cutanés", durationMin: 10 },
  { id: "neuro-07", system: "NEURO", order: 7, title: "Sensibilité : modes et topographie", durationMin: 10 },
  { id: "neuro-08", system: "NEURO", order: 8, title: "Coordination : cérébellum et Romberg", durationMin: 8 },
  { id: "neuro-09", system: "NEURO", order: 9, title: "Syndrome méningé et examen du comateux", durationMin: 10 },
  { id: "neuro-10", system: "NEURO", order: 10, title: "Examen final — Neurologie", durationMin: 20, isExam: true, passThreshold: 80 },
];

/** Id de la leçon d ordre N-1 (règle de déblocage progressif). */
export function previousLessonId(order: number): string | undefined {
  const previous = NEURO_LESSONS.find((lesson) => lesson.order === order - 1);
  return previous === undefined ? undefined : previous.id;
}

export type LessonLoad =
  | { status: "ok"; data: Lesson }
  | { status: "locked" }
  | { status: "missing" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isContentBlock(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const block = value as { type?: unknown };
  return (
    block.type === "text" ||
    block.type === "callout" ||
    block.type === "table" ||
    block.type === "list" ||
    block.type === "image"
  );
}

function isCheckQuizQuestion(value: unknown): value is Lesson["checkQuiz"][number] {
  if (value === null || typeof value !== "object") return false;
  const q = value as { question?: unknown; choices?: unknown; correct?: unknown; explanation?: unknown };
  return (
    isNonEmptyString(q.question) &&
    Array.isArray(q.choices) &&
    q.choices.every(isNonEmptyString) &&
    typeof q.correct === "number" &&
    q.correct >= 0 &&
    typeof q.explanation === "string"
  );
}

function isLesson(value: unknown): value is Lesson {
  if (value === null || typeof value !== "object") return false;
  const lesson = value as Partial<Lesson>;
  return (
    isNonEmptyString(lesson.id) &&
    isNonEmptyString(lesson.title) &&
    Array.isArray(lesson.objectives) &&
    lesson.objectives.every(isNonEmptyString) &&
    Array.isArray(lesson.content) &&
    lesson.content.every(isContentBlock) &&
    Array.isArray(lesson.keyPoints) &&
    Array.isArray(lesson.checkQuiz) &&
    lesson.checkQuiz.every(isCheckQuizQuestion)
  );
}

/** 401/403 (pas de licence ou jeton expiré) et 503 (garde non configuré). */
function isClosedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 503;
}

const lessonCache = new Map<string, LessonLoad>();

function cache(id: string, value: LessonLoad): LessonLoad {
  lessonCache.set(id, value);
  return value;
}

/**
 * Charge une leçon : leçon 1 en actif public (simple fetch), les autres sous
 * jeton (fetchWithAuth). Ne lève jamais : la page affiche l état.
 */
export async function loadLesson(id: string): Promise<LessonLoad> {
  const cached = lessonCache.get(id);
  if (cached) return cached;

  const meta = NEURO_LESSONS.find((lesson) => lesson.id === id);
  const url = EXAMEN_CLINIQUE_ASSET_BASE + "/" + id + ".json";

  try {
    const response = meta?.isFree
      ? await fetch(url, { headers: { accept: "application/json" } })
      : await fetchWithAuth(url, { headers: { accept: "application/json" } });

    if (isClosedStatus(response.status)) return cache(id, { status: "locked" });
    if (!response.ok) return cache(id, { status: "missing" });

    const raw = (await response.json()) as unknown;
    if (!isLesson(raw)) return cache(id, { status: "missing" });
    return cache(id, { status: "ok", data: raw });
  } catch {
    return { status: "missing" };
  }
}
