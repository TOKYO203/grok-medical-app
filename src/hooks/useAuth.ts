import { useSyncExternalStore } from "react";
import {
  getCloudAuthServerSnapshot,
  getCloudAuthSnapshot,
  subscribeCloudAuth,
} from "@/lib/cloud/session";

/**
 * Session Supabase côté React.
 *
 * Contrat public (consommé par `__root.tsx`, `cloud-sync-bridge.tsx` et
 * `profil.tsx` — ne pas le réduire) :
 *   - `status`: "unconfigured" | "loading" | "anonymous" | "authenticated" | "unavailable"
 *   - `configured`: Supabase est-il configuré sur ce déploiement ?
 *   - `session`: la session Supabase, ou `null`
 *   - `loading`: raccourci de `status === "loading"`
 *
 * Pourquoi passer par le store `@/lib/cloud/session` plutôt que par un
 * `useEffect` local : le store garantit UN SEUL `onAuthStateChange` pour toute
 * l'application, un instantané serveur DÉTERMINISTE (premier rendu client = HTML
 * SSR, donc zéro mismatch d'hydratation) et des bornes de temps réelles (2 s
 * après chargement du SDK, 6 s en absolu). Un hook autonome dupliquerait
 * l'abonnement et réintroduirait le risque de « Chargement… » infini.
 *
 * `loading` retombe TOUJOURS à `false` : soit la session est résolue, soit un
 * délai a rendu la main.
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
