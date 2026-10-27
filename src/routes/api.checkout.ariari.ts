/**
 * `POST /api/checkout/ariari` — crée un paiement Mobile Money via Ariari.
 *
 * Flux :
 *   1. Auth (cookie Supabase) → contexte userId
 *   2. Valide la requête (offer/specialty/deckNumber)
 *   3. Calcule le montant via orderAmount()
 *   4. Appelle createAriariPayment()
 *   5. Retourne { paymentUrl, paymentId, amount }
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth/server";
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
        const auth = getAuth();
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        // 2. Config Ariari
        if (!isAriariConfigured()) {
          return Response.json({ ok: false, error: "ariari_unconfigured" }, { status: 503 });
        }

        // 3. Parse
        const body = await request.json().catch(() => null);
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        // 4. Montant (via purchase-order, source de vérité)
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
          });
        } catch (error) {
          console.error("[ariari] create payment failed", error);
          return Response.json({ ok: false, error: "ariari_failed" }, { status: 503 });
        }
      },
    },
  },
});
