import { createFileRoute } from "@tanstack/react-router";
import { normalizeBatch } from "@/lib/analytics/events";
import { getSql } from "@/lib/db";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";

/**
 * `POST /api/events` — mesure produit auto-hébergée.
 *
 * Ce que ce handler refuse de faire :
 *   • il ne prend PAS l'identité du client (aucun `user_id` dans le corps) ;
 *     `user_id` n'est renseigné que si une session existe côté serveur ;
 *   • il n'accepte que des noms d'événements connus et des propriétés sur liste
 *     fermée (cf. `src/lib/analytics/events.ts`) — sinon n'importe quelle version
 *     modifiée de l'app pourrait écrire du texte libre dans la base ;
 *   • il ne journalise pas le contenu du lot en cas d'erreur.
 *
 * Réponses :
 *   202 `{ accepted, rejected }`
 *   400 `bad_request` / `too_many` / `empty`
 *   413 corps trop volumineux
 *   429 `rate_limited`
 */

const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Un lot de 25 événements pèse ~2 Ko ; 16 Ko laisse de la marge sans abus. */
const MAX_BODY_BYTES = 16 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const decision = await rateLimitRequest(request, "product-events", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
        if (!decision.ok) {
          return json(
            { error: "Trop de mesures envoyées." },
            429,
            { "Retry-After": String(retryAfterSeconds(decision)) },
          );
        }

        // Lecture bornée : on refuse AVANT de parser un corps énorme.
        const length = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
          return json({ error: "Lot trop volumineux." }, 413);
        }

        let payload: unknown;
        try {
          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) return json({ error: "Lot trop volumineux." }, 413);
          payload = JSON.parse(text);
        } catch {
          return json({ error: "Corps JSON invalide." }, 400);
        }

        const batch = normalizeBatch((payload as { events?: unknown })?.events);
        if (!batch.ok) {
          const messages: Record<string, string> = {
            empty: "Aucun événement.",
            too_many: "Trop d'événements dans le lot.",
            not_array: "Format invalide.",
          };
          return json({ error: messages[batch.reason] }, 400);
        }

        try {
          const sql = await getSql();
          for (const event of batch.events) {
            await sql.query(
              "insert into product_events (name, anon_id, props) values ($1, $2, $3::jsonb)",
              [event.name, event.anonId, JSON.stringify(event.props)],
            );
          }
        } catch (error) {
          // Panne de mesure = jamais d'erreur visible pour l'utilisateur, jamais
          // de détail interne dans la réponse : on renvoie 503 et le client
          // abandonne le lot (la mesure est un confort, pas une fonctionnalité).
          const code = (error as { code?: string }).code ?? "unknown";
          console.error("mesure produit indisponible", code);
          return json({ error: "Mesure temporairement indisponible." }, 503);
        }

        return json({ accepted: batch.events.length, rejected: batch.rejected }, 202);
      },
    },
  },
});
