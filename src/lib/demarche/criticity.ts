/**
 * Criticité clinique — échelle à 4 niveaux partagée par la mindmap et les
 * flashcards de la démarche enrichie.
 *
 * Les fiches portent un `tone` (CalloutTone) issu du contenu ; on le traduit
 * ici, en un seul endroit, vers l'échelle de criticité affichée :
 *
 *   urgence  → critique  (rouge)   tableau létal à écarter d'emblée
 *   prudence → grave     (ambre)    piège / à ne pas manquer
 *   reflexe  → examens   (bleu)     geste, bilan, paraclinique
 *   retenir  → benin     (vert)     point de cours
 *   memo     → benin     (vert)     aide-mémoire, terrain bénin
 *
 * Cette indirection garde le contenu médical découplé de la palette : changer
 * une couleur ne touche jamais les JSON.
 */
import type { CalloutTone } from "@/core/demarche";

export type Criticity = "critique" | "grave" | "examens" | "benin";

export const CRITICITY_ORDER: readonly Criticity[] = ["critique", "grave", "examens", "benin"];

export const TONE_CRITICITY: Record<CalloutTone, Criticity> = {
  urgence: "critique",
  prudence: "grave",
  reflexe: "examens",
  retenir: "benin",
  memo: "benin",
};

/** Clé i18n du libellé de criticité (`demarche.criticity.<id>`). */
export function criticityLabelKey(criticity: Criticity): string {
  return `demarche.criticity.${criticity}`;
}

/** Traduit un ton d'encadré en criticité ; absence de ton ⇒ « bénin ». */
export function toneCriticity(tone?: CalloutTone): Criticity {
  return tone ? TONE_CRITICITY[tone] : "benin";
}
