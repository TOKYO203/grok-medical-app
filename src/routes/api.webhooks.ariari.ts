/**
 * `POST /api/webhooks/ariari` — webhook Mobile Money (Ariari).
 *
 * Ariari ne documente pas de signature HMAC publique. On ne fait donc PAS
 * confiance au payload : on appelle fetchAriariPayment(paymentId) pour
 * vérifier le statut réel côté serveur Ariari.
 *
 * Quand le statut est "paid" :
 *   1. Extrait la référence CMD-… du champ `name` du paiement
 *      (format "Optimus · CMD-xxx" passé par createAriariCheckout)
 *   2. Construit un LemonEvent synthétique
 *   3. Appelle deliverLemonEventRest (idempotent) → crée la licence
 *
 * Codes retour :
 *   200 → succès, ignoré (pas payé), ou déjà livré (pas de rejeu utile)
 *   400 → payload illisible (pas de rejeu utile)
 *   503 → panne transitoire (Ariari rejoue)
 */
import { createFileRoute } from "@tanstack/react-router";
import { fetchAriariPayment } from "@/server/ariari/ariari.server";
import { deliverLemonEventRest } from "@/server/lemonsqueezy/delivery-rest";
import { responseForOutcome } from "@/server/lemonsqueezy/webhook";

export const Route = createFileRoute("/api/webhooks/ariari")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text().catch(() => "");
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        const paymentId =
          (payload.paymentId as string | undefined) ??
          (payload.payment_id as string | undefined) ??
          ((payload.payment as Record<string, unknown> | undefined)?.id as string | undefined);

        if (!paymentId) {
          return Response.json({ ok: false, error: "missing_payment_id" }, { status: 400 });
        }

        let info;
        try {
          info = await fetchAriariPayment(paymentId);
        } catch (error) {
          console.error("[ariari] fetch payment failed", error);
          return Response.json({ ok: false, error: "ariari_unreachable" }, { status: 503 });
        }

        console.info(`[ariari] payment ${paymentId} status=${info.status} amount=${info.amount}`);

        if (info.status !== "paid") {
          return Response.json({ ok: true, outcome: "ignored", status: info.status });
        }

        const nameMatch = /CMD(?:-SUB)?-[A-Z0-9]+-[A-F0-9]+/.exec(info.name ?? "");
        if (!nameMatch) {
          console.warn(`[ariari] payment ${paymentId} paid but no CMD-… in name: ${info.name}`);
          return Response.json({ ok: true, outcome: "unmatched", reason: "missing_reference" });
        }
        const orderReference = nameMatch[0];

        const event = {
          resourceId: paymentId,
          orderId: paymentId,
          name: "order_created",
          type: "orders",
          status: "paid",
          paid: true,
          userId: null,
          orderReference,
          email: null,
          total: info.amount,
          currency: "MGA",
          createdAt: new Date().toISOString(),
          testMode: false,
          idempotencyKey: `ariari-${paymentId}`,
        };

        try {
          const outcome = await deliverLemonEventRest(event, {
            env: process.env as Record<string, string | undefined>,
          });
          return responseForOutcome(outcome);
        } catch (error) {
          console.error("[ariari] delivery failed", error);
          return Response.json({ ok: false, error: "delivery_failed" }, { status: 503 });
        }
      },
    },
  },
});
