/**
 * Séries de decks — « l'escalier ».
 *
 * Problème résolu : un deck n'est pas un sujet, c'est **une strate de niveau**
 * d'un sujet. Les 36 decks de cardiologie sont en réalité 7 pathologies ×
 * 5 strates (+1 deck de bases). Les afficher à plat (une carte par deck)
 * produit 36 cartes pour 7 sujets → l'utilisateur ne retrouve plus le sujet,
 * il voit cinq variantes du même titre.
 *
 * Une **série** = une branche du curriculum qui porte au moins 2 decks.
 *  - le libellé de la série   → le libellé de la branche (« SCA — Syndrome… ») ;
 *  - les étapes               → les decks de la branche, dans l'ordre déclaré
 *                               (l'auteur du curriculum les a déjà rangés par
 *                               niveau, du plus junior au plus avancé) ;
 *  - le libellé d'une étape   → déduit du titre du deck (« notions »,
 *                               « sémiologie », « prise en charge »…), jamais
 *                               du niveau seul : « L4 » ne dit pas ce qu'on
 *                               apprend, « Diagnostic » si.
 *
 * Module **pur** : aucun import runtime (les curricula et les titres sont
 * passés en argument). Il est donc testable sous
 * `node --experimental-strip-types` sans résolution d'alias `@/`, et il ne
 * peut pas inventer de contenu : sans titre, il ne devine pas.
 */

import type { CurriculumSpecialty, Level } from "@/core/curriculum";

export type DeckSeriesStep = {
  deckId: string;
  /** Position 0-based dans l'escalier. */
  index: number;
  /** Libellé court de l'étape : « Notions », « Sémiologie », « Diagnostic »… */
  label: string;
  /** Niveau déduit de l'id du deck (repli : dernier niveau de la branche). */
  level: Level | null;
};

export type DeckSeries = {
  /** Identifiant stable de la série : `<specialtyId>:<branchId>`. */
  id: string;
  specialtyId: string;
  specialtyLabel: string;
  branchId: string;
  /** Libellé complet de la branche — titre de la carte. */
  label: string;
  /** Libellé court (avant le tiret cadratin) : « SCA », « OAP »… */
  short: string;
  icon: string;
  description: string;
  steps: DeckSeriesStep[];
};

/**
 * Titres de decks dont le suffixe n'est pas un nom d'étape exploitable.
 * Toute entrée ici est un choix éditorial explicite, à valider par le
 * propriétaire du contenu — pas une heuristique cachée.
 */
const STEP_LABEL_OVERRIDES: Record<string, string> = {
  // « SCA — Syndrome Coronarien Aigu » (L5) : le suffixe est le développement
  // de l'acronyme, pas une étape. C'est le palier de synthèse de la série.
  "cardio-sca-l5": "Synthèse",
  // OAP : les deux derniers paliers s'appellent « prise en charge initiale »
  // et « prise en charge avancée ». Sans ces deux entrées, l'escalier
  // affichait deux fois « Prise en charge » — impossible de savoir laquelle
  // est la marche suivante.
  "cardio-oap-l4": "PEC initiale",
  "cardio-oap-l5": "PEC avancée",
};

/**
 * Vocabulaire d'étapes, par ordre de priorité.
 *
 * L'ordre compte : « stratégie thérapeutique » doit donner « Stratégie » et non
 * « Prise en charge » ; « diagnostic et étiologies » doit donner « Diagnostic ».
 */
const STEP_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/notion/i, "Notions"],
  [/s[ée]miolog/i, "Sémiologie"],
  [/diagnostic/i, "Diagnostic"],
  [/strat[ée]gie/i, "Stratégie"],
  [/bilan/i, "Bilan"],
  [/[ée]tiolog/i, "Étiologie"],
  [/prise en charge|th[ée]rapeut/i, "Prise en charge"],
  [/complication/i, "Complications"],
  [/cas clinique|cas complexe/i, "Cas cliniques"],
  [/mesure/i, "Mesure"],
];

/** Longueur maximale d'un suffixe de titre utilisable comme libellé d'étape. */
const MAX_SUFFIX_LENGTH = 26;

const FALLBACK_STEP_LABEL = "Synthèse";

/**
 * Niveau porté par l'identifiant d'un deck (`cardio-sca-l4`, `cardio-ic-int`).
 *
 * `int` et `intern` désignent tous deux l'internat : sans cette reconnaissance,
 * l'étape « cas cliniques » d'une série retombait sur le dernier niveau de la
 * branche au lieu de son niveau réel.
 */
