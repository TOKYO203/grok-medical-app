// Types du parcours pédagogique ECG (A → E)
// PR 1 : fondation. Niveau A seul pour l'instant, les autres suivront.

export type Level = "A" | "B" | "C" | "D" | "E";

export interface LevelMeta {
  id: Level;
  title: string;
  subtitle: string;
  description: string;
  objective: string;
  estimatedMin: number;
}

export interface ParcoursManifest {
  version: number;
  levels: LevelMeta[];
}

export interface LessonMeta {
  id: string;
  level: Level;
  order: number;
  title: string;
  durationMin: number;
}

export interface LessonIndex {
  level: Level;
  lessons: LessonMeta[];
}

export type ContentBlock =
  | { type: "text"; markdown: string }
  | { type: "callout"; tone: "info" | "warning" | "danger" | "success"; title?: string; markdown: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "image"; src: string; caption?: string; alt?: string };

export interface CheckQuizQuestion {
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  level: Level;
  order: number;
  title: string;
  durationMin: number;
  objectives: string[];
  content: ContentBlock[];
  keyPoints: string[];
  checkQuiz: CheckQuizQuestion[];
  caseStudy?: string;
}
