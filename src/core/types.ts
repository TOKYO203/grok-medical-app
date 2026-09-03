export const COMPETENCIES = [
  "recognize",
  "semiology",
  "diagnostic_orientation",
  "diagnosis",
  "management",
  "clinical_reasoning",
] as const;

export type Competency = (typeof COMPETENCIES)[number];

export const COMPETENCY_LABEL: Record<Competency, string> = {
  recognize: "Reconnaître",
  semiology: "Sémiologie",
  diagnostic_orientation: "Orientation",
  diagnosis: "Diagnostic",
  management: "Prise en charge",
  clinical_reasoning: "Raisonnement",
};

export type Difficulty = "base" | "avance";
export type DeckDifficulty = "intro" | "intermediate" | "advanced";
export type AccessTier = "free" | "pro";
export type AccountTier = "guest" | "free" | "pro";

export type Source = {
  title: string;
  citation: string;
  organization?: string;
  year?: number;
  version?: string;
  url?: string;
  doi?: string;
  verifiedAt?: string;
};

export type Question = {
  id: string;
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string;
  sources: Source[];
  difficulty: Difficulty;
  competency: Competency;
};

export type Chapter = { id: string; title: string };

export type AccessPolicy = {
  tier: AccessTier;
  entitlement: string;
};

export type Deck = {
  id: string;
  deck_id: string;
  schema_version: number;
  version: string;
  title: string;
  subtitle: string;
  subject: string;
  specialty: string;
  studyYear: number;
  difficulty: DeckDifficulty;
  competencies: Competency[];
  icon: string;
  questions: Question[];
  sources: Source[];
  access_policy: AccessPolicy;
  chapters: Chapter[];
  imported?: boolean;
};

export type ReviewStats = {
  correct: number;
  wrong: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
  repetitions: number;
  successes: number;
  failures: number;
};

export type DeckProgress = {
  seen: Record<string, ReviewStats>;
  completedLessons: number[];
};

export type Entitlement = {
  id: string;
  product: string;
  issuedAt: number;
  expiresAt: number | null;
};

export type SyncEventType =
  | "QUESTION_ANSWERED"
  | "REVIEW_COMPLETED"
  | "CASE_COMPLETED"
  | "ACHIEVEMENT_UNLOCKED"
  | "CONTACT_MESSAGE";

export type SyncEvent = {
  id: string;
  type: SyncEventType;
  payload: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
};

export type ContactDraft = {
  id: string;
  kind: "contact" | "bug" | "correction" | "deck" | "idea";
  body: string;
  createdAt: number;
  sent: boolean;
};

export type CoverId = "hautes-terres" | "baobab" | "canal" | "clinique" | "custom";

export type Profile = {
  displayName: string;
  optimusId: string;
  deviceId: string;
  tier: AccountTier;
  studyYear: number;
  country: string;
  faculty: string;
  goal: string;
  prioritySubjects: string[];
  avatar: string;
  cover: CoverId;
  coverDataUrl: string | null;
  onboarded: boolean;
};

export type CaseStepReveal = { kind: "reveal"; title: string; body: string };
export type CaseStepQuestion = {
  kind: "question";
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string;
};
export type CaseStep = CaseStepReveal | CaseStepQuestion;

export type ClinicalCase = {
  id: string;
  title: string;
  specialty: string;
  studyYear: number;
  difficulty: string;
  summary: string;
  patient: { age: number; sex: string; context: string };
  steps: CaseStep[];
  diagnosis: string;
  management: string;
  sources: Source[];
  access?: AccessTier;
};

export type DiagnosticStep = {
  id: string;
  title: string;
  lead: string;
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string;
};

export type DiagnosticCase = {
  id: string;
  title: string;
  specialty: string;
  vignette: string;
  steps: DiagnosticStep[];
  synthesis: string;
};
