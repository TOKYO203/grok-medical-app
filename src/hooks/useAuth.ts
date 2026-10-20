import { useSyncExternalStore } from "react";
import {
  getCloudAuthServerSnapshot,
  getCloudAuthSnapshot,
  subscribeCloudAuth,
} from "@/lib/cloud/session";

/**
 * Session Supabase côté React.
 *
 * `loading` retombe TOUJOURS à `false` : soit la session est résolue, soit le
 * timeout de 2 s a rendu la main (`CLOUD_SESSION_TIMEOUT_MS`). Aucun écran ne
 * peut donc rester bloqué sur « Chargement… » à cause d'une requête réseau.
 *
 * Le hook ne crée ni abonnement ni écouteur propre : tout passe par le store
 * `@/lib/cloud/session`, qui garantit un seul `onAuthStateChange` pour l'app.
 */
export function useAuth() {
  const snapshot = useSyncExternalStore(
    subscribeCloudAuth,
    getCloudAuthSnapshot,
    getCloudAuthServerSnapshot,
  );

  return {
    session: snapshot.session,
    status: snapshot.status,
    loading: snapshot.status === "loading",
    configured: snapshot.status !== "unconfigured",
  };
}
