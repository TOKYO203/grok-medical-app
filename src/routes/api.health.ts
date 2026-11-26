import { createFileRoute } from "@tanstack/react-router";

/**
 * `GET /api/health` — sonde de vivacité, pour un moniteur uptime.
 *
 * VOLONTAIREMENT TRIVIALE : aucun accès base, aucun appel réseau, aucune
 * variable d'environnement lue. Elle répond à une seule question — « le
 * déploiement sert-il des requêtes ? » — et c'est exactement ce qu'un moniteur
 * externe doit vérifier. La disponibilité de la base et la configuration de
 * paiement sont décrites par `/api/health/checkout`, plus lourde et réservée au
 * diagnostic.
 *
 * Rien de sensible : ni version de build, ni identifiant de projet, ni drapeau
 * de configuration — un attaquant n'apprend rien, un moniteur a ce qu'il veut.
 */
const SERVICE = "optimus";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        json({
          status: "ok",
          service: SERVICE,
          time: new Date().toISOString(),
        }),
      HEAD: () =>
        new Response(null, {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "x-robots-tag": "noindex",
          },
        }),
    },
  },
});
