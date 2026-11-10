import { createFileRoute } from "@tanstack/react-router";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import { signContentToken } from "@/server/jwt";

/**
 * `POST /api/licenses/trial-token` — JETON D'ESSAI du contenu Premium
 * (pentest 2026-11-09 §14, option 1 recommandée).
 *
 * POURQUOI CE MODULE EXISTE
 * L'essai Premium (`isTrialActive`) était purement client : il affichait le
 * contenu Pro déjà téléchargé dans `public/data/**`. Depuis le split
 * index/contenu (§1/§14/§15), le contenu Pro ne sort que contre un jeton de
 * contenu — l'essai doit donc être matérialisé CÔTÉ SERVEUR pour rester réel.
 *
 * Ce jeton porte les mêmes claims que celui d'une licence (tier premium), avec
 * un TTL court (2 h) et un quota serré par IP de confiance (5 / 24 h) : un
 * visiteur anonyme peut goûter au contenu, pas le moissonner. Aucune clé, aucun
 * compte, aucun corps de requête — le curseur produit (durée, quota) se règle
 * ici, sous revue de code.
 *
 * Réponses :
 *   200 `{ token, expiresAt, tier: "trial", expiresIn }`
 *   429 `rate_limited` (+ `Retry-After`)
 *   503 `license_verification_unavailable` (`LICENSE_JWT_SECRET` absent)
 *
 * Depuis le pentest §4, la réponse 200 pose AUSSI le cookie de session
 * `optimus_session` (HttpOnly, Secure, SameSite=Lax, Max-Age = TTL du jeton).
 */

/** Durée de vie d'un jeton d'essai : assez pour une session d'entraînement. */
export const TRIAL_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/** 5 jetons d'essai par IP de confiance et par 24 h. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Cookie de session posé par le serveur (pentest §4) : jamais lisible en JS. */
const SESSION_COOKIE_NAME = "optimus_session";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Un jeton de session ne doit JAMAIS être mis en cache par un proxy.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export const Route = createFileRoute("/api/licenses/trial-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Quota d'abord : aucun travail, même pas une signature, sans budget.
        const decision = await rateLimitRequest(
          request,
          "license-trial",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        const signed = await signContentToken("trial", Date.now(), TRIAL_TOKEN_TTL_SECONDS);
        if (!signed) {
          console.warn("[licenses/trial-token] LICENSE_JWT_SECRET absent ou trop court");
          return json({ error: "license_verification_unavailable" }, 503);
        }

        // Cookie de session HttpOnly (pentest §4) : posé par le serveur,
        // jamais lisible ni modifiable en JavaScript côté client.
        const sessionCookie =
          `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed.token)};` +
          ` Path=/; Max-Age=${TRIAL_TOKEN_TTL_SECONDS}; SameSite=Lax; HttpOnly; Secure`;

        return json(
          {
            token: signed.token,
            expiresAt: signed.expiresAt,
            expiresIn: TRIAL_TOKEN_TTL_SECONDS,
            tier: "trial",
          },
          200,
          { "Cache-Control": "no-store, max-age=0", "Set-Cookie": sessionCookie },
        );
      },
    },
  },
});
