/**
 * `POST /api/checkout/ariari` — crée un paiement Mobile Money via Ariari.
 *
 * Auth : requireUserId() (Supabase prioritaire, même chemin que
 * createPremiumPurchaseOrder). Ne touche à Better Auth QUE si pas de bearer
 * Supabase.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, UnauthorizedError, IdentityUnavailableError } from "@/lib/auth/verify.server";
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
          return Response.json(
            { ok: false, error: "auth_failed", message: error instanceof Error ? error.message : String(error) },
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
          return Response.json(
            {
              ok: false,
              error: "ariari_failed",
              message: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
