import { createFileRoute } from "@tanstack/react-router";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import { CONTENT_TOKEN_TTL_SECONDS, signContentToken } from "@/server/jwt";
import { verifyLicenseKey } from "@/server/license-verify";
import { NONCE_PATTERN, consumeNonce } from "@/server/replay-guard";

/**
 * `POST /api/licenses/verify` — échange une CLÉ DE LICENCE contre un JWT de
 * contenu (24 h), seul justificatif accepté par `/content/pathologies/**` et
 * `/content/signes/**`.
 *
 * Défenses, dans cet ordre (l'ordre compte : on paie le moins cher d'abord) :
 *   1. **Quota** 10 requêtes / heure / IP de confiance — AVANT toute lecture de
 *      corps, pour qu'aucune tentative (valide ou non) ne soit gratuite ;
 *   2. **Nonce anti-replay** (`X-Nonce`, usage unique, TTL 5 min) — une requête
 *      capturée ne peut pas être rejouée pour obtenir un second jeton ;
 *   3. **Corps borné** (2 Kio) et validé ;
 *   4. **Vérification de la licence** : signature Ed25519 avec la clé PUBLIQUE
 *      seule, ou clé d'activation en base liée à l'appareil (voir
 *      `src/server/license-verify.ts`) ;
 *   5. **Signature du JWT** avec `LICENSE_JWT_SECRET` (jamais exposé).
 *
 * Réponses :
 *   200 `{ token, expiresAt, tier, expiresIn }`
 *   400 `nonce_required` / `invalid_body`
 *   401 `unauthorized` (clé invalide, expirée, révoquée ou déjà liée ailleurs)
 *   429 `rate_limited` / `nonce_replayed`
 *   503 `license_verification_unavailable` (base ou secret non configuré)
 *
 * ⚠️ Aucune clé privée n'est lue ici : `LICENSE_PUBLIC_KEY` est publique par
 * construction et `LICENSE_SIGNING_PRIVATE_KEY` (utilisée par
 * `/api/licenses/activate`) reste un secret serveur distinct.
 */

/** 10 vérifications par IP et par heure (contrat de sécurité du module). */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Un corps légitime fait ~120 octets ; au-delà on refuse sans lire. */
const MAX_BODY_BYTES = 2 * 1024;

type VerifyBody = { licenseKey?: unknown; deviceId?: unknown };

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

export const Route = createFileRoute("/api/licenses/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Quota — avant tout travail, même avant de lire le corps.
        const decision = rateLimitRequest(
          request,
          "license-verify",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        // 2. Nonce : exigé, formaté, à usage unique.
        const nonce = request.headers.get("x-nonce")?.trim() ?? "";
        if (!NONCE_PATTERN.test(nonce)) {
          return json({ error: "nonce_required" }, 400);
        }
        const nonceVerdict = await consumeNonce(nonce);
        if (nonceVerdict === "replayed") {
          return json({ error: "nonce_replayed" }, 429);
        }
        if (nonceVerdict === "unavailable") {
          // Anti-replay indisponible ⇒ on ferme (fail closed), sinon un rejeu
          // illimité serait possible pendant la panne.
          return json({ error: "license_verification_unavailable" }, 503);
        }

        // 3. Corps borné.
        const declared = Number(request.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          return json({ error: "invalid_body" }, 413);
        }
        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 413);

        let body: VerifyBody = {};
        try {
          const parsed = JSON.parse(raw || "{}") as unknown;
          if (parsed && typeof parsed === "object") body = parsed as VerifyBody;
        } catch {
          return json({ error: "invalid_body" }, 400);
        }

        const licenseKey = typeof body.licenseKey === "string" ? body.licenseKey : "";
        const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;
        if (!licenseKey.trim()) return json({ error: "invalid_body" }, 400);

        // 4. Vérification de la licence (clé publique seule, ou base).
        const license = await verifyLicenseKey(licenseKey, { deviceId });
        if (!license.ok) {
          if (license.reason === "unavailable") {
            return json({ error: "license_verification_unavailable" }, 503);
          }
          // Message volontairement générique : « inconnue », « expirée »,
          // « révoquée » et « liée à un autre appareil » sont indiscernables
          // pour un appelant anonyme (anti-énumération).
          return json({ error: "unauthorized" }, 401);
        }

        // 5. Jeton de contenu.
        const signed = await signContentToken(license.licenseId);
        if (!signed) {
          console.warn("[licenses/verify] LICENSE_JWT_SECRET absent ou trop court");
          return json({ error: "license_verification_unavailable" }, 503);
        }

        return json(
          {
            token: signed.token,
            // Epoch millisecondes : le client peut planifier le renouvellement.
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
