import type { Entitlement } from "@/core/types";

/**
 * ÉTAT D'ABONNEMENT — module PUR (aucune I/O, testable sous Node).
 *
 * POURQUOI CE MODULE
 * `/pro` affichait « Premium actif » sans jamais dire JUSQU'À QUAND, et un
 * abonné dont la licence vit dans Supabase (le modèle actuel) n'obtenait aucun
 * bandeau : `profile.tier === "pro"` ne se déclenche que sur un droit
 * `OPTIMUS_PRO` local, jamais sur une licence lue en base.
 *
 * Deux sources, dans cet ordre :
 *   1. la LICENCE (abonnement) — `expires_at` lu via la session de contenu ;
 *   2. le DROIT local signé (`OPTIMUS_PRO`), historique mais toujours valable.
 *
 * ⚠️ Rien ici n'accorde d'accès : les pages de contenu restent gardées par le
 * serveur. Ce module ne sert qu'à CHOISIR LE TEXTE juste. Il ne fabrique jamais
 * de date : si l'échéance est inconnue, `expiresAt` vaut `null` et l'interface
 * dit « Abonnement actif », sans « jusqu'au … ».
 */

/** Produit du droit local qui ouvre l'intégralité du contenu Premium. */
export const SUBSCRIPTION_PRODUCT = "OPTIMUS_PRO";

export type SubscriptionSource = "licence" | "receipt" | null;

export type SubscriptionState = {
  /** Vrai si un abonnement/licence est actif AUJOURD'HUI. */
  active: boolean;
  /** Fin de l'abonnement (epoch ms), `null` si inconnue ou illimitée. */
  expiresAt: number | null;
  /** D'où vient la décision — utile pour l'interface et les journaux. */
  source: SubscriptionSource;
};

export type SubscriptionInputs = {
  /** `profile.tier` : "pro" seulement si un droit OPTIMUS_PRO existe. */
  tier: string | null | undefined;
  /** Droits locaux signés (reçus vérifiés). */
  entitlements: readonly Entitlement[];
  /** Échéance lue dans `public.licences.expires_at` (session de contenu). */
  licenceExpiresAt: number | null;
  /** Vrai si la session de contenu porte un jeton valide (licence active). */
  contentUnlocked: boolean;
};

function validExpiry(value: number | null | undefined, now: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > now ? value : null;
}

/**
 * Fin du droit local le plus tardif.
 *
 * Un droit sans échéance (`expiresAt === null`) est une licence perpétuelle
 * accordée à la main : il rend l'abonnement actif sans date de fin, donc on
 * renvoie `null` (l'interface n'affiche alors aucune date).
 */
function receiptExpiry(entitlements: readonly Entitlement[], now: number): number | null {
  const rows = entitlements.filter(
    (entitlement) =>
      entitlement.product === SUBSCRIPTION_PRODUCT &&
      (entitlement.expiresAt === null || entitlement.expiresAt > now),
  );
  if (rows.length === 0) return null;
  if (rows.some((row) => row.expiresAt === null)) return null;
  return Math.max(...rows.map((row) => row.expiresAt as number));
}

export function resolveSubscription(
  { tier, entitlements, licenceExpiresAt, contentUnlocked }: SubscriptionInputs,
  now = Date.now(),
): SubscriptionState {
  const fromReceipt =
    tier === "pro" ||
    entitlements.some(
      (entitlement) =>
        entitlement.product === SUBSCRIPTION_PRODUCT &&
        (entitlement.expiresAt === null || entitlement.expiresAt > now),
    );

  // La licence Supabase fait autorité quand elle est active : c'est elle qui
  // porte l'échéance réelle d'un abonnement trimestriel.
  const licenceEnd = contentUnlocked ? validExpiry(licenceExpiresAt, now) : null;
  const licenceActive = contentUnlocked && (licenceExpiresAt === null || licenceEnd !== null);

  if (licenceActive) {
    return { active: true, expiresAt: licenceEnd, source: "licence" };
  }
  if (fromReceipt) {
    return { active: true, expiresAt: receiptExpiry(entitlements, now), source: "receipt" };
  }
  return { active: false, expiresAt: null, source: null };
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

/** « 12 janvier 2027 » — ou `null` si aucune date fiable n'est connue. */
export function formatSubscriptionEnd(expiresAt: number | null): string | null {
  if (expiresAt === null || !Number.isFinite(expiresAt)) return null;
  try {
    return DATE_FORMAT.format(new Date(expiresAt));
  } catch {
    return null;
  }
}
