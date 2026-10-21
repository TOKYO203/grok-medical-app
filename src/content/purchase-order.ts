import { specialtyCodeFromLabel } from "../lib/library/specialty-label.ts";
import { PRICES_MGA, SUBSCRIPTION_MONTHS } from "./pricing.ts";

export const PREMIUM_SPECIALTIES = [
  { id: "neurologie", label: "Neurologie", code: "NEURO" },
  { id: "cardiologie", label: "Cardiologie", code: "CARDIO" },
  { id: "infectiologie", label: "Infectiologie", code: "INFECTIO" },
  { id: "urgences", label: "Urgences", code: "URGENCES" },
  { id: "dermatologie", label: "Dermatologie", code: "DERMATO" },
] as const;

/**
 * Offres commerciales servies par le tunnel de commande.
 *
 * `subscription` (Abonnement Trimestriel, 15 000 Ar / 3 mois) est une offre
 * GLOBALE : elle n'appartient à aucune spécialité et n'a pas de numéro de
 * module. C'est pour ça que `PremiumOrder.specialty` accepte la sentinelle
 * `ALL_SPECIALTIES` et que `normalizePremiumOrderInput()` force ces deux champs
 * côté serveur — le client ne décide jamais de la forme d'une commande.
 */
export type PremiumOffer = "deck" | "specialty" | "subscription";
export type PremiumSpecialtyId = (typeof PREMIUM_SPECIALTIES)[number]["id"];

/** Spécialité factice portée par un abonnement : tout le catalogue Premium. */
export const ALL_SPECIALTIES = "all";

/** Spécialité telle qu'elle est stockée sur une commande. */
export type OrderSpecialty = PremiumSpecialtyId | typeof ALL_SPECIALTIES;

/**
 * Produit de licence de l'abonnement.
 *
 * `OPTIMUS_PRO` est le droit qui ouvre l'INTÉGRALITÉ du contenu Premium dans
 * tous les contrôles d'accès existants (`hasAccess`, `caseAccessible`,
 * `hasClinicalAccess`, `demarche.$id`). En réutiliser le code plutôt que d'en
 * inventer un nouveau (`OPTIMUS_SUB_QUARTER`) évite d'avoir à modifier six
 * gardes d'accès et de risquer d'en oublier une : l'échéance, elle, est portée
 * par la licence (`expires_at` / `expiresAt`), pas par le code produit.
 *
 * Ré-exporté par `src/lib/cloud/subscription.ts` (source unique).
 */
export const SUBSCRIPTION_PRODUCT = "OPTIMUS_PRO";

/** Toutes les offres, dans l'ordre d'affichage commercial. */
export const PREMIUM_OFFERS = ["subscription", "specialty", "deck"] as const;

export function isPremiumOffer(value: unknown): value is PremiumOffer {
  return value === "deck" || value === "specialty" || value === "subscription";
}

export function isSubscriptionOffer(offer: PremiumOffer): boolean {
  return offer === "subscription";
}

export const PURCHASE_PROGRESS_STATUSES = [
  "created",
  "instructions_requested",
  "proof_ready",
  "verification_pending",
  "payment_verified",
  "delivered",
] as const;

