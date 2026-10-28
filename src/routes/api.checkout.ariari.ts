import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
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
        const session = await getSessionUser();
        if (!session) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        if (!isAriariConfigured()) {
          return Response.json({ ok: false, error: "ariari_unconfigured" }, { status: 503 });
        }

        const body = await request.json().catch(() => null);
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        const normalized = normalizePremiumOrderInput(parsed.data);
        const amount = orderAmount({
          reference: "TEMP",
          offer: normalized.offer,
          specialty: normalized.specialty,
          deckNumber: normalized.deckNumber,
        });

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
            userId: session.id,
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
