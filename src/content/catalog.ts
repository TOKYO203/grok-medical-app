// catalog.ts — API publique préservée via Proxy, données fetch côté client.
// Les 3 JSON (~1.2 MiB) ne sont plus importés statiquement. Ils vivent dans
// public/data/ et sont chargés au boot par loadCatalog(). En SSR (worker
// Cloudflare), les listes sont vides → -1045 KiB sur le bundle.
// Aucune route à modifier : BUILTIN_DECKS / getCase / etc. gardent leur API.

import { useSyncExternalStore } from "react";
import type {
  AccessPolicy, CaseStep, ClinicalCase, Competency, Deck, DeckDifficulty,
  DiagnosticCase, Question,
} from "@/core/types";
import { enrichSources } from "@/content/source-registry";
import { fetchWithAuth } from "@/lib/auth/session";
import { emitCatalogVersion } from "@/state/catalog-version";

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

function emit() {
  // Le compteur de version vit dans @/state/catalog-version (cloisonnement
  // G51) : le store — graphe eager — s'y abonne sans importer ce module.
  emitCatalogVersion();
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

/**
 * QUESTIONS PREMIUM — chargées hors de l'index public.
 *
 * `public/data/decks.json` ne contient plus les questions d'un deck payant
 * (correctif P0 du pentest) : il ne porte que `questionCount`. Les questions
 * vivent dans `private/content/decks/<id>.json` et ne sortent que sous jeton
 * de contenu. Elles arrivent donc APRÈS le catalogue, en une seule requête vers
 * `/content/decks/_catalog.json` — jamais 74 allers-retours.
 *
 * Sans jeton (ou jeton expiré) la requête répond 401 : on ne fait rien, les
 * decks premium s'affichent verrouillés avec leur nombre de questions.
 */
const PROTECTED_DECK_CATALOG_URL = "/content/decks/_catalog.json";

/** Événement émis par `@/lib/auth/session` quand un jeton change. */
const CONTENT_SESSION_EVENT = "optimus:content-session";

let deckHydration: Promise<void> | null = null;

function asQuestion(raw: Record<string, any>): Question {
  return {
    id: raw.id,
    prompt: raw.prompt,
    choices: raw.choices,
    correct: raw.correct,
    explanation: raw.explanation,
    sources: enrichSources(raw.sources ?? []),
    difficulty: (raw.difficulty as Question["difficulty"]) ?? "base",
    competency: (raw.competency as Competency) ?? "diagnosis",
  };
}

function asQuestionList(value: unknown): Question[] {
  return Array.isArray(value) ? value.map(asQuestion) : [];
}

/**
 * Récupère les questions protégées et les fusionne dans l'état du catalogue.
 * Idempotent : un deck qui a déjà ses questions n'est jamais réécrit.
 */
export function hydrateProtectedDecks(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (deckHydration) return deckHydration;

  deckHydration = (async () => {
    try {
      const response = await fetchWithAuth(PROTECTED_DECK_CATALOG_URL, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        decks?: Record<string, { questions?: unknown }>;
      };
      const assets = payload?.decks ?? {};

      let changed = false;
      state.decks = state.decks.map((deck) => {
        if (deck.questions.length > 0) return deck;
        const asset = assets[`${deck.id}.json`];
        const questions = asQuestionList(asset?.questions);
        if (questions.length === 0) return deck;
        changed = true;
        return { ...deck, questions };
      });
      if (changed) emit();
    } catch {
      // Hors ligne, garde non configuré, jeton absent : les decks premium
      // restent verrouillés, aucune autre partie du catalogue n'est touchée.
    } finally {
      deckHydration = null;
    }
  })();

  return deckHydration;
}

/**
 * DOSSIERS CLINIQUES FERMÉS — chargés hors de l'index public.
 *
 * `public/data/cases.json` ne contient plus les étapes, le diagnostic ni la
 * prise en charge d'un dossier fermé (§14 du pentest) : il ne porte que
 * `stepCount` et le teaser. Le contenu réel vient de `private/content/cases/`
 * via `/content/cases/_catalog.json`, une seule requête pour les 41 dossiers.
 *
 * Sans jeton la requête répond 401 : les dossiers restent verrouillés avec leur
 * nombre d'étapes annoncé, aucun écran ne casse.
 */
const PROTECTED_CASE_CATALOG_URL = "/content/cases/_catalog.json";

let caseHydration: Promise<void> | null = null;

/** Contenu protégé d'un dossier, tel que le garde le rend. */
type ProtectedCaseAsset = {
  steps?: unknown;
  diagnosis?: unknown;
  management?: unknown;
  pitfall?: unknown;
  keyTakeaway?: unknown;
};

/**
 * Récupère les dossiers protégés et les fusionne dans l'état du catalogue.
 * Idempotent : un dossier qui a déjà ses étapes n'est jamais réécrit.
 */
export function hydrateProtectedCases(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (caseHydration) return caseHydration;

  caseHydration = (async () => {
    try {
      const response = await fetchWithAuth(PROTECTED_CASE_CATALOG_URL, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;

      const payload = (await response.json()) as { cases?: Record<string, ProtectedCaseAsset> };
      const assets = payload?.cases ?? {};

      let changed = false;
      state.cases = state.cases.map((clinical) => {
        if (clinical.steps.length > 0) return clinical;
        // Le garde indexe par nom de fichier : identifiant en minuscules.
        const asset = assets[`${clinical.id.toLowerCase()}.json`];
        if (!asset || !Array.isArray(asset.steps) || asset.steps.length === 0) return clinical;

        changed = true;
        return {
          ...clinical,
          steps: asset.steps as CaseStep[],
          diagnosis:
            typeof asset.diagnosis === "string" ? asset.diagnosis : clinical.diagnosis,
          management:
            typeof asset.management === "string" ? asset.management : clinical.management,
          pitfall: typeof asset.pitfall === "string" ? asset.pitfall : clinical.pitfall,
          keyTakeaway:
            typeof asset.keyTakeaway === "string" ? asset.keyTakeaway : clinical.keyTakeaway,
        };
      });
      if (changed) emit();
    } catch {
      // Hors ligne, garde non configuré, jeton absent : les dossiers restent
      // verrouillés, aucune autre partie du catalogue n'est touchée.
    } finally {
      caseHydration = null;
    }
  })();

  return caseHydration;
}

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
    questions: asQuestionList(raw.questions),
    questionCount: typeof raw.questionCount === "number" ? raw.questionCount : undefined,
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
    .then(async ([d, c, diag]: [any[], any[], any[]]) => {
      state.decks = d.map(asDeck);
      state.cases = c.map(asCase);
      state.diagnostics = diag as DiagnosticCase[];
      state.ready = true;
      // Les questions Premium et les dossiers fermés vivent hors de
      // `public/data` : on les demande au garde AVANT le premier rendu, pour
      // qu'aucun écran ne montre un deck « 0 question » ou un dossier vide à un
      // client qui a payé.
      await Promise.all([hydrateProtectedDecks(), hydrateProtectedCases()]);
      emit();
    })
    .catch((err) => { state.error = err; inflight = null; emit(); });
  return inflight;
}

export function useCatalog() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/**
 * Version du catalogue — incrémentée à chaque arrivée de données.
 *
 * Le hook vit désormais dans `@/state/catalog-version` (cloisonnement G51 :
 * le store, évalué en eager, s'y abonne sans importer ce module) ; on le
 * re-exporte ici pour préserver l'API publique.
 */
export { useCatalogVersion } from "@/state/catalog-version";

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

// Boot client : AUCUNE route n'appelait loadCatalog() depuis le refactor G51 —
// les proxys (decks/cas/diagnostics) restaient donc vides à l'exécution
// (« cas 0 », chapitres « en préparation », fiches introuvables). Le module est
// évalué par la première route consommatrice ; on déclenche le chargement ici,
// une seule fois, côté navigateur uniquement (en SSR les listes restent vides
// par contrat).
if (typeof window !== "undefined") void loadCatalog();

// Un jeton de contenu arrive (activation d'une clé) ou disparaît (expiration,
// déconnexion) : on relance l'hydratation des questions premium pour que le
// catalogue reflète l'accès réel sans rechargement de page.
if (typeof window !== "undefined") {
  window.addEventListener(CONTENT_SESSION_EVENT, () => {
    if (!state.ready) return;
    void hydrateProtectedDecks();
    void hydrateProtectedCases();
  });
}

export function decksForYear(year: number, decks: Deck[]): Deck[] {
  return decks.filter((d) => Math.abs(d.studyYear - year) <= 1 || year === 0);
}

