import { useEffect } from "react";
import { useAppUser } from "@/hooks/useAppUser";
import { useOptimus } from "@/state/store";

/**
 * PROVISIONNEMENT DE L'IDENTITÉ OPTIMUS — l'achat reste bloqué sans lui.
 *
 * Un appareil neuf démarre avec `optimusId: "OM-GUEST"` et
 * `deviceId: "device-local"`. Or le tunnel de commande refuse de créer une
 * commande dans cet état (`premium-purchase-flow.tsx` affiche alors
 * « Finalisation du compte Optimus »), parce qu'une commande doit être rattachée
 * à une identité stable et vérifiable.
 *
 * Conséquence observée en production : même une fois l'authentification unifiée,
 * un utilisateur connecté pour la première fois restait bloqué un cran plus loin
 * — il devait deviner qu'il fallait ouvrir `/profil` pour obtenir un ID.
 *
 * Ce pont supprime cette étape : dès qu'une identité cloud réelle existe, l'ID
 * natif et l'identifiant d'appareil sont créés localement (aucun appel réseau,
 * aucune donnée envoyée). Ils restent des identifiants d'APPAREIL : le
 * provisionnement ne prétend pas les synchroniser.
 *
 * Il attend `hydrated` : sans cela, l'écriture serait écrasée par la
 * réhydratation du store au premier chargement.
 */
export function CloudIdentityBridge() {
  const { user, isPending } = useAppUser();
  const hydrated = useOptimus((state) => state.hydrated);
  const ensureOptimusIdentity = useOptimus((state) => state.ensureOptimusIdentity);
  const optimusId = useOptimus((state) => state.profile.optimusId);
  const deviceId = useOptimus((state) => state.profile.deviceId);

  useEffect(() => {
    if (!hydrated || isPending || !user || user.isDevFallback) return;
    if (optimusId !== "OM-GUEST" && deviceId !== "device-local") return;
    ensureOptimusIdentity({ displayName: user.displayName });
  }, [
    hydrated,
    isPending,
    user,
    optimusId,
    deviceId,
    ensureOptimusIdentity,
  ]);

  return null;
}