export const PURCHASE_STATUSES = [
  ...PURCHASE_PROGRESS_STATUSES,
  "rejected",
  "refunded",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type PurchaseProgressStatus = (typeof PURCHASE_PROGRESS_STATUSES)[number];

export type PremiumOrder = {
  reference: string;
  offer: PremiumOffer;
  specialty: OrderSpecialty;
  deckNumber: number;
};

export type PremiumPurchase = PremiumOrder & {
  product: string;
  label: string;
  amount: number;
  status: PurchaseStatus;
  proofAttached: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PurchaseDeviceRequest = {
  optimusId: string;
  deviceId: string;
  deviceKeyId: string;
  publicKey: string;
};

const PREMIUM_SPECIALTY_BY_CODE: Record<string, PremiumSpecialtyId> = Object.fromEntries(
  PREMIUM_SPECIALTIES.map((specialty) => [specialty.code, specialty.id]),
);

/**
 * Spécialité Premium correspondant à un libellé de contenu (cas, démarche…).
 *
 * Source unique de vérité partagée par les CTA « Débloquer la spécialité » :
 * le produit proposé doit suivre le MÊME ordre de priorité que
 * `specialtyCodeFromLabel` (donc que l'accès réel `specialtyPackProduct`).
 * Renvoie `null` si le contenu n'appartient à aucune famille premium.
 */
export function premiumSpecialtyIdFor(specialtyLabel: string): PremiumSpecialtyId | null {
  return PREMIUM_SPECIALTY_BY_CODE[specialtyCodeFromLabel(specialtyLabel)] ?? null;
}

/**
 * Montant facturé, en Ariary — TOUJOURS lu dans `pricing.ts`.
 *
 * Historiquement `3_000` / `27_000` étaient écrits ici : deux sources de prix
 * pour un même produit (ABO-2). L'abonnement ajoute une troisième valeur, donc
 * le montant vient désormais de la source unique affichée sur `/tarifs`.
 */
export function orderAmount(order: PremiumOrder): number {
  if (order.offer === "subscription") return PRICES_MGA.subscriptionQuarter;
  return order.offer === "specialty" ? PRICES_MGA.specialty : PRICES_MGA.deck;
}

export function orderProduct(order: PremiumOrder): string {
  if (order.offer === "subscription") return SUBSCRIPTION_PRODUCT;
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.code}_PACK_15`
    : `${specialty.code}_DECK_${String(order.deckNumber).padStart(2, "0")}`;
}

export function orderLabel(order: PremiumOrder): string {
  if (order.offer === "subscription") {
    return `Abonnement Trimestriel · Accès illimité ${SUBSCRIPTION_MONTHS} mois`;
  }
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.label} · spécialité complète (15 Decks)`
    : `${specialty.label} · Deck ${order.deckNumber}/10`;
}

/**
 * Durée de la licence émise à la livraison, en jours — `null` = perpétuelle.
 *
 * Un module ou une spécialité s'achètent une fois : la licence n'expire pas.
 * L'abonnement, lui, couvre `SUBSCRIPTION_MONTHS` mois ; on les convertit en
 * jours (× 30) pour rester sur une arithmétique entière et ne dépendre d'aucun
 * calendrier (aucun débat « 3 mois = 89/90/92 jours »).
 */
export function licenseDurationDays(offer: PremiumOffer): number | null {
  return offer === "subscription" ? SUBSCRIPTION_MONTHS * 30 : null;
}

/**
 * Date d'expiration de la licence à émettre, en ISO 8601 (`null` = à vie).
 *
 * Fonction PURE : le serveur la calcule au moment de la livraison et l'écrit
 * dans `activation_keys.expires_at`, puis la signe dans le reçu. La même règle
 * sert donc à la base, au reçu et à l'affichage — impossible qu'elles divergent.
 */
export function licenseExpiryFor(offer: PremiumOffer, now = Date.now()): string | null {
  const days = licenseDurationDays(offer);
  if (days === null) return null;
  return new Date(now + days * 86_400_000).toISOString();
}

/**
 * Normalise la forme d'une commande CÔTÉ SERVEUR.
 *
 * Le client envoie ce qu'il sait (une offre, éventuellement une spécialité et un
 * numéro de module) ; c'est cette fonction qui décide de la forme canonique :
 *   · abonnement → spécialité `all`, module 1 : aucun choix de spécialité n'a de
 *     sens, et stocker celle qui traînait dans le formulaire serait un mensonge ;
 *   · offre à l'unité → spécialité ET module obligatoires.
 *
 * Elle vit dans le domaine (module pur) pour être testable sans base ni réseau.
 */
export function normalizePremiumOrderInput(input: {
  offer: PremiumOffer;
  specialty?: string | null;
  deckNumber?: number | null;
}): { offer: PremiumOffer; specialty: OrderSpecialty; deckNumber: number } {
  if (input.offer === "subscription") {
    return { offer: input.offer, specialty: ALL_SPECIALTIES, deckNumber: 1 };
  }
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === input.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  if (input.offer === "specialty") {
    return { offer: input.offer, specialty: specialty.id, deckNumber: 1 };
  }
  const deckNumber = Number(input.deckNumber);
  if (!Number.isInteger(deckNumber) || deckNumber < 1 || deckNumber > 10) {
    throw new Error("Module Premium invalide");
  }
  return { offer: input.offer, specialty: specialty.id, deckNumber };
}

/**
 * Référence de commande : `CMD-<horodatage base36>-<8 hex>` pour les achats à
 * l'unité, `CMD-SUB-<horodatage base36>-<8 hex>` pour l'abonnement.
 *
 * Le segment `SUB` rend l'offre lisible dans une conversation Mobile Money ou
 * dans le back-office, SANS servir de contrôle (le serveur relit toujours
 * `offer` en base). L'unicité vient du suffixe aléatoire de 32 bits + de la clé
 * primaire `purchase_orders.reference` : deux commandes ne peuvent pas la
 * partager, y compris deux demandes simultanées.
 */
export const PURCHASE_REFERENCE_PATTERN = /^CMD-(?:SUB-)?[A-Z0-9]+-[A-F0-9]{8}$/;

export function purchaseReferencePrefix(offer: PremiumOffer): string {
  return offer === "subscription" ? "CMD-SUB" : "CMD";
}

export function purchaseStatusRank(status: PurchaseStatus): number {
  const progressRank = PURCHASE_PROGRESS_STATUSES.indexOf(status as PurchaseProgressStatus);
  return progressRank >= 0 ? progressRank : PURCHASE_PROGRESS_STATUSES.indexOf("verification_pending");
}

export function isTerminalPurchaseStatus(status: PurchaseStatus): boolean {
  return status === "delivered" || status === "rejected" || status === "refunded";
}

export function advancePurchase(
  order: PremiumOrder,
  status: PurchaseStatus,
  previous?: PremiumPurchase,
  proofAttached = false,
  now = Date.now(),
): PremiumPurchase {
  const product = orderProduct(order);
  const sameProduct = previous?.reference === order.reference && previous.product === product;
  const previousIsTerminal = sameProduct && previous ? isTerminalPurchaseStatus(previous.status) : false;
  const requestedProgressStatus = PURCHASE_PROGRESS_STATUSES.includes(status as PurchaseProgressStatus);
  const previousProgressStatus = previous
    ? PURCHASE_PROGRESS_STATUSES.includes(previous.status as PurchaseProgressStatus)
    : false;
  const nextStatus =
    previousIsTerminal && previous
      ? previous.status
      : sameProduct &&
          previous &&
          requestedProgressStatus &&
          previousProgressStatus &&
          purchaseStatusRank(previous.status) > purchaseStatusRank(status)
        ? previous.status
        : status;

  return {
    ...order,
    product,
    label: orderLabel(order),
    amount: orderAmount(order),
    status: nextStatus,
    proofAttached: Boolean((sameProduct && previous?.proofAttached) || proofAttached),
    createdAt: sameProduct && previous ? previous.createdAt : now,
    updatedAt: now,
  };
}

export function paymentRequestMessage(order: PremiumOrder, optimusId: string): string {
  return [
    "DEMANDE DE PAIEMENT OPTIMUS",
    `Référence : ${order.reference}`,
    `Offre : ${orderLabel(order)}`,
    `Montant : ${orderAmount(order).toLocaleString("fr-FR")} Ar`,
    `Produit : ${orderProduct(order)}`,
    `Optimus ID : ${optimusId}`,
    "Merci de confirmer la disponibilité et de communiquer le numéro Mobile Money officiel du canal de paiement.",
  ].join("\n");
}

export function fulfillmentRequestMessage(
  order: PremiumOrder,
  device: PurchaseDeviceRequest,
  paymentReference?: string,
): string {
  return [
    "COMMANDE OPTIMUS PAYÉE",
    `Référence : ${order.reference}`,
    `Offre : ${orderLabel(order)}`,
    `Montant : ${orderAmount(order).toLocaleString("fr-FR")} Ar`,
    `Produit : ${orderProduct(order)}`,
    `Optimus ID : ${device.optimusId}`,
    ...(paymentReference ? [`Transaction Mobile Money : ${paymentReference}`] : []),
    "",
    "DEMANDE APPAREIL SÉCURISÉE",
    JSON.stringify({
      format: "optimus-device-request-v1",
      order_ref: order.reference,
      product: orderProduct(order),
      optimus_id: device.optimusId,
      device_id: device.deviceId,
      device_key_id: device.deviceKeyId,
      public_key: device.publicKey,
    }),
  ].join("\n");
}
