import decksJson from "./data/decks.json";
import casesJson from "./data/cases.json";
import diagnosticsJson from "./data/diagnostics.json";
import type { AccessPolicy, ClinicalCase, Competency, Deck, DeckDifficulty, DiagnosticCase, Question } from "@/core/types";

function asDeck(raw: (typeof decksJson)[number]): Deck {
  return {
    id: raw.id,
    deck_id: raw.deck_id ?? raw.id,
    schema_version: raw.schema_version ?? 2,
    version: raw.version ?? "2.0.0",
    title: raw.title,
    subtitle: raw.subtitle ?? "",
    subject: raw.subject ?? raw.specialty ?? "Clinique",
    specialty: raw.specialty ?? "Clinique",
    studyYear: raw.studyYear ?? 5,
    difficulty: (raw.difficulty as DeckDifficulty) ?? "intermediate",
    competencies: (raw.competencies ?? ["diagnosis"]) as Competency[],
    icon: raw.icon ?? "book",
    questions: raw.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: q.choices,
      correct: q.correct,
      explanation: q.explanation,
      sources: q.sources ?? [],
      difficulty: (q.difficulty as Question["difficulty"]) ?? "base",
      competency: (q.competency as Competency) ?? "diagnosis",
    })),
    sources: raw.sources ?? [],
    access_policy: (raw.access_policy as AccessPolicy) ?? { tier: "free", entitlement: "OPTIMUS_FREE" },
    chapters: raw.chapters ?? [],
  };
}

export const BUILTIN_DECKS: Deck[] = decksJson.map(asDeck);
export const CLINICAL_CASES = casesJson as ClinicalCase[];
export const DIAGNOSTIC_CASES = diagnosticsJson as DiagnosticCase[];

export function getBuiltinDeck(id: string): Deck | undefined {
  return BUILTIN_DECKS.find((d) => d.id === id || d.deck_id === id);
}

export function getCase(id: string): ClinicalCase | undefined {
  return CLINICAL_CASES.find((c) => c.id === id);
}

export function getDiagnostic(id: string): DiagnosticCase | undefined {
  return DIAGNOSTIC_CASES.find((d) => d.id === id);
}

export const YEARS = [
  { year: 1, label: "1re année", focus: "Anatomie, histologie" },
  { year: 2, label: "2e année", focus: "Physiologie, pharmacologie" },
  { year: 3, label: "3e année", focus: "Sémiologie" },
  { year: 4, label: "4e année", focus: "Pathologie, infectiologie" },
  { year: 5, label: "5e année", focus: "Raisonnement clinique" },
  { year: 6, label: "6e année", focus: "Urgences, internat" },
] as const;

export const GOALS = [
  { id: "edn", label: "EDN / collèges" },
  { id: "internat", label: "Internat qualifiant" },
  { id: "clinic", label: "Garde et clinique" },
  { id: "review", label: "Réviser une matière" },
] as const;

export function decksForYear(year: number, decks: Deck[]): Deck[] {
  return decks.filter((d) => Math.abs(d.studyYear - year) <= 1 || year === 0);
}
