/**
 * Messages du paiement par carte — module PUR.
 *
 * POURQUOI CE MODULE (et pas des `if` dans la page)
 * En production, un 503 du tunnel carte affichait « Vérifiez votre connexion ».
 * C'était faux : la connexion du client était parfaite, c'est le serveur qui ne
 * savait pas encaisser. Un message qui accuse l'utilisateur est pire qu'un
 * message court : on cherche la panne au mauvais endroit, et on croit que le
 * bouton « ne marche pas ».
 *
 * Deux règles :
 *   1. on ne redirige vers `/login` que si l'on SAIT qu'il n'y a pas de session
 *      (`anonymous`) — jamais sur `loading` ni sur `unavailable`, sinon un
 *      utilisateur connecté se voit redemander ses identifiants (le symptôme de
 *      « double authentification » du 2026-10-22) ;
 *   2. chaque code HTTP a un message distinct, et le code est exposé dans l'UI
 *      (`data-lemon-error-code`) pour être lisible en QA sans DevTools.
 */

import type { CloudAuthStatus } from "@/lib/cloud/session";

/** Ce que l'on décide AVANT d'appeler le serveur. */
export type CardAuthGate = "proceed" | "login" | "wait" | "cloud-unavailable";

/**
 * Faut-il laisser partir le paiement, demander une connexion, ou attendre ?
 *
 * `hasToken` est faux quand la session existe mais que le jeton n'est pas encore
 * lisible : c'est un état transitoire, pas une déconnexion.
 */
export function decideCardAuthGate(status: CloudAuthStatus, hasToken: boolean): CardAuthGate {
  switch (status) {
    case "authenticated":
      return hasToken ? "proceed" : "wait";
    case "loading":
      return "wait";
    // Aucune réponse sur la session (SDK non téléchargé, hors-ligne, délai) :
    // envoyer l'utilisateur vers `/login` le déconnecterait pour une panne réseau.
    case "unavailable":
      return "cloud-unavailable";
    case "unconfigured":
      return "cloud-unavailable";
    case "anonymous":
      return "login";
    default:
      return "wait";
  }
}

export const CARD_AUTH_MESSAGES: Record<Exclude<CardAuthGate, "proceed">, string> = {
  login: "Un compte Optimus est nécessaire : connectez-vous pour que l'achat soit rattaché à votre accès.",
  wait: "Nous préparons votre session. Réessayez dans un instant : rien n'a été débité.",
  /**
   * Statut INDÉTERMINÉ : on ne sait pas si l'utilisateur est connecté (SDK non
   * chargé, hors-ligne, service lent). Le message ne doit donc accuser personne :
   * mesuré en QA, « vérifiez votre réseau » était faux quand c'était le service
   * qui ne répondait pas — exactement l'erreur qu'on corrige par ailleurs.
   */
  "cloud-unavailable":
    "Nous n'avons pas pu vérifier votre compte à l'instant. Réessayez dans quelques secondes : rien n'a été débité.",
};

export type CheckoutFailureKind = "login" | "retry" | "unavailable" | "invalid" | "network";

export type CheckoutFailureInput = {
  /** Statut HTTP, ou `null` si la requête n'a jamais abouti (réseau). */
  status: number | null;
  /** Champ `error` renvoyé par `/api/checkout/lemonsqueezy`. */
  error?: string | null;
  /** Champ `reason` (grossier) : `identity_unconfigured`, `identity_unreachable`, `database`. */
  reason?: string | null;
};

export type CheckoutFailure = {
  kind: CheckoutFailureKind;
  /** Étiquette courte, stable, pour la QA et les journaux : `http-503-database`. */
  code: string;
  message: string;
};

const UNAVAILABLE_LEAD =
  "Le paiement par carte ne peut pas être ouvert pour le moment. Aucun montant n'a été débité.";

/**
 * Traduit un échec du tunnel carte en message utile.
 *
 * Le message ne dit JAMAIS « vérifiez votre connexion » quand c'est le serveur
 * qui est en défaut : c'est exactement l'erreur de diagnostic du 2026-10-22.
 */
export function describeCheckoutFailure(input: CheckoutFailureInput): CheckoutFailure {
  const { status, error, reason } = input;

  if (status === null) {
    return {
      kind: "network",
      code: "network",
      message:
        "La demande n'a pas pu joindre nos serveurs. Vérifiez votre connexion et réessayez : aucun montant n'a été débité.",
    };
  }

  if (status === 401) {
    return {
      kind: "login",
      code: "http-401",
      message: CARD_AUTH_MESSAGES.login,
    };
  }

  if (status === 429) {
    return {
      kind: "retry",
      code: "http-429",
      message:
        "Trop de tentatives en peu de temps. Patientez une minute puis réessayez : aucun montant n'a été débité.",
    };
  }

  if (status === 503) {
    const code = reason ? `http-503-${reason}` : "http-503";
    if (reason === "database") {
      return {
        kind: "unavailable",
        code,
        message: `${UNAVAILABLE_LEAD} Le paiement par Mobile Money reste disponible, ou écrivez-nous depuis la page Contact.`,
      };
    }
    if (reason === "identity_unconfigured" || reason === "identity_unreachable") {
      return {
        kind: "unavailable",
        code,
        message: `${UNAVAILABLE_LEAD} Le paiement par Mobile Money reste disponible, ou écrivez-nous depuis la page Contact.`,
      };
    }
    return {
      kind: "unavailable",
      code,
      message: `${UNAVAILABLE_LEAD} Le paiement par Mobile Money reste disponible.`,
    };
  }

  if (status === 400 || status === 413) {
    return {
      kind: "invalid",
      code: `http-${status}`,
      message: "La demande de paiement n'a pas pu être préparée. Rechargez la page puis réessayez.",
    };
  }

  return {
    kind: "unavailable",
    code: error ? `http-${status}-${error}` : `http-${status}`,
    message: `${UNAVAILABLE_LEAD} Réessayez dans quelques instants.`,
  };
}

/**
 * Lit le corps d'erreur sans jamais lever : une réponse non JSON (page HTML de
 * proxy, coupure) doit rester un cas normal, pas une exception silencieuse.
 */
export function parseCheckoutFailureBody(raw: unknown): { error: string | null; reason: string | null } {
  if (!raw || typeof raw !== "object") return { error: null, reason: null };
  const record = raw as { error?: unknown; reason?: unknown };
  return {
    error: typeof record.error === "string" ? record.error : null,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}