export function extractDeckLevel(deckId: string): Level | null {
  const match = deckId.match(/-(l\d|int|intern|resident|senior)(?:$|-)/i);
  if (!match) return null;
  const raw = match[1].toUpperCase();
  if (raw === "INT" || raw === "INTERN") return "INTERNE";
  if (raw === "RESIDENT") return "RESIDENT";
  if (raw === "SENIOR") return "SENIOR";
  return /^L\d$/.test(raw) ? (raw as Level) : null;
}

/**
 * Libellé court d'une étape, déduit du titre du deck.
 *
 * 1. table d'exceptions explicite ;
 * 2. mot-clé du vocabulaire clinique (« notions », « sémiologie »…) ;
 * 3. suffixe du titre après le dernier tiret cadratin, s'il est court
 *    (« ACLS », « post-ROSC ») ;
 * 4. repli neutre — jamais le niveau seul, qui ne dit rien de l'étape.
 *
 * Sans titre (deck fantôme), le repli est `null` : l'appelant décide quoi
 * afficher plutôt que de recevoir un libellé inventé.
 */
export function deriveStepLabel(deckId: string, deckTitle: string | undefined): string | null {
  const override = STEP_LABEL_OVERRIDES[deckId];
  if (override) return override;

  const title = deckTitle?.trim();
  if (!title) return null;

  for (const [pattern, label] of STEP_KEYWORDS) {
    if (pattern.test(title)) return label;
  }

  const parts = title.split(/\s+[—–]\s+/);
  const suffix = parts.length > 1 ? parts[parts.length - 1].trim() : "";
  if (suffix && suffix.length <= MAX_SUFFIX_LENGTH) {
    return suffix.charAt(0).toUpperCase() + suffix.slice(1);
  }

  return FALLBACK_STEP_LABEL;
}

/** Libellé court d'une branche : « SCA — Syndrome coronarien aigu » → « SCA ». */
export function seriesShortLabel(branchLabel: string): string {
  const [head] = branchLabel.split(/\s+[—–]\s+/);
  const short = head.trim();
  return short.length > 0 ? short : branchLabel;
}

/**
 * Déduit les séries d'un référentiel de curriculum.
 *
 * Une branche `skeleton` (structure prévue, contenu non écrit) ne produit
 * jamais de série : elle n'a pas de deck. Idem pour une branche à un seul deck :
 * un « escalier » d'une marche n'apporte rien, la carte simple suffit.
 *
 * @param curricula référentiel (ex. `listCurricula()`)
 * @param deckTitles titres réels des decks, par id — source des libellés d'étapes
 */
export function buildDeckSeries(
  curricula: CurriculumSpecialty[],
  deckTitles: ReadonlyMap<string, string> = new Map(),
): DeckSeries[] {
  const series: DeckSeries[] = [];

  for (const specialty of curricula) {
    for (const branch of specialty.branches) {
      if (branch.skeleton) continue;
      if (branch.decks.length < 2) continue;

      const fallbackLevel = branch.levels[branch.levels.length - 1] ?? null;

      series.push({
        id: `${specialty.id}:${branch.id}`,
        specialtyId: specialty.id,
        specialtyLabel: specialty.label,
        branchId: branch.id,
        label: branch.label,
        short: seriesShortLabel(branch.label),
        icon: branch.icon,
        description: branch.description,
        steps: branch.decks.map((deckId, index) => ({
          deckId,
          index,
          // `null` = deck absent du catalogue : l'appelant masque l'étape.
          label: deriveStepLabel(deckId, deckTitles.get(deckId)) ?? FALLBACK_STEP_LABEL,
          level: extractDeckLevel(deckId) ?? fallbackLevel,
        })),
      });
    }
  }

  return series;
}

/**
 * Index inverse `deckId → { série, étape }` pour regrouper une liste plate
 * d'items sans re-parcourir les curricula par item.
 */
export function buildDeckSeriesIndex(
  curricula: CurriculumSpecialty[],
  deckTitles: ReadonlyMap<string, string> = new Map(),
): Map<string, { series: DeckSeries; step: DeckSeriesStep }> {
  const index = new Map<string, { series: DeckSeries; step: DeckSeriesStep }>();
  for (const serie of buildDeckSeries(curricula, deckTitles)) {
    for (const step of serie.steps) {
      index.set(step.deckId, { series: serie, step });
    }
  }
  return index;
}

export { STEP_LABEL_OVERRIDES, STEP_KEYWORDS };
