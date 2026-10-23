import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { orderLabel, orderProduct, purchaseReferencePrefix, PURCHASE_REFERENCE_PATTERN, type PremiumOrder } from "../../content/purchase-order.ts";
import { subscriptionAmountCents } from "../../content/international.ts";
import type { CheckoutIdentity } from "./checkout.server.ts";

const SUBSCRIPTION_ORDER: PremiumOrder = { reference: "CMD-SUB-PREVIEW-00000000", offer: "subscription", specialty: "all", deckNumber: 1 };
const ORDER_CURRENCY = "EUR";

export function makeInternationalReference(now = Date.now()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${purchaseReferencePrefix("subscription")}-${now.toString(36).toUpperCase()}-${suffix}`;
}

type Result = { ok: true; reference: string; userId: string; created: boolean; expiresAt: string | null } | { ok: false; reason: "database" };

export async function createInternationalOrderRest(input: { identity: CheckoutIdentity; clientRequestId: string; now?: number }): Promise<Result> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("[checkout-rest] SUPABASE_URL ou SERVICE_ROLE absent"); return { ok: false, reason: "database" }; }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = input.now ?? Date.now();
  const reference = makeInternationalReference(now);
  const product = orderProduct(SUBSCRIPTION_ORDER);
  const label = `${orderLabel(SUBSCRIPTION_ORDER)} · Paiement international`;
  const amount = subscriptionAmountCents();
  if (!PURCHASE_REFERENCE_PATTERN.test(reference)) throw new Error("Référence invalide");

  const { data, error } = await supabase.rpc("create_international_order", {
    p_reference: reference,
    p_user_id: input.identity.userId,
    p_client_request_id: input.clientRequestId,
    p_product: product,
    p_label: label,
    p_amount: amount,
    p_currency: ORDER_CURRENCY,
    p_email: input.identity.email,
  });

  if (error) { console.error("[checkout-rest] RPC échouée :", error.message); return { ok: false, reason: "database" }; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.out_reference !== "string" || typeof row.out_user_id !== "string") { console.error("[checkout-rest] Réponse inattendue :", data); return { ok: false, reason: "database" }; }

  return { ok: true, reference: row.out_reference, userId: row.out_user_id, created: row.was_created === true, expiresAt: null };
}
