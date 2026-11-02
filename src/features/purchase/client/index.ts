/**
 * Server fns cote client (acheteur) : liste, instructions de paiement, avance.
 * Extraits de purchase-orders.ts (PR 2/3).
 */
import { createServerFn } from "@tanstack/react-start";
import {
  normalizePremiumOrderInput,
  orderProduct,
  type PremiumOrder,
} from "@/content/purchase-order";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  advanceSchema,
  instructionsSchema,
} from "@/features/purchase/schemas";
import {
  paymentConfiguration,
  toPurchase,
  type PremiumPaymentInstructions,
  type PurchaseRow,
} from "@/features/purchase/shared";

export const listPremiumPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<PurchaseRow>(
      `select * from purchase_orders
       where user_id = $1
       order by updated_at desc
       limit 500`,
      [context.userId],
    );
    return rows.map(toPurchase);
  });

export const getPremiumPaymentInstructions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(instructionsSchema)
  .handler(async ({ data, context }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } = await import(
      "@/server/supabase-env.server"
    );
    const env = mergedServerEnv(process.env);
    const url = resolveSupabaseUrl(env);
    const key = resolveSupabaseServiceKey(env);
    if (!url || !key) throw new Error("Supabase non configure");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await supabase.rpc("get_premium_purchase_order", {
      p_user_id: context.userId,
      p_reference: data.reference,
    });
    if (error || !row) throw new Error("Commande introuvable.");
    let current = row as PurchaseRow;
    if (["delivered", "rejected", "refunded"].includes(current.status))
      throw new Error("Cette commande est deja cloturee.");
    const config = paymentConfiguration();
    const instructions: PremiumPaymentInstructions = {
      ...config,
      amount: Number(current.amount),
      orderReference: current.reference,
      product: current.product,
    };
    if (!config.configured) return { purchase: toPurchase(current), instructions };
    if (current.status === "created") {
      const { data: updated, error: updErr } = await supabase.rpc(
        "advance_premium_purchase_order",
        {
          p_user_id: context.userId,
          p_reference: data.reference,
          p_new_status: "instructions_requested",
        },
      );
      if (updErr || !updated) throw new Error("Impossible de preparer les instructions.");
      current = updated as PurchaseRow;
    }
    return { purchase: toPurchase(current), instructions };
  });

export const advancePremiumPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(advanceSchema)
  .handler(async ({ data, context }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } = await import(
      "@/server/supabase-env.server"
    );
    const env = mergedServerEnv(process.env);
    const url = resolveSupabaseUrl(env);
    const key = resolveSupabaseServiceKey(env);
    if (!url || !key) throw new Error("Supabase non configure");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await supabase.rpc("advance_premium_purchase_order", {
      p_user_id: context.userId,
      p_reference: data.reference,
      p_new_status: data.status,
    });
    if (error || !row) throw new Error("Commande introuvable.");
    return toPurchase(row as PurchaseRow);
  });
