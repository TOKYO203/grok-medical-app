/**
 * Politique de synchronisation cloud — module PUR (aucun import runtime).
 *
 * Ces deux règles sont la partie « dangereuse » de la sync, donc elles sont
 * extraites ici pour être testées sans réseau ni store :
 *
 *  1. QUAND tenter une sync. Tant qu'une seule condition manque (cloud non
 *     configuré, appareil hors-ligne, pas de session, file vide), on ne fait
 *     AUCUN appel réseau — et surtout on ne touche pas à la file locale.
 *  2. QUELLE partie de la file retirer. Seuls les événements réellement envoyés
 *     disparaissent : un événement créé PENDANT l'envoi reste dans la file.
 */

export type CloudSyncSkipReason = "unconfigured" | "offline" | "signed-out" | "empty";

export type CloudSyncDecision =
  | { action: "sync" }
  | { action: "skip"; reason: CloudSyncSkipReason };

export type CloudSyncInput = {
  configured: boolean;
  online: boolean;
  hasSession: boolean;
  queueLength: number;
};

/**
 * Ordre des gardes volontaire : le moins coûteux d'abord. `offline` est vérifié
 * avant `signed-out` pour qu'une coupure réseau ne déclenche même pas d'appel
 * à `getSession()`.
 */
export function decideCloudSync(input: CloudSyncInput): CloudSyncDecision {
  if (!input.configured) return { action: "skip", reason: "unconfigured" };
  if (!input.online) return { action: "skip", reason: "offline" };
  if (!input.hasSession) return { action: "skip", reason: "signed-out" };
  if (input.queueLength <= 0) return { action: "skip", reason: "empty" };
  return { action: "sync" };
}

/**
 * Retire de la file uniquement les événements dont l'id figure dans `sentIds`.
 * Ne mute pas l'entrée (le store Zustand reçoit un nouveau tableau).
 */
export function removeSyncedEvents<T extends { id: string }>(
  queue: readonly T[],
  sentIds: Iterable<string>,
): T[] {
  const sent = sentIds instanceof Set ? sentIds : new Set(sentIds);
  if (sent.size === 0) return [...queue];
  return queue.filter((event) => !sent.has(event.id));
}
