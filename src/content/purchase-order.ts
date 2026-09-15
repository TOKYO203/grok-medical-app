export const PREMIUM_SPECIALTIES = [
  { id: "neurologie", label: "Neurologie", code: "NEURO" },
  { id: "cardiologie", label: "Cardiologie", code: "CARDIO" },
  { id: "infectiologie", label: "Infectiologie", code: "INFECTIO" },
  { id: "urgences", label: "Urgences", code: "URGENCES" },
  { id: "dermatologie", label: "Dermatologie", code: "DERMATO" },
] as const;

export type PremiumOffer = "deck" | "specialty";
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
  specialty: PremiumSpecialtyId;
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

export function orderAmount(order: PremiumOrder): number {
  return order.offer === "specialty" ? 27_000 : 3_000;
}

export function orderProduct(order: PremiumOrder): string {
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.code}_PACK_10`
    : `${specialty.code}_DECK_${String(order.deckNumber).padStart(2, "0")}`;
}

export function orderLabel(order: PremiumOrder): string {
  const specialty = PREMIUM_SPECIALTIES.find((item) => item.id === order.specialty);
  if (!specialty) throw new Error("Spécialité Premium inconnue");
  return order.offer === "specialty"
    ? `${specialty.label} · spécialité complète (10 Decks)`
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
    "Merci de confirmer la disponibilité et de communiquer le canal Mobile Money officiel.",
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
