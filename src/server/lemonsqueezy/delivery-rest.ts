import { createClient } from "@supabase/supabase-js";
import { licenceExpiryForEvent, lemonLicenceHash, type DeliveryOutcome } from "./delivery.ts";
import { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } from "../supabase-env.server.ts";
import type { LemonEvent } from "./signature.ts";

type Env = Record<string, string | undefined>;

export async function deliverLemonEventRest(
  event: LemonEvent,
  deps: { env?: Env; now?: () => number } = {},
): Promise<DeliveryOutcome> {
  const env = deps.env ?? (process.env as Env);
  const merged = mergedServerEnv(env);
  const url = resolveSupabaseUrl(merged);
  const key = resolveSupabaseServiceKey(merged);
  const now = deps.now ?? Date.now;

  if (!url || !key) {
    console.error("[lemonsqueezy-rest] SUPABASE_URL ou SERVICE_ROLE absent");
    return { kind: "failed", reason: "licence" };
  }

  if (!event.paid) return { kind: "ignored", reason: "not-paid" };

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const licenceHash = lemonLicenceHash(event.orderId);
  const expiresAt = licenceExpiryForEvent(event, now());

  const { data, error } = await supabase.rpc("deliver_lemon_event", {
    p_event_key: event.idempotencyKey,
    p_event_name: event.name,
    p_user_id: event.userId,
    p_order_reference: event.orderReference,
    p_licence_hash: licenceHash,
    p_expires_at: expiresAt,
    p_paid: event.paid,
    p_detail: { order_id: event.orderId, testMode: event.testMode },
  });

  if (error) {
    console.error("[lemonsqueezy-rest] RPC échouée :", error.message);
    return { kind: "failed", reason: "database" };
  }
  const r = Array.isArray(data) ? data[0] : data;
  if (!r || typeof r.outcome !== "string") {
    console.error("[lemonsqueezy-rest] Réponse inattendue :", data);
    return { kind: "failed", reason: "database" };
  }
  switch (r.outcome) {
    case "delivered":
      return { kind: "delivered", reference: r.reference, userId: r.user_id, licenceId: r.licence_id, expiresAt: r.expires_at, expiredNow: Date.parse(r.expires_at) <= now() };
    case "duplicate":
      return { kind: "duplicate", eventKey: event.idempotencyKey, status: "done" };
    case "ignored":
      return { kind: "ignored", reason: (r.reason ?? "not-paid") as "not-paid" };
    case "unmatched":
      return { kind: "unmatched", reason: (r.reason ?? "missing-user") as any };
    default:
      return { kind: "failed", reason: "database" };
  }
}
