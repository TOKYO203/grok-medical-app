/**
 * Handler HTTP du webhook Lemon Squeezy — la seule partie « Request/Response ».
 *
 * Il est isolé de la route (`src/routes/api.webhooks.lemonsqueezy.ts`) pour une
 * raison précise : on peut alors l'appeler DIRECTEMENT dans un test avec un
 * `Request` fabriqué, et vérifier les codes HTTP réellement renvoyés (401 sur
 * signature invalide, 200 sur rejeu, 503 sur panne) — pas seulement la valeur
 * d'un booléen interne.
 *
 * SÉMANTIQUE DES CODES (elle pilote les rejeux de Lemon Squeezy) :
 *   401 / 400 / 413 → appel non authentifié ou illisible : inutile de rejouer.
 *   200             → traité, ignoré (non payé) ou déjà traité : rejouer est
 *                     sans effet, donc on l'arrête.
 *   503             → panne TRANSITOIRE de notre côté (base, Supabase, secret
 *                     absent). On répond 5xx pour que l'événement soit rejoué :
 *                     répondre 200 perdrait un paiement en silence.
 */

import {
  MAX_WEBHOOK_BYTES,
  SIGNATURE_HEADER,
  extractLemonEvent,
  lemonWebhookSecret,
  verifyLemonSignature,
  type LemonEvent,
} from "./signature.ts";
import {
  deliverLemonEvent,
  type DeliveryDeps,
  type DeliveryOutcome,
  type WebhookSql,
} from "./delivery.ts";

type Env = Record<string, string | undefined>;

export type WebhookDeps = {
  /** Base de données ; chargée à la demande en production. */
  sql?: WebhookSql;
  fetchImpl?: typeof fetch;
  env?: Env;
  now?: () => number;
  /** Force le secret (tests). `undefined` ⇒ lu depuis l'environnement. */
  secret?: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Une réponse de webhook n'est jamais mise en cache par un proxy.
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Réponse HTTP associée à une issue métier. */
export function responseForOutcome(outcome: DeliveryOutcome): Response {
  switch (outcome.kind) {
    case "delivered":
      return json({
        ok: true,
        outcome: "delivered",
        reference: outcome.reference,
        licenceId: outcome.licenceId,
        expiresAt: outcome.expiresAt,
      });
    case "duplicate":
      return json({ ok: true, outcome: "duplicate", eventKey: outcome.eventKey });
    case "ignored":
      return json({ ok: true, outcome: "ignored", reason: outcome.reason });
    case "unmatched":
      // 200 volontairement : un rejeu ne créera pas l'identité manquante.
      // L'événement est conservé en base (`webhook_events.status = 'unmatched'`)
      // pour un traitement manuel — rien n'est perdu.
      return json({ ok: true, outcome: "unmatched", reason: outcome.reason });
    case "failed":
      return json({ ok: false, outcome: "failed", reason: outcome.reason }, 503);
  }
}

/**
 * Traite une requête de webhook de bout en bout.
 *
 * `pollEvent` sert aux tests : il permet de rejouer le même événement comme le
 * ferait Lemon Squeezy.
 */
export async function handleLemonWebhook(
  request: Request,
  deps: WebhookDeps = {},
): Promise<Response> {
  const env = deps.env ?? (process.env as Env);

  // 1. Corps BRUT, borné. On n'appelle JAMAIS `request.json()` : la signature
  //    porte sur les octets reçus, pas sur un objet réécrit.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_WEBHOOK_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  // 2. Signature — AVANT tout parsing, tout accès base et toute écriture.
  const secret = deps.secret === undefined ? lemonWebhookSecret(env) : deps.secret;
  const verdict = await verifyLemonSignature(
    rawBody,
    request.headers.get(SIGNATURE_HEADER),
    secret,
  );
  if (verdict === "unconfigured") {
    console.error("[lemonsqueezy] LEMONSQUEEZY_WEBHOOK_SECRET absent : webhook refusé");
    return json({ ok: false, error: "webhook_unconfigured" }, 503);
  }
  if (verdict === "invalid") {
    // Aucun détail sur la raison : même réponse pour un en-tête absent, mal
    // formé ou simplement faux (pas d'oracle pour un attaquant).
    return json({ ok: false, error: "invalid_signature" }, 401);
  }

  // 3. Parsing et lecture seulement APRÈS authentification.
  let event: LemonEvent | null;
  try {
    event = extractLemonEvent(JSON.parse(rawBody));
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  if (!event) return json({ ok: false, error: "invalid_body" }, 400);

  // 4. Effets métier.
  let sql = deps.sql;
  if (!sql) {
    try {
      const { getSql } = await import("@/lib/db");
      sql = (await getSql()) as unknown as WebhookSql;
    } catch (error) {
      console.error("[lemonsqueezy] base indisponible", error);
      return json({ ok: false, error: "database_unavailable" }, 503);
    }
  }

  const deliveryDeps: DeliveryDeps = {
    sql,
    fetchImpl: deps.fetchImpl,
    env,
    now: deps.now,
  };

  const outcome = await deliverLemonEvent(event, deliveryDeps);
  if (outcome.kind === "delivered") {
    console.info(
      `[lemonsqueezy] ${event.name} ${event.orderId} → ${outcome.reference} livrée`,
    );
  } else if (outcome.kind === "unmatched") {
    console.warn(
      `[lemonsqueezy] ${event.name} ${event.orderId} non rattaché (${outcome.reason})`,
    );
  } else if (outcome.kind === "failed") {
    console.error(`[lemonsqueezy] ${event.name} ${event.orderId} échoué (${outcome.reason})`);
  }

  return responseForOutcome(outcome);
}
