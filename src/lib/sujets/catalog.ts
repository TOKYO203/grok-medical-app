/**
 * Catalogue des **sujets** — la jointure entre une décision éditoriale
 * (`src/content/data/sujets.ts`) et les catalogues réels du dépôt.
 *
 * Un sujet existe parce qu'un étudiant cherche « le SCA », pas « le deck
 * `cardio-sca-l3` ». La page `/sujet/<slug>` a donc besoin de réunir, pour un
 * même sujet, sept natures de contenu qui vivent dans sept dossiers différents :
 *
 *   decks (curriculum) · cas cliniques · démarches · ECG · sons · scores ·
 *   items officiels du référentiel national.
 *
 * Ce module ne décide **rien** : il résout. Les identifiants viennent du
 * fichier de données (relu), le contenu vient des catalogues (source de
 * vérité), et tout identifiant qui ne résout pas est simplement absent —
 * `scripts/sujet-page.test.mjs` est là pour qu'il n'y en ait aucun.
 *
 * ⚠️ Les trois fichiers `_index.json` (ECG, auscultation, démarches) sont lus
 * **directement** : la page n'a besoin que des métadonnées (titre, difficulté,
 * foyer). Passer par `@/lib/ecg/catalog` embarquerait les 23 tracés complets
 * dans le chunk de la page. Les fiches complètes restent chargées par leur
 * propre route.
 */

import { CLINICAL_CASES } from "@/content/catalog";
import { getDefaultProgramme } from "@/content/programme";
import { listCurricula } from "@/content/curriculum";
import auscultationIndex from "@/content/data/auscultation/_index.json";
import demarchesIndex from "@/content/data/demarches/_index.json";
import ecgIndex from "@/content/data/ecg/_index.json";
import type { Sujet, SujetCalcul } from "@/content/data/sujets";
import type { DemarcheIndexEntry } from "@/core/demarche";
import type { ClinicalCase, Deck } from "@/core/types";
import { buildDeckSeries, type DeckSeries } from "@/lib/library/deck-series";
import type { AuscultationSoundEntry } from "@/lib/auscultation/catalog";

/* ───────────────────────────── Items officiels ───────────────────────────── */

/**
 * Un item du référentiel national, repéré par son **ordinal global** (1 → 240).
 *
 * Le fichier officiel numérote par section (`n` repart à 1) ; `/programme`
 * affiche ce numéro local. Un sujet, lui, doit citer « item 61 » — un espace de
 * nombres unique, vérifiable, comparable à ce que l'étudiant lit dans son
 * polycopié. L'ordinal est recalculé ici à partir des tailles réelles de
 * sections : aucune constante 41/175 codée en dur, donc un référentiel qui
 * gagne une section ne peut pas décaler silencieusement les numéros (le test
 * verrouille quand même les tailles attendues).
 */
export type OfficialItem = {
  ordinal: number;
  sectionId: string;
  sectionLabel: string;
  id: string;
  title: string;
  specialty: string;
};

const PROGRAMME = getDefaultProgramme();

/** Tailles des sections du référentiel par défaut (contrôlées par le test). */
export const OFFICIAL_SECTION_SIZES: { id: string; label: string; size: number }[] = (
  PROGRAMME?.sections ?? []
).map((section) => ({ id: section.id, label: section.label, size: section.items.length }));

const OFFICIAL_BY_ORDINAL: Map<number, OfficialItem> = (() => {
  const map = new Map<number, OfficialItem>();
  let offset = 0;
  for (const section of PROGRAMME?.sections ?? []) {
    for (const item of section.items) {
      map.set(offset + item.n, {
        ordinal: offset + item.n,
        sectionId: section.id,
        sectionLabel: section.label,
        id: item.id,
        title: item.title,
        specialty: item.specialty,
      });
    }
    offset += section.items.length;
  }
  return map;
})();

/** Item officiel par ordinal global, ou `undefined` hors référentiel. */
export function getOfficialItem(ordinal: number): OfficialItem | undefined {
  return OFFICIAL_BY_ORDINAL.get(ordinal);
}

/** Items officiels d'un sujet, dans l'ordre déclaré (les orphelins sont écartés). */
export function listOfficialItems(ordinals: number[]): OfficialItem[] {
  return ordinals.flatMap((ordinal) => {
    const item = OFFICIAL_BY_ORDINAL.get(ordinal);
    return item ? [item] : [];
  });
}

/* ────────────────────────────── Contenus liés ────────────────────────────── */

export type EcgRef = {
  id: string;
  title: string;
  difficulty: string;
  rhythm: string;
  specialty: string;
};

export type SoundRef = {
  id: string;
  label: string;
  categorie: string;
  foyers: string[];
  available: boolean;
};

