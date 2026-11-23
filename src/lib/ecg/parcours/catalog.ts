import parcoursManifest from "@/content/data/ecg/parcours/_parcours.json";
import levelAIndex from "@/content/data/ecg/parcours/A/_lecons.json";
import lessonA01 from "@/content/data/ecg/parcours/A/A-01-papier.json";
import lessonA02 from "@/content/data/ecg/parcours/A/A-02-derivations.json";
import lessonA03 from "@/content/data/ecg/parcours/A/A-03-axe.json";
import lessonA04 from "@/content/data/ecg/parcours/A/A-04-sept-etapes.json";
import lessonA05 from "@/content/data/ecg/parcours/A/A-05-pieges.json";

import type { Level, Lesson, LessonIndex, ParcoursManifest } from "./types";

// PR 1 : seul le niveau A est branché. Les autres sont `null` (non disponibles).
// Chaque nouvelle PR (B, C, D, E) ajoutera son import + son entrée ici.
const LEVEL_INDEX: Record<Level, LessonIndex | null> = {
  A: levelAIndex as unknown as LessonIndex,
  B: null,
  C: null,
  D: null,
  E: null,
};

const LESSONS_BY_ID: Record<string, Lesson> = {
  "A-01": lessonA01 as unknown as Lesson,
  "A-02": lessonA02 as unknown as Lesson,
  "A-03": lessonA03 as unknown as Lesson,
  "A-04": lessonA04 as unknown as Lesson,
  "A-05": lessonA05 as unknown as Lesson,
};

export function getParcours(): ParcoursManifest {
  return parcoursManifest as unknown as ParcoursManifest;
}

export function getLevelIndex(level: Level): LessonIndex | null {
  return LEVEL_INDEX[level];
}

export function listLevelLessons(level: Level) {
  return LEVEL_INDEX[level]?.lessons ?? [];
}

export function getLesson(id: string): Lesson | undefined {
  return LESSONS_BY_ID[id];
}

export function isLevelAvailable(level: Level): boolean {
  return LEVEL_INDEX[level] !== null;
}

export function countLessonsForLevel(level: Level): number {
  return LEVEL_INDEX[level]?.lessons.length ?? 0;
}

export function isLevel(letter: string): letter is Level {
  return ["A", "B", "C", "D", "E"].includes(letter);
}
