/**
 * `POST /api/webhooks/ariari` — webhook Mobile Money (Ariari).
 *
 * Sécurité : Ariari ne documente pas de signature HMAC publique.
 * → On ne fait PAS confiance au payload. À chaque hit, on appelle
 *   fetchAriariPayment(id) pour confirmer le statut RÉEL.
 *
 * Si statut PAID → on log l'événement (le delivery via deliverLemonEventRest
 * est à brancher après validation manuelle du mapping payment_id ↔ reference).
 */
import { createFileRoute } from "@tanstack/react-router";
import { fetchAriariPayment } from "@/server/ariari/ariari.server";

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

        // Vérif réelle côté Ariari
        let info;
        try {
          info = await fetchAriariPayment(paymentId);
        } catch (error) {
          console.error("[ariari] fetch payment failed", error);
          return Response.json({ ok: false, error: "ariari_unreachable" }, { status: 503 });
        }

        console.info(`[ariari] payment ${paymentId} status=${info.status} amount=${info.amount}`);

        // PENDING/INCOMPLETE → ignorer (pas de rejeu côté Ariari)
        if (info.status !== "PAID") {
          return Response.json({ ok: true, outcome: "ignored", status: info.status });
        }

        // PAID → TODO brancher deliverLemonEventRest avec le mapping
        // payment_id ↔ purchase_orders.reference (à faire quand le tunnel
        // sera validé manuellement en sandbox).
        return Response.json({ ok: true, outcome: "paid_acknowledged", paymentId });
      },
    },
  },
});
