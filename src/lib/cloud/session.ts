import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, loadSupabase } from "@/lib/supabase";

/**
 * État de session Supabase — source unique, hors React.
 *
 * Pourquoi un store externe plutôt qu'un `useEffect` + `useState` dans le root :
 *   1. un seul abonnement `onAuthStateChange` pour toute l'application (le root,
 *      /login et le gate d'auth lisent le MÊME état, sans course entre eux) ;
 *   2. un instantané serveur DÉTERMINISTE, indispensable à l'hydratation
 *      (`getServerSnapshot` = premier rendu client, donc zéro mismatch) ;
 *   3. des bornes de temps réelles : une requête (ou un chunk) qui ne répond
 *      jamais ne peut plus laisser l'écran bloqué sur « Chargement… ».
 */

export type CloudAuthStatus =
  | "unconfigured"
  | "loading"
  | "anonymous"
  | "authenticated"
  /**
   * Cloud INJOIGNABLE (chunk du SDK non téléchargeable, ou aucune réponse dans
   * les délais). Distinct de « anonymous » : on n'a reçu AUCUNE réponse sur la
   * session. Verrouiller sur une absence de réponse rendrait l'application
   * inutilisable hors-ligne — c'est le contraire de la promesse d'une PWA.
   */
  | "unavailable";

export type CloudAuthSnapshot = {
  status: CloudAuthStatus;
  session: Session | null;
};

/** Borne d'attente de `getSession()` une fois le SDK chargé. */
export const CLOUD_SESSION_TIMEOUT_MS = 2_000;

/** Borne ABSOLUE, téléchargement du chunk du SDK inclus (réseau très lent). */
export const CLOUD_BOOT_TIMEOUT_MS = 6_000;

const SERVER_SNAPSHOT: CloudAuthSnapshot = Object.freeze({
  status: isSupabaseConfigured ? "loading" : "unconfigured",
  session: null,
});

/** Même objet au départ côté client : le premier rendu client = le rendu SSR. */
let snapshot: CloudAuthSnapshot = SERVER_SNAPSHOT;

const listeners = new Set<() => void>();
let started = false;

function publish(next: CloudAuthSnapshot): void {
  if (next.status === snapshot.status && next.session === snapshot.session) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Événement d'authentification : il fait AUTORITÉ (y compris la déconnexion). */
function settleFromEvent(session: Session | null): void {
  publish({ status: session ? "authenticated" : "anonymous", session });
}

/**
 * Résolution « best effort » (probe initiale ou expiration d'un délai) : elle
 * peut confirmer une session, jamais en révoquer une déjà connue.
 */
function settleFromProbe(session: Session | null): void {
  if (!session && snapshot.status === "authenticated") return;
  publish({ status: session ? "authenticated" : "anonymous", session });
}

/**
 * Rejoue le démarrage au retour du réseau, une seule fois. Sans cela, un
 * démarrage hors-ligne laissait la session dans l'état « unavailable » jusqu'au
 * prochain rechargement de page, alors que le réseau revenu suffisait.
 */
function retryOnReconnect(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "online",
    () => {
      if (snapshot.status === "authenticated") return;
      started = false;
      start();
    },
    { once: true },
  );
}

function start(): void {
  if (started || !isSupabaseConfigured) return;
  started = true;

  let bootTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (bootTimer !== null) clearTimeout(bootTimer);
    if (sessionTimer !== null) clearTimeout(sessionTimer);
    bootTimer = null;
    sessionTimer = null;
  };

  /**
   * Le réseau (ou le chunk) n'a pas répondu : on rend la main à l'utilisateur au
   * lieu de le laisser devant un écran de chargement sans fin.
   *
   * On publie « unavailable » et NON « anonymous » : on n'a aucune preuve qu'il
   * n'y a pas de session, seulement la preuve qu'on n'a pas pu la lire. Le gate
   * laisse alors passer en mode local (voir `resolveCloudGate`), sinon un simple
   * démarrage hors-ligne (chunk du SDK jamais téléchargé) enfermerait
   * l'utilisateur sur l'écran de connexion — y compris pour réviser du contenu
   * déjà en cache.
   */
  const giveUp = () => {
    clearTimers();
    if (snapshot.status === "authenticated") return;
    publish({ status: "unavailable", session: null });
  };

  bootTimer = setTimeout(giveUp, CLOUD_BOOT_TIMEOUT_MS);

  void loadSupabase().then((client) => {
    if (!client) {
      giveUp();
      // Le SDK n'a pas pu être chargé (démarrage hors-ligne, cache vide) :
      // on retente au retour du réseau plutôt que d'attendre un rechargement.
      retryOnReconnect();
      return;
    }

    // On s'abonne TOUJOURS (même après une expiration) : sans cela, une connexion
    // ultérieure ne serait jamais remontée à l'interface.
    try {
      client.auth.onAuthStateChange((_event, session) => {
        clearTimers();
        settleFromEvent(session);
      });
    } catch {
      giveUp();
      return;
    }

    if (snapshot.status === "loading") {
      sessionTimer = setTimeout(giveUp, CLOUD_SESSION_TIMEOUT_MS);
    }

    void client.auth
      .getSession()
      .then(({ data }) => {
        clearTimers();
        settleFromProbe(data.session);
      })
      .catch(() => {
        clearTimers();
        settleFromProbe(null);
      });
  });
}

export function subscribeCloudAuth(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function getCloudAuthSnapshot(): CloudAuthSnapshot {
  return snapshot;
}

/** Instantané serveur — constant, donc identique au premier rendu client. */
export function getCloudAuthServerSnapshot(): CloudAuthSnapshot {
  return SERVER_SNAPSHOT;
}

/** Déconnexion Supabase ; l'état est ensuite mis à jour par `SIGNED_OUT`. */
export async function signOutCloud(): Promise<void> {
  const client = await loadSupabase();
  if (!client) {
    settleFromEvent(null);
    return;
  }
  try {
    const { error } = await client.auth.signOut();
    if (error) settleFromEvent(null);
  } catch {
    // Réseau coupé : on force l'état local, sinon le bouton semblerait inerte.
    settleFromEvent(null);
  }
}
