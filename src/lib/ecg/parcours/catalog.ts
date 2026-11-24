import parcoursManifest from "@/content/data/ecg/parcours/_parcours.json";
import levelAIndex from "@/content/data/ecg/parcours/A/_lecons.json";
import lessonA01 from "@/content/data/ecg/parcours/A/A-01-papier.json";
import lessonA02 from "@/content/data/ecg/parcours/A/A-02-derivations.json";
import lessonA03 from "@/content/data/ecg/parcours/A/A-03-axe.json";
import lessonA04 from "@/content/data/ecg/parcours/A/A-04-sept-etapes.json";
import lessonA05 from "@/content/data/ecg/parcours/A/A-05-pieges.json";
import levelBIndex from "@/content/data/ecg/parcours/B/_lecons.json";
import lessonB01 from "@/content/data/ecg/parcours/B/B-01-sinusal.json";
import lessonB02 from "@/content/data/ecg/parcours/B/B-02-bav.json";
import lessonB03 from "@/content/data/ecg/parcours/B/B-03-blocs-branche.json";
import lessonB04 from "@/content/data/ecg/parcours/B/B-04-digitalique.json";
import lessonB05 from "@/content/data/ecg/parcours/B/B-05-jonctionnel.json";
import levelCIndex from "@/content/data/ecg/parcours/C/_lecons.json";
import lessonC01 from "@/content/data/ecg/parcours/C/C-01-sca-st-plus.json";
import lessonC02 from "@/content/data/ecg/parcours/C/C-02-sca-st-moins.json";
import lessonC03 from "@/content/data/ecg/parcours/C/C-03-fa-flutter.json";
import lessonC04 from "@/content/data/ecg/parcours/C/C-04-tv-torsades.json";
import lessonC05 from "@/content/data/ecg/parcours/C/C-05-oap.json";
import levelDIndex from "@/content/data/ecg/parcours/D/_lecons.json";
import lessonD01 from "@/content/data/ecg/parcours/D/D-01-hyperkaliemie.json";
import lessonD02 from "@/content/data/ecg/parcours/D/D-02-hypothermie.json";
import lessonD03 from "@/content/data/ecg/parcours/D/D-03-pericardite.json";
import lessonD04 from "@/content/data/ecg/parcours/D/D-04-brugada.json";
import lessonD05 from "@/content/data/ecg/parcours/D/D-05-pacemaker.json";

import type { Level, Lesson, LessonIndex, ParcoursManifest } from "./types";

// PR 1 : seul le niveau A est branché. Les autres sont `null` (non disponibles).
// Chaque nouvelle PR (B, C, D, E) ajoutera son import + son entrée ici.
const LEVEL_INDEX: Record<Level, LessonIndex | null> = {
  A: levelAIndex as unknown as LessonIndex,
  B: levelBIndex as unknown as LessonIndex,
  C: levelCIndex as unknown as LessonIndex,
  D: levelDIndex as unknown as LessonIndex,
  E: null,
};

const LESSONS_BY_ID: Record<string, Lesson> = {
  "A-01": lessonA01 as unknown as Lesson,
  "A-02": lessonA02 as unknown as Lesson,
  "A-03": lessonA03 as unknown as Lesson,
  "A-04": lessonA04 as unknown as Lesson,
  "A-05": lessonA05 as unknown as Lesson,
  "B-01": lessonB01 as unknown as Lesson,
  "B-02": lessonB02 as unknown as Lesson,
  "B-03": lessonB03 as unknown as Lesson,
  "B-04": lessonB04 as unknown as Lesson,
  "B-05": lessonB05 as unknown as Lesson,
  "C-01": lessonC01 as unknown as Lesson,
  "C-02": lessonC02 as unknown as Lesson,
  "C-03": lessonC03 as unknown as Lesson,
  "C-04": lessonC04 as unknown as Lesson,
  "C-05": lessonC05 as unknown as Lesson,
  "D-01": lessonD01 as unknown as Lesson,
  "D-02": lessonD02 as unknown as Lesson,
  "D-03": lessonD03 as unknown as Lesson,
  "D-04": lessonD04 as unknown as Lesson,
  "D-05": lessonD05 as unknown as Lesson,
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
