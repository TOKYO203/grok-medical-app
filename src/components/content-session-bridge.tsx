import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { hasContentSession } from "@/lib/auth/session";
import { ensureContentSession } from "@/lib/cloud/content-session";
import {
  getCloudAuthServerSnapshot,
  getCloudAuthSnapshot,
  subscribeCloudAuth,
} from "@/lib/cloud/session";
import { useOptimus } from "@/state/store";

/**
 * PONT DE SESSION DE CONTENU — monté au démarrage de l'application.
 *
 * Il établit, sans aucune action de l'utilisateur, la session de contenu à
 * partir de la licence Supabase (voir `@/lib/cloud/content-session`) :
 *   • jeton de 24 h déjà valide → rien à faire ;
 *   • licence Supabase active  → jeton obtenu automatiquement.
 *
 * POURQUOI ICI ET PAS DANS `/pro`
 * Le jeton est nécessaire dès la PREMIÈRE page de contenu (lien direct,
 * favori, retour d'un appareil). Le pont vit donc dans le shell applicatif,
 * hors de toute route : `/signes` et `/pathologie/$slug` n'ont plus à savoir
 * d'où vient l'accès.
 *
 * Le jeton est posé en `localStorage` ET en cookie ; lorsqu'il vient d'être
 * obtenu, les loaders déjà exécutés (rendu serveur de nosographie) ne le
 * portaient pas encore. On les rejoue donc UNE fois — c'est ce qui remplace le
 * « rechargez la page » que l'utilisateur devait faire à la main.
 *
 * ⚠️ POURQUOI ON S'ABONNE À LA SESSION CLOUD
 * `ensureContentSession()` attend la session cloud, mais avec une borne courte
 * (2,5 s) : sur un démarrage à froid très lent (chunk du SDK, réseau mobile),
 * elle peut encore être « loading » à cet instant. Sans abonnement, le pont
 * aurait conclu « pas de session » et n'aurait JAMAIS réessayé de la visite —
 * l'utilisateur restait verrouillé jusqu'au rechargement suivant. L'effet se
 * rejoue donc à chaque transition de l'état cloud, et `ensureContentSession`
 * reste dédupliqué (une seule requête en vol quel que soit le nombre d'appels).
 */
export function ContentSessionBridge() {
  const { status, session } = useAuth();
  const hydrated = useOptimus((state) => state.hydrated);
  const router = useRouter();
  const userId = session?.user?.id ?? null;

  // S'abonner DÉMARRE le SDK Supabase : c'est aussi ce qui fait sortir l'état
  // de « loading » quand aucun autre composant ne l'écoute.
  const cloudAuth = useSyncExternalStore(
    subscribeCloudAuth,
    getCloudAuthSnapshot,
    getCloudAuthServerSnapshot,
  );
  const cloudUserId = cloudAuth.session?.user?.id ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // On attend l'hydratation du profil local : c'est lui qui porte `deviceId`,
    // exigé par l'échange d'une clé d'activation classique.
    if (!hydrated) return;
    // Tant que le SDK n'a pas rendu la main, on ne lance rien : le pont
    // repartira de lui-même à la transition (loading → authentifié).
    if (cloudAuth.status === "loading") return;

    const hadToken = hasContentSession();
    let cancelled = false;

    void ensureContentSession().then((result) => {
      if (cancelled) return;
      if (result.status !== "ready" || hadToken) return;
      // Jeton tout neuf : la page affichée a été rendue sans lui.
      void router.invalidate();
    });

    return () => {
      cancelled = true;
    };
  }, [status, userId, hydrated, cloudAuth.status, cloudUserId, router]);

  return null;
}
