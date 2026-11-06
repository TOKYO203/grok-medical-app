// catalog.ts — API publique préservée via Proxy, données fetch côté client.
// Les 3 JSON (~1.2 MiB) ne sont plus importés statiquement. Ils vivent dans
// public/data/ et sont chargés au boot par loadCatalog(). En SSR (worker
// Cloudflare), les listes sont vides → -1045 KiB sur le bundle.
// Aucune route à modifier : BUILTIN_DECKS / getCase / etc. gardent leur API.

import { useSyncExternalStore } from "react";
import type {
  AccessPolicy, ClinicalCase, Competency, Deck, DeckDifficulty,
  DiagnosticCase, Question,
} from "@/core/types";
import { enrichSources } from "@/content/source-registry";

// ─── État central ──────────────────────────────────────────────────────────
type CatalogState = {
  decks: Deck[];
  cases: ClinicalCase[];
  diagnostics: DiagnosticCase[];
  ready: boolean;
  error: Error | null;
};

const state: CatalogState = { decks: [], cases: [], diagnostics: [], ready: false, error: null };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

// ─── Transformations (identiques à avant) ──────────────────────────────────
function asDeck(raw: Record<string, any>): Deck {
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
    questions: ((raw.questions ?? []) as any[]).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: q.choices,
      correct: q.correct,
      explanation: q.explanation,
      sources: enrichSources(q.sources ?? []),
      difficulty: (q.difficulty as Question["difficulty"]) ?? "base",
      competency: (q.competency as Competency) ?? "diagnosis",
    })),
    sources: enrichSources(raw.sources ?? []),
    access_policy: (raw.access_policy as AccessPolicy) ?? { tier: "free", entitlement: "OPTIMUS_FREE" },
    chapters: raw.chapters ?? [],
  } as Deck;
}

function asCase(raw: Record<string, any>): ClinicalCase {
  return { ...raw, sources: enrichSources(raw.sources ?? []) } as ClinicalCase;
}

// ─── Loader ────────────────────────────────────────────────────────────────
export function loadCatalog(): Promise<void> {
  if (state.ready) return Promise.resolve();
  if (inflight) return inflight;
  if (typeof window === "undefined") return Promise.resolve();
  inflight = Promise.all([
    fetch("/data/decks.json").then((r) => r.json()),
    fetch("/data/cases.json").then((r) => r.json()),
    fetch("/data/diagnostics.json").then((r) => r.json()),
  ])
    .then(([d, c, diag]: [any[], any[], any[]]) => {
      state.decks = d.map(asDeck);
      state.cases = c.map(asCase);
      state.diagnostics = diag as DiagnosticCase[];
      state.ready = true;
      emit();
    })
    .catch((err) => { state.error = err; inflight = null; emit(); });
  return inflight;
}

export function useCatalog() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// ─── Proxies (compat API, aucune route à modifier) ─────────────────────────
function proxiedArray<T>(getArr: () => T[]): T[] {
  return new Proxy([] as T[], {
    get(_t, prop) {
      const arr = getArr();
      const v = (arr as any)[prop];
      return typeof v === "function" ? v.bind(arr) : v;
    },
    has(_t, prop) { return prop in getArr(); },
    ownKeys() { return Reflect.ownKeys(getArr()); },
    getOwnPropertyDescriptor(_t, prop) {
      return Object.getOwnPropertyDescriptor(getArr(), prop)
        ?? { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

export const BUILTIN_DECKS: Deck[] = proxiedArray(() => state.decks);
export const CLINICAL_CASES: ClinicalCase[] = proxiedArray(() => state.cases);
export const DIAGNOSTIC_CASES: DiagnosticCase[] = proxiedArray(() => state.diagnostics);

export function getBuiltinDeck(id: string): Deck | undefined {
  return state.decks.find((d) => d.id === id || d.deck_id === id);
}
export function getCase(id: string): ClinicalCase | undefined {
  return state.cases.find((c) => c.id === id);
}
export function getDiagnostic(id: string): DiagnosticCase | undefined {
  return state.diagnostics.find((d) => d.id === id);
}

// ─── Constantes (inchangées) ───────────────────────────────────────────────
export const YEARS = [
  { year: 1, label: "1re année", focus: "Anatomie, histologie" },
  { year: 2, label: "2e année", focus: "Physiologie, pharmacologie" },
  { year: 3, label: "3e année", focus: "Sémiologie" },
  { year: 4, label: "4e année", focus: "Pathologie, infectiologie" },
  { year: 5, label: "5e année", focus: "Raisonnement clinique" },
  { year: 6, label: "6e année", focus: "Urgences, internat" },
] as const;

export const PROFESSIONAL_LEVELS = [
  { id: "intern", label: "Interne", focus: "Internat et gardes" },
  { id: "junior", label: "Médecin junior", focus: "Début de pratique" },
  { id: "senior", label: "Médecin senior", focus: "Pratique confirmée" },
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
