// Types du module « Examen clinique » — parcours guidés par système.
// Phase 1 : NEURO seul. Les autres systèmes suivront (GEN, CARDIO, PULMO,
// ABDO, RXMAG, OBJ) en réutilisant exactement ces contrats.

export type System = "NEURO";

export interface SystemMeta {
  id: System;
  title: string;
  subtitle: string;
  description: string;
  objective: string;
  estimatedMin: number;
}

export interface LessonMeta {
  id: string;
  system: System;
  order: number;
  title: string;
  durationMin: number;
  /** Leçon 1 : actif public, lisible sans licence (vitrine du module). */
  isFree?: boolean;
  /** Dernière leçon : examen final noté avec seuil de réussite. */
  isExam?: boolean;
  /** Seuil (%) de réussite de l examen final. */
  passThreshold?: number;
}

export type ContentBlock =
  | { type: "text"; markdown: string }
  | { type: "callout"; tone: "info" | "warning" | "danger" | "success"; title?: string; markdown: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "steps"; items: { n: string; title: string; text: string }[] }
  | { type: "image"; src: string; caption?: string; alt?: string };

export interface CheckQuizQuestion {
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  system: System;
  order: number;
  title: string;
  durationMin: number;
  objectives: string[];
  content: ContentBlock[];
  keyPoints: string[];
  checkQuiz: CheckQuizQuestion[];
  isExam?: boolean;
  passThreshold?: number;
}
