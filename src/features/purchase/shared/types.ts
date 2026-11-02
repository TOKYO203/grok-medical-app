/**
 * Types partages pour la feature purchase.
 *
 * Ces types sont utilises par les server fns (server-side) ET par les
 * composants UI (client-side) pour afficher les donnees. Ils doivent rester
 * PURS (pas d'import server-only).
 */
import type {
  OrderSpecialty,
  PremiumOffer,
  PremiumPurchase,
  PurchaseStatus,
} from "@/content/purchase-order";

/** Ligne brute de `purchase_orders` (telle que retournee par Postgres). */
export type PurchaseRow = {
  reference: string;
  user_id: string;
  optimus_id: string;
  offer: PremiumOffer;
  specialty: OrderSpecialty;
  deck_number: number;
  product: string;
  label: string;
  amount: number;
  status: PurchaseStatus;
  proof_attached: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  device_id: string | null;
  device_key_id: string | null;
  device_public_key: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  proof_digest: string | null;
};

/** Contrat minimal d'un client SQL (Kysely/PGlite/pg). */
export type SqlClient = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
};

/** Instructions de paiement Mobile Money affichees au client. */
export type PremiumPaymentInstructions = {
  configured: boolean;
  provider: string | null;
  destination: string | null;
  accountName: string | null;
  note: string | null;
  amount: number;
  orderReference: string;
  product: string;
};

/** Vue admin d'une commande (avec donnees de livraison). */
export type AdminPurchaseOrder = {
  purchase: PremiumPurchase;
  userId: string;
  optimusId: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  proofDigest: string | null;
  deviceId: string | null;
};
