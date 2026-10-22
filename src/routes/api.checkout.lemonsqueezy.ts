import { createFileRoute } from "@tanstack/react-router";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import {
  checkoutRequestSchema,
  createInternationalOrder,
  verifyCheckoutIdentity,
  type CheckoutSql,
} from "@/server/lemonsqueezy/checkout.server";

/**
 * `POST /api/checkout/lemonsqueezy` — ouvre un paiement international.
 *
 * Pourquoi une route serveur alors que l'URL de checkout se construit très bien
 * dans le navigateur : il faut une COMMANDE EN BASE avant le départ. C'est elle
 * qui porte la référence `CMD-…` transmise en `custom_data`, donc c'est elle
 * qui permet au webhook de retrouver l'acheteur et d'écrire la licence — sans
 * jamais croire un montant, un e-mail ou un identifiant envoyés par le client.
 *
 * Réponses :
 *   200 `{ reference }`
 *   400 `invalid_body`
 *   401 `unauthorized`      (jeton Supabase absent/refusé)
 *   429 `rate_limited`
 *   503 `checkout_unavailable` + `reason` : `identity_unconfigured` (variables
 *       Supabase absentes à l'exécution), `identity_unreachable` (Supabase n'a pas
 *       répondu) ou `database` (base injoignable : la commande ne peut pas être
 *       enregistrée, donc on n'encaisse pas).
 */

/** 10 ouvertures de paiement par IP et par minute : au-delà, c'est un robot. */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Le corps légitime fait ~60 octets. */
const MAX_BODY_BYTES = 1024;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

/** `Bearer <jeton>` — la seule forme acceptée. */
function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export const Route = createFileRoute("/api/checkout/lemonsqueezy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const decision = await rateLimitRequest(
          request,
          "lemon-checkout",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        const declared = Number(request.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          return json({ error: "invalid_body" }, 413);
        }
        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 413);

        let payload: unknown;
        try {
          payload = JSON.parse(raw || "{}");
        } catch {
          return json({ error: "invalid_body" }, 400);
        }
        const parsed = checkoutRequestSchema.safeParse(payload);
        if (!parsed.success) return json({ error: "invalid_body" }, 400);

        // L'identité vient du jeton vérifié par Supabase, jamais du corps.
        const identity = await verifyCheckoutIdentity(bearerToken(request.headers.get("authorization")));
        if (!identity.ok) {
          if (identity.reason === "invalid") return json({ error: "unauthorized" }, 401);
          // 503 : on ne peut pas JUGER l'identité (configuration absente ou
          // service injoignable). Le `reason` est grossier et volontairement
          // technique : il ne contient ni URL, ni clé, ni message de driver, mais
          // il évite le diagnostic à l'aveugle — c'est ce qui a coûté une session
          // entière le 2026-10-22 (503 indistinguable d'une base en panne).
          return json(
            {
              error: "checkout_unavailable",
              reason:
                identity.reason === "unconfigured"
                  ? "identity_unconfigured"
                  : "identity_unreachable",
            },
            503,
          );
        }

        let sql: CheckoutSql | null = null;
        try {
          const { getSql } = await import("@/lib/db");
          sql = (await getSql()) as unknown as CheckoutSql;
        } catch (error) {
          console.error("[checkout/lemonsqueezy] base indisponible", error);
          return json({ error: "checkout_unavailable", reason: "database" }, 503);
        }
        if (!sql) return json({ error: "checkout_unavailable", reason: "database" }, 503);

        const order = await createInternationalOrder({
          sql,
          identity: identity.identity,
          clientRequestId: parsed.data.clientRequestId,
        });
        if (!order.ok) {
          console.error("[checkout/lemonsqueezy] création de commande impossible");
          return json({ error: "checkout_unavailable", reason: "database" }, 503);
        }

        return json({
          reference: order.reference,
          created: order.created,
        });
      },
    },
  },
});
