import type { Deck } from "@/core/types";

/**
 * Nombre de questions d'un deck, y compris quand elles ne sont pas chargées.
 *
 * Depuis le correctif P0 du pentest, `public/data/decks.json` ne publie plus
 * les questions d'un deck premium : il ne porte que `questionCount`. Un client
 * sans jeton a donc `questions === []` sur ces decks, et un simple
 * `deck.questions.length` afficherait « 0 question » sur un deck qui en a 12.
 *
 * On affiche le nombre ANNONCÉ par l'index, et on retombe sur la longueur
 * réelle quand elle est supérieure (deck gratuit, ou questions déjà chargées).
 */
export function deckQuestionCount(deck: Pick<Deck, "questions"> & { questionCount?: number }): number {
  const declared = typeof deck.questionCount === "number" ? deck.questionCount : 0;
  return Math.max(declared, deck.questions.length);
}
