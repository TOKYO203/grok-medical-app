import { useEffect, useRef } from "react";
import { useAppUser } from "@/hooks/useAppUser";
import { buildOptimusSnapshot } from "@/lib/optimus-sync-model";
import { pullOptimusState, pushOptimusState } from "@/lib/optimus-sync";
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
  /** Une seule tentative par session : inutile de sonder la base à chaque rendu. */
  const serverStateChecked = useRef(false);

  /* 1. Identité locale — instantanée, aucun réseau. */
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

  /**
   * 2. Provisionnement SERVEUR (`optimus_user_state`).
   *
   * POURQUOI CE SECOND EFFET — un utilisateur connecté par Supabase restait
   * bloqué au moment de créer une commande : « Connectez et synchronisez votre
   * compte Optimus avant de créer une commande. » Le tunnel lit
   * `optimus_user_state`, une table du projet serveur qui n'était alimentée que
   * par le pont Better Auth. Depuis l'identité unique, ce pont est suspendu dès
   * qu'une session Supabase existe — plus personne ne créait donc la ligne.
   *
   * La règle est volontairement PRUDENTE :
   *   - on LIT d'abord : si un instantané existe déjà (autre appareil, session
   *     précédente), on n'écrit RIEN — un appareil neuf écraserait la progression
   *     cloud de l'utilisateur ;
   *   - un compte en cours d'effacement (`syncSuspended`) n'est jamais ressuscité ;
   *   - on attend que l'Optimus ID local existe, sinon l'instantané est invalide.
   */
  useEffect(() => {
    if (!hydrated || isPending || !user || user.isDevFallback) return;
    if (!optimusId || optimusId === "OM-GUEST") return;
    if (serverStateChecked.current) return;
    serverStateChecked.current = true;

    void (async () => {
      try {
        const pulled = await pullOptimusState();
        if (pulled.syncSuspended) return;
        if (pulled.snapshot) return;
        await pushOptimusState({
          data: { baseRevision: null, snapshot: buildOptimusSnapshot(useOptimus.getState()) },
        });
      } catch {
        // Panne réseau ou serveur : on réessaiera au prochain montage plutôt que
        // de marteler. L'achat réessaiera aussi de son côté.
        serverStateChecked.current = false;
      }
    })();
  }, [hydrated, isPending, user, optimusId]);

  return null;
}
