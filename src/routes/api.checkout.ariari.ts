/**
 * `POST /api/checkout/ariari` — crée un paiement Mobile Money via Ariari.
 *
 * Auth : requireUserId() (Supabase prioritaire, même chemin que
 * createPremiumPurchaseOrder). Ne touche à Better Auth QUE si pas de bearer
 * Supabase.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, UnauthorizedError, IdentityUnavailableError } from "@/lib/auth/verify.server";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import { createAriariPayment, isAriariConfigured } from "@/server/ariari/ariari.server";
import { normalizePremiumOrderInput, orderAmount } from "@/content/purchase-order";
import { z } from "zod";

const checkoutSchema = z.object({
  offer: z.enum(["deck", "specialty", "subscription"]),
  specialty: z.string().optional(),
  deckNumber: z.number().int().min(1).max(10).optional(),
});

export const Route = createFileRoute("/api/checkout/ariari")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 0. Quota — correctif audit 2026-11-20 : aligné sur l'homologue
        // Lemon Squeezy (10/min) ; plus de création de paiements par rafale.
        const rlDecision = await rateLimitRequest(request, "ariari-checkout", 10, 60_000);
        if (!rlDecision.ok) {
          return Response.json(
            { ok: false, error: "rate_limited" },
            { status: 429, headers: { "Retry-After": String(retryAfterSeconds(rlDecision)) } },
          );
        }

        // 1. Auth
        let userId: string;
        try {
          userId = await requireUserId();
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
          }
          if (error instanceof IdentityUnavailableError) {
            return Response.json({ ok: false, error: "identity_unavailable" }, { status: 503 });
          }
          // Audit 2026-11-17 : message d'erreur d'identification loggue
          // serveur, jamais renvoye brut au client.
          console.error("[checkout/ariari] identite indisponible", error);
          return Response.json(
            { ok: false, error: "auth_failed" },
            { status: 500 },
          );
        }

        // 2. Config Ariari
        if (!isAriariConfigured()) {
          return Response.json({ ok: false, error: "ariari_unconfigured" }, { status: 503 });
        }

        // 3. Parse body
        const body = await request.json().catch(() => null);
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        // 4. Montant
        const normalized = normalizePremiumOrderInput(parsed.data);
        const amount = orderAmount({
          reference: "TEMP",
          offer: normalized.offer,
          specialty: normalized.specialty,
          deckNumber: normalized.deckNumber,
        });

        // 5. Créer le paiement Ariari
        const origin = new URL(request.url).origin;
        try {
          const payment = await createAriariPayment({
            amount,
            name: `Optimus · ${normalized.offer}`,
            hooks: {
              redirectSuccess: `${origin}/paiement-retour?status=success&payment_id={PAYMENT_ID}`,
              redirectFailure: `${origin}/paiement-retour?status=failure&payment_id={PAYMENT_ID}`,
              silentSuccess: `${origin}/api/webhooks/ariari`,
              silentProgress: `${origin}/api/webhooks/ariari`,
              silentFailure: `${origin}/api/webhooks/ariari`,
            },
          });
          return Response.json({
            ok: true,
            paymentUrl: payment.url,
            paymentId: payment.id,
            amount,
            userId,
          });
        } catch (error) {
          // Audit 2026-11-17 : le message brut du provider (URL, diagnostics
          // internes) reste dans les logs serveur ; le client recoit une
          // reponse stable, sans oracle d'information.
          console.error("[checkout/ariari] creation de paiement impossible", error);
          return Response.json(
            { ok: false, error: "ariari_failed" },
            { status: 503 },
          );
        }
      },
    },
  },
});
