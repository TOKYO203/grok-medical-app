import { createFileRoute } from "@tanstack/react-router";
import { handleLemonWebhook } from "@/server/lemonsqueezy/webhook";

/**
 * `POST /api/webhooks/lemonsqueezy` — webhook de paiement international.
 *
 * La route ne contient AUCUNE logique : tout vit dans
 * `src/server/lemonsqueezy/` (signature / livraison / handler), pour que les
 * tests puissent appeler le handler directement avec un `Request` fabriqué et
 * vérifier les codes HTTP réels (401 sur signature invalide, 200 sur rejeu,
 * 503 sur panne transitoire).
 *
 * Configuration requise :
 *   · `LEMONSQUEEZY_WEBHOOK_SECRET` (secret de signature déclaré dans Lemon
 *     Squeezy) — sans lui, la route répond 503 et n'accepte RIEN ;
 *   · `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — écriture de la licence
 *     dans `public.licences` (les GRANT de `docs/supabase/002-grants.sql`
 *     n'autorisent que le SELECT au rôle `authenticated`).
 *
 * URL à déclarer côté Lemon Squeezy :
 *   https://<domaine>/api/webhooks/lemonsqueezy
 * Événement à cocher : `order_created` (paiement unique).
 */
export const Route = createFileRoute("/api/webhooks/lemonsqueezy")({
  server: {
    handlers: {
      POST: async ({ request }) => handleLemonWebhook(request),
    },
  },
});
