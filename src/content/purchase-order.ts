export const PREMIUM_SPECIALTIES = [
  { id: "neurologie", label: "Neurologie", code: "NEURO" },
  { id: "cardiologie", label: "Cardiologie", code: "CARDIO" },
  { id: "infectiologie", label: "Infectiologie", code: "INFECTIO" },
  { id: "urgences", label: "Urgences", code: "URGENCES" },
  { id: "dermatologie", label: "Dermatologie", code: "DERMATO" },
] as const;

export type PremiumOffer = "deck" | "specialty";
export type PremiumSpecialtyId = (typeof PREMIUM_SPECIALTIES)[number]["id"];

export const PURCHASE_STATUSES = [
  "created",
  "instructions_requested",
  "proof_ready",
  "verification_pending",
  "delivered",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

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
  return PURCHASE_STATUSES.indexOf(status);
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
  const nextStatus =
    sameProduct && purchaseStatusRank(previous.status) > purchaseStatusRank(status)
      ? previous.status
      : status;

  return {
    ...order,
    product,
    label: orderLabel(order),
    amount: orderAmount(order),
    status: nextStatus,
    proofAttached: Boolean((sameProduct && previous.proofAttached) || proofAttached),
    createdAt: sameProduct ? previous.createdAt : now,
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
    "Merci de confirmer la disponibilité et de communiquer le numéro Mobile Money officiel.",
  ].join("\n");
}

export function fulfillmentRequestMessage(
  order: PremiumOrder,
  device: PurchaseDeviceRequest,
): string {
  return [
    "COMMANDE OPTIMUS PAYÉE",
    `Référence : ${order.reference}`,
    `Offre : ${orderLabel(order)}`,
    `Montant : ${orderAmount(order).toLocaleString("fr-FR")} Ar`,
    `Produit : ${orderProduct(order)}`,
    `Optimus ID : ${device.optimusId}`,
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
