import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { startSyncLoop, syncWithCloud } from "@/lib/sync-engine";

/**
 * Démarre la synchronisation cloud quand — et seulement quand — une session
 * Supabase est active.
 *
 * La boucle est arrêtée au démontage et à chaque changement de session : une
 * seule minuterie peut vivre à la fois (`startSyncLoop` refuse les doublons).
 */
export function CloudSyncBridge() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") return;

    void syncWithCloud().catch(() => {
      // Une erreur réseau ne doit jamais remonter en exception non gérée :
      // la file locale est conservée pour la prochaine tentative.
    });

    return startSyncLoop();
  }, [status]);

  return null;
}
