/**
 * Mappers purs : conversion entre lignes SQL et objets de domaine.
 * Aucun side-effect, aucune dependance server-only.
 */
import type { PremiumPurchase } from "@/content/purchase-order";
import type { PurchaseRow } from "./types";

/** Convertit une ligne Postgres en `PremiumPurchase` type-safe. */
export function toPurchase(row: PurchaseRow): PremiumPurchase {
  return {
    reference: row.reference,
    offer: row.offer,
    specialty: row.specialty,
    deckNumber: Number(row.deck_number),
    product: row.product,
    label: row.label,
    amount: Number(row.amount),
    status: row.status,
    proofAttached: Boolean(row.proof_attached),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** `timestamptz` (chaine ou Date) -> ISO 8601, `null` si absent. */
export function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
