import { createFileRoute } from "@tanstack/react-router";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import { CONTENT_TOKEN_TTL_SECONDS, signContentToken } from "@/server/jwt";
import { verifyLicenceSession } from "@/server/licence-session.server";

/**
 * `POST /api/licenses/session` — échange une SESSION SUPABASE contre un JWT de
 * contenu (24 h).
 *
 * C'est le second chemin d'obtention du jeton, à côté de
 * `POST /api/licenses/verify` (qui échange une CLÉ). Il existe parce que la
 * table `licences` ne contient aucune clé échangeable : sans lui, un client dont
 * la licence a été créée côté Supabase restait bloqué sur « Activer ma licence ».
 *
 * Ce que le handler NE fait pas :
 *   • il ne fait jamais confiance au corps pour décider QUI est l'utilisateur :
 *     seul le jeton d'accès présenté compte, et c'est Supabase qui le valide ;
 *   • il ne lit aucune clé privée : `LICENSE_JWT_SECRET` signe des sessions
 *     éphémères, il n'ouvre aucun droit d'écriture.
 *
 * Réponses :
 *   200 `{ token, expiresAt, expiresIn, tier }`
 *   401 `unauthorized`        — jeton d'accès Supabase refusé
 *   403 `licence_required`    — utilisateur valide, aucune licence active
 *   429 `rate_limited`
 *   503 `license_verification_unavailable` — Supabase ou secret non configuré
 */

/** Un pont automatique se déclenche à chaque démarrage : quota plus large. */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Le corps ne porte qu'un jeton d'accès (~1 Ko) : au-delà on refuse. */
const MAX_BODY_BYTES = 8 * 1024;

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

export const Route = createFileRoute("/api/licenses/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Quota, avant toute lecture de corps (et donc avant tout coût).
        const decision = await rateLimitRequest(
          request,
          "license-session",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        // 2. Corps borné.
        const declared = Number(request.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          return json({ error: "invalid_body" }, 413);
        }
        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 413);

        let accessToken: unknown = null;
        try {
          const parsed = JSON.parse(raw || "{}") as unknown;
          if (parsed && typeof parsed === "object") {
            accessToken = (parsed as { accessToken?: unknown }).accessToken;
          }
        } catch {
          return json({ error: "invalid_body" }, 400);
        }
        if (typeof accessToken !== "string" || !accessToken.trim()) {
          return json({ error: "invalid_body" }, 400);
        }

        // 3. Jeton Supabase → utilisateur → licence active.
        const licence = await verifyLicenceSession(accessToken);
        if (!licence.ok) {
          if (licence.reason === "invalid") return json({ error: "unauthorized" }, 401);
          if (licence.reason === "no-licence") {
            // L'utilisateur est authentifié : lui dire « pas de licence » ne
            // divulgue rien sur les autres comptes (aucune énumération possible).
            return json({ error: "licence_required" }, 403);
          }
          return json({ error: "license_verification_unavailable" }, 503);
        }

        // 4. Signature du jeton de contenu.
        const signed = await signContentToken(licence.licenceId);
        if (!signed) {
          console.warn("[licenses/session] LICENSE_JWT_SECRET absent ou trop court");
          return json({ error: "license_verification_unavailable" }, 503);
        }

        return json(
          {
            token: signed.token,
            expiresAt: signed.expiresAt,
            expiresIn: CONTENT_TOKEN_TTL_SECONDS,
            tier: "premium",
          },
          200,
          { "Cache-Control": "no-store, max-age=0" },
        );
      },
    },
  },
});