const ECG_BY_ID = new Map<string, EcgRef>(
  (ecgIndex as { cases: EcgRef[] }).cases.map((entry) => [entry.id, entry]),
);

const SOUNDS_BY_ID = new Map<string, SoundRef>(
  (auscultationIndex as { sounds: AuscultationSoundEntry[] }).sounds.map((entry) => [
    entry.id,
    {
      id: entry.id,
      label: entry.label,
      categorie: entry.categorie,
      foyers: entry.foyers,
      available: entry.status === "available",
    },
  ]),
);

const DEMARCHES_BY_ID = new Map<string, DemarcheIndexEntry>(
  (demarchesIndex as { demarches: DemarcheIndexEntry[] }).demarches.map((entry) => [
    entry.diagnosticId,
    entry,
  ]),
);

/**
 * Escalier de decks qui correspond au sujet : la série (branche du curriculum)
 * dont **au moins deux** marches figurent parmi les decks du sujet.
 *
 * Un sujet peut n'avoir qu'un deck (AVC) : il n'y a alors pas d'escalier, et la
 * page affiche une carte simple. On ne fabrique pas une progression d'une
 * marche.
 */
export function findSujetSeries(sujet: Sujet, decks: readonly Deck[]): DeckSeries | null {
  const titles = new Map(decks.map((deck) => [deck.id, deck.title]));
  const owned = new Set(sujet.decks);
  let best: { series: DeckSeries; matches: number } | null = null;

  for (const series of buildDeckSeries(listCurricula(), titles)) {
    const matches = series.steps.filter((step) => owned.has(step.deckId)).length;
    if (matches >= 2 && (!best || matches > best.matches)) best = { series, matches };
  }

  return best?.series ?? null;
}

/** Tout ce qu'une page sujet doit afficher, déjà résolu. */
export type SujetContent = {
  sujet: Sujet;
  officialItems: OfficialItem[];
  decks: Deck[];
  cases: ClinicalCase[];
  demarches: DemarcheIndexEntry[];
  ecg: EcgRef[];
  sounds: SoundRef[];
  calculators: SujetCalcul[];
  /** Escalier couvrant les decks du sujet, ou `null` (sujet à deck unique). */
  series: DeckSeries | null;
  /** Nombre de questions des decks du sujet. */
  questionCount: number;
  counts: {
    officialItems: number;
    decks: number;
    cases: number;
    demarches: number;
    ecg: number;
    sounds: number;
    calculators: number;
    total: number;
  };
};

/**
 * Joint un sujet aux catalogues.
 *
 * @param decks decks réellement disponibles pour ce profil (`useAllDecks()`) :
 *              les decks importés ou un catalogue personnalisé sont pris en
 *              compte, et un deck retiré du catalogue disparaît proprement.
 */
export function buildSujetContent(sujet: Sujet, decks: readonly Deck[]): SujetContent {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const sujetDecks = sujet.decks.flatMap((deckId) => {
    const deck = deckById.get(deckId);
    return deck ? [deck] : [];
  });

  const caseById = new Map(CLINICAL_CASES.map((entry) => [entry.id, entry]));
  const sujetCases = sujet.cases.flatMap((caseId) => {
    const clinical = caseById.get(caseId);
    return clinical ? [clinical] : [];
  });

  const demarches = sujet.demarches.flatMap((id) => {
    const entry = DEMARCHES_BY_ID.get(id);
    return entry ? [entry] : [];
  });

  const ecg = sujet.ecg.flatMap((id) => {
    const entry = ECG_BY_ID.get(id);
    return entry ? [entry] : [];
  });

  const sounds = sujet.auscultation.flatMap((id) => {
    const entry = SOUNDS_BY_ID.get(id);
    return entry ? [entry] : [];
  });

  // Les scores sont portés par la donnée éditoriale (id + libellé) : le
  // registre des calculateurs, qui embarque 78 fonctions de calcul, n'a pas à
  // être chargé pour afficher trois lignes de liens.
  const calculators = sujet.calculateurs;

  const questionCount = sujetDecks.reduce((sum, deck) => sum + deck.questions.length, 0);
  const counts = {
    officialItems: sujet.itemsOfficiels.length,
    decks: sujetDecks.length,
    cases: sujetCases.length,
    demarches: demarches.length,
    ecg: ecg.length,
    sounds: sounds.length,
    calculators: calculators.length,
    total:
      sujet.itemsOfficiels.length +
      sujetDecks.length +
      sujetCases.length +
      demarches.length +
      ecg.length +
      sounds.length +
      calculators.length,
  };

  return {
    sujet,
    officialItems: listOfficialItems(sujet.itemsOfficiels),
    decks: sujetDecks,
    cases: sujetCases,
    demarches,
    ecg,
    sounds,
    calculators,
    series: findSujetSeries(sujet, decks),
    questionCount,
    counts,
  };
}
