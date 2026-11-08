// Version du catalogue distant — cloisonnée du module @/content/catalog.
//
// POURQUOI CE MODULE EXISTE (G51, cf. scripts/eager-graph.test.mjs) :
// le store (src/state/store.ts) est évalué en EAGER sur chaque page ; il doit
// pouvoir s'abonner à l'arrivée des decks/cas/QCM distants SANS importer le
// catalogue, sinon le module catalogue entier (chargeur, proxys, boot) entre
// dans le chunk partagé du premier rendu. Ce module est volontairement minuscule
// et n'a AUCUN effet au chargement.

import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

/** Appelé par le chargeur du catalogue à chaque arrivée de données. */
export function emitCatalogVersion(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): number {
  return version;
}

/**
 * Version du catalogue — incrémentée à chaque arrivée de données.
 *
 * L'état du catalogue est muté en place (identité stable), donc
 * useSyncExternalStore ne redessinait jamais les composants au chargement :
 * consommer la version comme snapshot force le re-rendu.
 */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
