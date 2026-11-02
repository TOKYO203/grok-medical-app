/**
 * Helpers server-only pour la feature purchase.
 *
 * Contient :
 *   - generation de reference (randomBytes)
 *   - hash de cle d'activation (createHash)
 *   - lecture de configuration Mobile Money (process.env)
 *   - liste d'admins (process.env.PURCHASE_ADMIN_USER_IDS)
 *   - helpers SQL simples (queries purchase_orders + audit)
 *
 * ⚠️ Ne PAS importer depuis du code client. Les appels reels se font dans
 * les handlers de server fns (process.env lu a l'execution).
 */
import { createHash, randomBytes } from "node:crypto";
import type { PremiumOffer, PurchaseStatus } from "@/content/purchase-order";
import { purchaseReferencePrefix } from "@/content/purchase-order";
import type { PremiumPaymentInstructions, PurchaseRow, SqlClient } from "./types";

/**
 * Reference de commande unique : `CMD-…` (a l'unite) / `CMD-SUB-…` (abonnement).
 * Le segment SUB est lisible dans une conversation MVola mais n'est jamais
 * utilise comme controle (le serveur relit `offer` en base).
 */
export function makeReference(offer: PremiumOffer): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${purchaseReferencePrefix(offer)}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

/**
 * Empreinte d'une cle d'activation jamais communiquee.
 * On stocke uniquement le SHA-256, jamais la cle en clair.
 */
export function discardableKeyHash(): string {
  return createHash("sha256").update(randomBytes(32).toString("hex"), "utf8").digest("hex");
}

/** Set des user id admin (lit PURCHASE_ADMIN_USER_IDS a l'appel). */
export function purchaseAdmins(): Set<string> {
  return new Set(
    (process.env.PURCHASE_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/** Refuse si `userId` n'est pas admin. */
export function requirePurchaseAdmin(userId: string): void {
  if (!purchaseAdmins().has(userId)) throw new Error("Forbidden");
}

/** Configuration Mobile Money (lit MOBILE_MONEY_* a l'appel). */
export function paymentConfiguration(): Omit<
  PremiumPaymentInstructions,
  "amount" | "orderReference" | "product"
> {
  const provider = process.env.MOBILE_MONEY_PROVIDER?.trim() || null;
  const destination = process.env.MOBILE_MONEY_NUMBER?.trim() || null;
  const accountName = process.env.MOBILE_MONEY_ACCOUNT_NAME?.trim() || null;
  const note = process.env.MOBILE_MONEY_INSTRUCTIONS?.trim() || null;
  return {
    configured: Boolean(provider && destination),
    provider,
    destination,
    accountName,
    note,
  };
}

/** Normalise une reference de transaction MVola (trim + uppercase + regex). */
export function normalizePaymentReference(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9._-]{6,120}$/.test(normalized)) {
    throw new Error("La reference de transaction Mobile Money est invalide.");
  }
  return normalized;
}

/** Detecte une violation d'unicite (payment_reference / proof_digest / duplicate key). */
export function duplicatePaymentEvidence(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /purchase_orders_payment_reference_unique_idx|purchase_orders_proof_digest_unique_idx|duplicate key/i.test(
    text,
  );
}

/** Cherche une commande possedee par `userId`. */
export async function ownedPurchase(sql: SqlClient, reference: string, userId: string) {
  const rows = await sql.query<PurchaseRow>(
    `select * from purchase_orders
     where reference = $1 and user_id = $2
     limit 1`,
    [reference, userId],
  );
  return rows[0];
}

/** Cherche une commande par sa reference (sans filtre user). */
export async function purchaseByReference(sql: SqlClient, reference: string) {
  const rows = await sql.query<PurchaseRow>(
    "select * from purchase_orders where reference = $1 limit 1",
    [reference],
  );
  return rows[0];
}

/** Log une transition de statut dans `purchase_order_events`. */
export async function auditEvent(
  sql: SqlClient,
  reference: string,
  actorUserId: string,
  eventType: PurchaseStatus,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await sql.query(
    `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [reference, actorUserId, eventType, JSON.stringify(metadata)],
  );
}
