/**
 * Server fns de creation de commande (premium + Ariari).
 * Extraits de purchase-orders.ts (PR 2/3).
 */
import { createServerFn } from "@tanstack/react-start";
import {
  normalizePremiumOrderInput,
  orderAmount,
  orderLabel,
  orderProduct,
  type PremiumOffer,
  type PremiumOrder,
  type PremiumPurchase,
} from "@/content/purchase-order";
import { authMiddleware } from "@/lib/auth/middleware";
import { createSchema } from "@/features/purchase/schemas";
import { toPurchase } from "@/features/purchase/shared";
import type { PurchaseRow } from "@/features/purchase/shared";

/**
 * Cree une commande dans Supabase via la RPC `create_premium_purchase_order`.
 * Fonction interne (pas de server fn) : appelee par createPremiumPurchaseOrder
 * et createAriariCheckout, sans double middleware.
 */
export async function createPurchaseOrderInternal(
  userId: string,
  data: {
    clientRequestId: string;
    offer: PremiumOffer;
    specialty?: string;
    deckNumber?: number;
  },
): Promise<PremiumPurchase> {
  const { createClient } = await import("@supabase/supabase-js");
  const { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } = await import(
    "@/server/supabase-env.server"
  );
  const env = mergedServerEnv(process.env);
  const url = resolveSupabaseUrl(env);
  const key = resolveSupabaseServiceKey(env);
  if (!url || !key) throw new Error("Supabase non configure");
  const normalized = normalizePremiumOrderInput({
    offer: data.offer,
    specialty: data.specialty,
    deckNumber: data.deckNumber,
  });
  const order: PremiumOrder = {
    reference: "TEMP",
    offer: normalized.offer,
    specialty: normalized.specialty,
    deckNumber: normalized.deckNumber,
  };
  const product = orderProduct(order);
  const label = orderLabel(order);
  const amount = orderAmount(order);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: row, error } = await supabase.rpc("create_premium_purchase_order", {
    p_user_id: userId,
    p_client_request_id: data.clientRequestId,
    p_optimus_id: userId,
    p_offer: normalized.offer,
    p_specialty: normalized.specialty,
    p_deck_number: normalized.deckNumber,
    p_product: product,
    p_label: label,
    p_amount: amount,
    p_currency: "MGA",
  });
  if (error || !row)
    throw new Error("La commande n'a pas pu etre creee: " + (error?.message || "unknown"));
  if ((row as { product: string }).product !== product)
    throw new Error("Cette demande idempotente correspond deja a une autre offre.");
  return toPurchase(row as PurchaseRow);
}

export const createPremiumPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createSchema)
  .handler(async ({ data, context }) => createPurchaseOrderInternal(context.userId, data));

export const createAriariCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createSchema)
  .handler(async ({ data, context }) => {
    const { createAriariPayment, isAriariConfigured } = await import(
      "@/server/ariari/ariari.server"
    );
    if (!isAriariConfigured()) {
      throw new Error("Paiement Mobile Money non configure");
    }
    const purchase = await createPurchaseOrderInternal(context.userId, data);
    const normalized = normalizePremiumOrderInput({
      offer: data.offer,
      specialty: data.specialty,
      deckNumber: data.deckNumber,
    });
    const order: PremiumOrder = {
      reference: "TEMP",
      offer: normalized.offer,
      specialty: normalized.specialty,
      deckNumber: normalized.deckNumber,
    };
    const amount = orderAmount(order);
    const origin =
      process.env.BETTER_AUTH_URL ??
      process.env.VITE_APP_URL ??
      "https://optimusmedical.pages.dev";
    const payment = await createAriariPayment({
      amount,
      name: `Optimus · ${purchase.reference}`,
      hooks: {
        redirectSuccess: `${origin}/paiement-retour?status=success&payment_id={PAYMENT_ID}`,
        redirectFailure: `${origin}/paiement-retour?status=failure&payment_id={PAYMENT_ID}`,
        silentSuccess: `${origin}/api/webhooks/ariari`,
        silentProgress: `${origin}/api/webhooks/ariari`,
        silentFailure: `${origin}/api/webhooks/ariari`,
      },
    });
    return {
      ok: true,
      paymentUrl: payment.url,
      paymentId: payment.id,
      amount,
      orderReference: purchase.reference,
      userId: context.userId,
    };
  });
