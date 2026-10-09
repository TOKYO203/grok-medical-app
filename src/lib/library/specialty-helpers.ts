/**
 * Helpers de spécialité partagés (bibliothèque, cas cliniques…).
 *
 * Pourquoi ce module ?
 * `ContentItem.specialty` est **hétérogène** pour les decks : il provient de
 * `deck.specialty` et vaut tour à tour « Cardiologie », « Clinique »,
 * « Fondamental », « Aigu » ou « Thérapeutique ». Grouper sur cette valeur brute
 * ne sépare donc PAS neuro / infectio / dermato.
 *
 * On résout une spécialité **canonique** en croisant l'`id` du deck avec le
 * curriculum (`listCurricula()`), puis on regroupe sur cette valeur. Les cas et
 * les outils conservent leur spécialité d'origine.
 */

import type { Profile } from "@/core/types";
import { listCurricula } from "@/content/curriculum";
import type { ContentItem } from "@/lib/library/content-index";

export const DECK_ID_PREFIX = "deck:";

/** Table deckId → label de spécialité issu du curriculum (statique, calculée une fois). */
const DECK_SPECIALTY_LABELS: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const specialty of listCurricula()) {
    for (const branch of specialty.branches) {
      for (const deckId of branch.decks) {
        map.set(deckId, specialty.label);
      }
    }
  }
  return map;
})();

/** Label de spécialité du curriculum pour un deck, ou `undefined` si orphelin. */
export function deckSpecialtyLabel(deckId: string): string | undefined {
  return DECK_SPECIALTY_LABELS.get(deckId);
}

/**
 * Spécialité canonique d'un item : les decks sont résolus via le curriculum,
 * tout le reste (cas, démarches, outils) garde `item.specialty`.
 */
export function resolveSpecialty(item: ContentItem): string {
  if (item.kind === "deck" && item.id.startsWith(DECK_ID_PREFIX)) {
    const label = DECK_SPECIALTY_LABELS.get(item.id.slice(DECK_ID_PREFIX.length));
    if (label) return label;
  }
  return item.specialty;
}

/** Emoji d'illustration par spécialité (repli : 🩺). */
export function specialtyEmoji(specialty: string): string {
  const s = specialty.toLowerCase();
  if (s.includes("outil")) return "🧰";
  if (s.includes("fondamental") || s.includes("sémiolog") || s.includes("semiolog")) return "🎓";
  if (s.includes("urgence")) return "🚑";
  if (s.includes("cardio")) return "🫀";
  if (s.includes("neuro")) return "🧠";
  if (s.includes("infectio")) return "🦠";
  if (s.includes("pneumo")) return "🫁";
  if (s.includes("dermato")) return "🩹";
  if (s.includes("nephro")) return "🫘";
  if (s.includes("gastro") || s.includes("hepato")) return "🫃";
  return "🩺";
}

/**
 * Teinte d'illustration (CSS color) par spécialité, lisible sur fonds clair ET sombre.
 * Sert de `--group-hue` à la pastille d'en-tête de groupe. Repli : bleu ardoise neutre.
 */
export function specialtyTint(specialty: string): string {
  const s = specialty.toLowerCase();
  if (s.includes("urgence")) return "hsl(3 62% 47%)";
  if (s.includes("cardio")) return "hsl(346 60% 47%)";
  if (s.includes("neuro")) return "hsl(264 46% 52%)";
  if (s.includes("infectio") || s.includes("tropical")) return "hsl(152 42% 38%)";
  if (s.includes("dermato")) return "hsl(27 62% 47%)";
  if (s.includes("pneumo")) return "hsl(203 52% 44%)";
  if (s.includes("nephro")) return "hsl(190 50% 39%)";
  if (s.includes("gastro") || s.includes("hepato")) return "hsl(36 55% 43%)";
  if (s.includes("fondamental") || s.includes("semiolog") || s.includes("sémiolog"))
    return "hsl(215 33% 47%)";
  if (s.includes("outil")) return "hsl(268 24% 47%)";
  return "hsl(206 30% 44%)";
}

/** Identifiant d'ancre stable et sans accents à partir d'un texte libre. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Ancre de groupe préfixée (`cas-…`, `bib-…`) pour éviter les collisions entre pages. */
export function specialtySlug(specialty: string, prefix: string): string {
  return `${prefix}-${slugify(specialty)}`;
}

/**
 * Pertinence d'un groupe de spécialité pour le profil courant.
 * Priorité : matières prioritaires (4) > année d'étude (2) > volume accessible.
 * Sert au tri « du plus proche de votre profil au plus éloigné ».
 */
export function specialtyGroupRelevance(
  specialty: string,
  items: ContentItem[],
  profile: Profile,
): number {
  const needle = specialty.toLowerCase();
  const priority = profile.prioritySubjects.some((subject) => {
    const s = subject.toLowerCase().trim();
    if (!s) return false;
    return s.includes(needle) || needle.includes(s);
  });
  const yearMatch = profile.studyYear > 0 && items.some((item) => item.year === profile.studyYear);
  const accessible = items.filter((item) => !item.locked).length;
  return (priority ? 4 : 0) + (yearMatch ? 2 : 0) + accessible;
}

export type SpecialtyGroup = { specialty: string; items: ContentItem[] };

/**
 * Regroupe des items par spécialité résolue, du groupe le PLUS pertinent au
 * MOINS pertinent (matières prioritaires → année d'étude → volume accessible),
 * puis par ordre alphabétique à pertinence égale.
 */
export function groupBySpecialty(items: ContentItem[], profile: Profile): SpecialtyGroup[] {
  const bySpecialty = new Map<string, ContentItem[]>();
  for (const item of items) {
    const specialty = resolveSpecialty(item);
    const list = bySpecialty.get(specialty) ?? [];
    list.push(item);
    bySpecialty.set(specialty, list);
  }
  return [...bySpecialty.entries()]
    .map(([specialty, groupItems]) => ({ specialty, items: groupItems }))
    .sort(
      (a, b) =>
        specialtyGroupRelevance(b.specialty, b.items, profile) -
          specialtyGroupRelevance(a.specialty, a.items, profile) ||
        a.specialty.localeCompare(b.specialty, "fr"),
    );
}

/** Spécialités distinctes (résolues) présentes dans une liste d'items, triées. */
export function specialtyFacets(items: ContentItem[]): string[] {
  return [...new Set(items.map(resolveSpecialty))].sort((a, b) => a.localeCompare(b, "fr"));
}
