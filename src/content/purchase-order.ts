successfully downloaded text file (SHA: 894cd92c2c3372092440f72f03fb422c24cb22b2)import { specialtyCodeFromLabel } from "../lib/library/specialty-label.ts";

export const PREMIUM_SPECIALTIES = [
  { id: "neurologie", label: "Neurologie", code: "NEURO" },
  { id: "cardiologie", label: "Cardiologie", code: "CARDIO" },
  { id: "infectiologie", label: "Infectiologie", code: "INFECTIO" },
  { id: "urgences", label: "Urgences", code: "URGENCES" },
  { id: "dermatologie", label: "Dermatologie", code: "DERMATO" },
] as const;

export type PremiumOffer =
  | "deck"
  | "specialty"
  | "subscription_month"
  | "subscription_quarter";
export type SubscriptionOffer = "subscription_month" | "subscription_quarter";
export type PremiumSpecialtyId = (typeof PREMIUM_SPECIALTIES)[number]["id"];

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
  /** Offres historiques deck/specialty uniquement — absent pour un abonnement. */
  specialty?: PremiumSpecialtyId;
  /** Offres historiques deck/specialty uniquement — absent pour un abonnement. */
  deckNumber?: number;
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

/**
 * Abonnements Premium (A04, Session 18) : accès complet à durée, renouvelé par
 * un nouveau paiement Mobile Money. Chaque abonnement émet le droit
 * `OPTIMUS_PRO` — celui qui débloque déjà tous les Decks, cas cliniques et
 * démarches — porté par une licence à durée (voir `expiresAt` du receipt :
 * une licence expirée est refusée cryptographiquement). Les montants restent
 * la source canonique consultée par `orderAmount` ; `SUBSCRIPTIONS_MGA`
 * dans pricing.ts aligne uniquement l'affichage.
 */
export const SUBSCRIPTION_OFFERS: {
  offer: SubscriptionOffer;
  days: number;
  amountMga: number;
  label: string;
}[] = [
  { offer: "subscription_month", days: 30, amountMga: 5_000, label: "Mensuel" },
  { offer: "subscription_quarter", days: 90, amountMga: 12_000, label: "Trimestriel" },
];

const SUBSCRIPTION_BY_OFFER = new Map(SUBSCRIPTION_OFFERS.map((plan) => [plan.offer, plan]));

export function isSubscriptionOffer(offer: PremiumOffer): offer is SubscriptionOffer {
  return offer === "subscription_month" || offer === "subscription_quarter";
}

export function subscriptionPlan(offer: SubscriptionOffer) {
  const plan = SUBSCRIPTION_BY_OFFER.get(offer);
  if (!plan) throw new Error("Offre d'abonnement inconnue");
  return plan;
}

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

export function orderAmount(order: PremiumOrder): number {
  if (isSubscriptionOffer(order.offer)) return subscriptionPlan(order.offer).amountMga;
  return order.offer === "specialty" ? 27_000 : 3_000;
}

export function orderProduct(order: PremiumOrder): string {
  if (isSubscriptionOffer(order.offer)) return "OPTIMUS_PRO";
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.code}_PACK_15`
    : `${specialty.code}_DECK_${String(order.deckNumber ?? 0).padStart(2, "0")}`;
}

export function orderLabel(order: PremiumOrder): string {
  if (isSubscriptionOffer(order.offer)) {
    const plan = subscriptionPlan(order.offer);
    return `Optimus Premium · ${plan.label} (${plan.days} jours)`;
  }
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.label} · spécialité complète (15 Decks)`
    : `${specialty.label} · Deck ${order.deckNumber}/10`;
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
