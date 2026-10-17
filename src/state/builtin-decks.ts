import type { Deck } from "@/core/types";

/*
 * Cache des decks intégrés (G51 — code-splitting des données médicales).
 *
 * `src/content/catalog` embarque les trois JSON cliniques (decks, cas,
 * diagnostics) : l'importer statiquement depuis le store ou la palette de
 * commandes — tous deux évalués en eager sur CHAQUE page (racine + Shell) —
 * verrouillait ces données dans le chunk partagé initial, payé au premier
 * rendu même sur les pages qui n'en ont pas besoin.
 *
 * Ce module, volontairement léger, est le seul point d'accès du store :
 *  - chaque route qui affiche des decks sème le cache en tête de module
 *    (`seedBuiltinDecks`) depuis son propre chunk — évalué côté serveur SSR
 *    comme côté client, avant tout rendu : déterministe, sans flash ;
 *  - les composants à la demande (palette de commandes) chargent le
 *    catalogue par import dynamique.
 */

let builtinDecks: Deck[] = [];

/** Sème le cache — idempotent, appelé en tête de module de route consommatrice. */
export function seedBuiltinDecks(decks: Deck[]): void {
  if (decks.length > 0) builtinDecks = decks;
}

/** Decks intégrés semés — vide tant qu'aucune route consommatrice n'a chargé son chunk. */
export function getBuiltinDecks(): Deck[] {
  return builtinDecks;
}

/** Charge paresseusement le catalogue (une seule fois) — usages déclenchés par l'utilisateur. */
export async function ensureBuiltinDecks(): Promise<Deck[]> {
  if (builtinDecks.length === 0) {
    const catalog = await import("@/content/catalog");
    builtinDecks = catalog.BUILTIN_DECKS;
  }
  return builtinDecks;
}
