/**
 * Livraison d'une commande Lemon Squeezy — SERVEUR uniquement.
 *
 * Ce module est la seule partie du webhook qui touche à l'état : il écrit la
 * licence dans Supabase (`public.licences`, celle que lit déjà le pont
 * `/api/licenses/session`) puis fait avancer la commande jusqu'à `delivered`.
 *
 * POURQUOI UN JOURNAL D'IDEMPOTENCE (`webhook_events`)
 * Lemon Squeezy rejoue un événement tant qu'il ne reçoit pas de 2xx. Sans
 * revendication atomique, un simple timeout APRÈS écriture produirait une
 * SECONDE licence pour un seul encaissement. L'`INSERT … ON CONFLICT DO
 * NOTHING` sur la clé primaire (provider, event_key) est le verrou — pas besoin
 * d'une table de verrous séparée.
 *
 * POURQUOI LES STATUTS INTERMÉDIAIRES SONT PARCOURUS UN PAR UN
 * `purchase_orders` porte un trigger (`guard_purchase_order_status_transition`,
 * migration 0011) qui refuse tout saut, y compris `created → delivered`. On ne
 * contourne pas ce garde-fou : on déroule la chaîne légale et on journalise
 * chaque étape. Le résultat est le même, l'audit dit la vérité.
 *
 * ⚠️ ORDRE DES ÉCRITURES : licence D'ABORD, `delivered` ENSUITE. Si Supabase
 * échoue, la commande reste à `payment_verified` et l'événement est marqué
 * `failed` : le rejeu de Lemon Squeezy retentera. L'inverse laisserait une
 * commande livrée sans accès — le pire état possible.
 */

// Import RELATIF volontaire : ces modules sont exécutés par `node --test`
// (`--experimental-strip-types`), qui ne résout pas l'alias `@/` du tsconfig.
import { licenseExpiryFor } from "../../content/purchase-order.ts";
import { SUBSCRIPTION_MONTHS } from "../../content/pricing.ts";
import type { LemonEvent } from "./signature.ts";

type Env = Record<string, string | undefined>;

/** Surface SQL minimale (compatible `Sql` de `@/lib/db` et un faux de test). */
export type WebhookSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type DeliveryDeps = {
  sql: WebhookSql;
  fetchImpl?: typeof fetch;
  env?: Env;
  now?: () => number;
};

export type DeliveryOutcome =
  | {
      kind: "delivered";
      reference: string;
      userId: string;
      licenceId: string | null;
      expiresAt: string;
      expiredNow: boolean;
    }
  | { kind: "duplicate"; eventKey: string; status: string }
  | { kind: "ignored"; reason: "not-paid" }
  | {
      kind: "unmatched";
      reason: "missing-user" | "missing-reference" | "order-not-found" | "order-closed";
    }
  | { kind: "failed"; reason: "licence" | "database" };

/**
 * Famille de licence écrite dans `public.licences`.
 *
 * Mesuré sur la table réelle : les lignes existantes portent `plan = 'premium'`.
 * La DURÉE n'est pas ici — elle vit dans `expires_at` (ancrée sur la commande,
 * cf. `licenceExpiryForEvent`). `isActiveLicence()` ne lit d'ailleurs que
 * `status`, `expires_at` et `activated_at` : ce libellé est descriptif.
 */
export const LEMON_LICENCE_PLAN = "premium";

/**
 * Clé stable d'une licence achetée chez Lemon Squeezy : `lemonsqueezy:<order_id>`.
 *
 * `licences.licence_hash` est NOT NULL (mesuré en production : sans lui, PostgREST
 * répond 23502 et la livraison échoue). L'utiliser comme identité de commande —
 * plutôt qu'une échéance recalculée — rend l'idempotence VRAIMENT indépendante du
 * temps : deux livraisons du même ordre écrivent la MÊME valeur, et un index
 * unique éventuel rejette la seconde au lieu de créer un doublon.
 *
 * Cette valeur n'est pas une clé échangeable (`isVerifiableLicenceKey` la refuse) :
 * c'est normal, le déblocage passe par le pont serveur `/api/licenses/session`
 * qui lit la ligne et signe un jeton de contenu.
 */
export function lemonLicenceHash(orderId: string): string {
  return `lemonsqueezy:${orderId}`;
}

/** Provider stocké sur la commande — sert aussi de filtre de recherche. */
export const LEMON_PROVIDER = "lemonsqueezy";

/**
 * Chaîne légale des statuts (cf. trigger de la migration 0011).
 * Exportée pour qu'un test la confronte au SQL : si quelqu'un ajoute un cran
 * côté base sans toucher ici, le webhook s'arrêterait en plein parcours.
 */
export const PROGRESS_PATH = [
  "created",
  "instructions_requested",
  "proof_ready",
  "verification_pending",
  "payment_verified",
  "delivered",
] as const;

const TERMINAL_STATUSES = new Set(["rejected", "refunded"]);

export type SupabaseAdminConfig = { url: string; key: string };

/**
 * URL + clé de service Supabase.
 *
 * La clé de service est la SEULE façon d'écrire `licences` : les GRANT de
 * `docs/supabase/002-grants.sql` n'autorisent pour `authenticated` qu'un
 * `SELECT`. Elle ne quitte jamais le serveur et n'est jamais journalisée.
 */
export function supabaseAdminConfig(env: Env = process.env as Env): SupabaseAdminConfig | null {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY ?? "").trim();
  if (!url || !key) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, key };
}

/**
 * Échéance de la licence, ancrée sur l'horodatage LEMON SQUEEZY de la commande.
 *
 * Ancrer sur `now` serait plus simple mais rendrait le calcul NON DÉTERMINISTE :
 * un rejeu (licence écrite puis panne avant le marquage `processed`) produirait
 * une échéance différente, donc un doublon impossible à reconnaître. Avec
 * l'horodatage de la commande, deux tentatives calculent la MÊME date et la
 * recherche « licence déjà émise » ci-dessous devient fiable.
 */
export function licenceExpiryForEvent(event: LemonEvent, now: number): string {
  const anchor = event.createdAt ? Date.parse(event.createdAt) : Number.NaN;
  const base = Number.isFinite(anchor) && anchor > 0 ? anchor : now;
  const expiry = licenseExpiryFor("subscription", base);
  if (expiry) return expiry;
  // Repli défensif : `subscription` est une offre DATÉE, `licenseExpiryFor` ne
  // peut pas renvoyer `null` pour elle. On garde une valeur calculable plutôt
  // que de renvoyer `null` et d'écrire une licence perpétuelle par accident.
  return new Date(base + SUBSCRIPTION_MONTHS * 30 * 86_400_000).toISOString();
}

/** Message d'erreur compact, sans jamais exposer de secret ni de DSN. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Les erreurs base portent parfois la requête complète : on tronque et on
    // retire les chaînes de connexion avant de journaliser.
    return `${error.name}: ${error.message}`
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>")
      .slice(0, 400);
  }
  return String(error).slice(0, 400);
}

function jsonb(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/** Revendique l'événement. `false` ⇒ déjà traité (ou en cours). */
async function claimEvent(
  sql: WebhookSql,
  event: LemonEvent,
  detail: Record<string, unknown>,
): Promise<boolean> {
  const rows = await sql.query<{ status: string }>(
    `insert into webhook_events (provider, event_key, event_name, status, detail)
     values ($1, $2, $3, 'received', $4::jsonb)
     on conflict (provider, event_key) do update
        set status = 'received',
            attempts = webhook_events.attempts + 1,
            detail = excluded.detail,
            updated_at = now()
      where webhook_events.status = 'failed'
     returning status`,
    [LEMON_PROVIDER, event.idempotencyKey, event.name, jsonb(detail)],
  );
  return rows.length > 0;
}

async function finishEvent(
  sql: WebhookSql,
  event: LemonEvent,
  status: "processed" | "ignored" | "unmatched" | "failed",
  detail: Record<string, unknown>,
): Promise<void> {
  await sql.query(
    `update webhook_events
        set status = $3, detail = $4::jsonb, updated_at = now()
      where provider = $1 and event_key = $2`,
    [LEMON_PROVIDER, event.idempotencyKey, status, jsonb(detail)],
  );
}

type OrderRow = {
  reference: string;
  user_id: string;
  status: string;
  product: string;
  currency: string | null;
  amount: number | string;
};

async function findOrder(
  sql: WebhookSql,
  event: LemonEvent,
): Promise<OrderRow | null> {
  // 1. Le cas nominal : la référence transmise en custom data au moment du
  //    clic, ET le propriétaire. Le second filtre n'est pas décoratif — il
  //    empêche de livrer la commande d'autrui si un custom data est falsifié.
  if (event.orderReference) {
    const rows = await sql.query<OrderRow>(
      `select reference, user_id, status, product, currency, amount
         from purchase_orders
        where reference = $1 and user_id = $2
        limit 1`,
      [event.orderReference, event.userId],
    );
    if (rows[0]) return rows[0];
  }

  // 2. Rejeu après une livraison partielle : la commande porte déjà la
  //    référence du fournisseur, donc on la retrouve sans custom data.
  const rows = await sql.query<OrderRow>(
    `select reference, user_id, status, product, currency, amount
       from purchase_orders
      where payment_provider = $1 and payment_reference = $2
      limit 1`,
    [LEMON_PROVIDER, event.orderId],
  );
  return rows[0] ?? null;
}

type LicenceRow = { id?: unknown; expires_at?: unknown };

/**
 * Écrit (ou retrouve) la licence Supabase de l'acheteur.
 *
 * La recherche préalable rend le rejeu inoffensif : même utilisateur, même
 * plan, MÊME échéance ⇒ c'est la licence déjà émise, on n'en crée pas une
 * seconde. `expires_at` étant ancré sur la commande (voir
 * `licenceExpiryForEvent`), la comparaison est exacte d'une tentative à l'autre.
 */
async function upsertSupabaseLicence(
  event: LemonEvent,
  expiresAt: string,
  userId: string,
  deps: Required<Pick<DeliveryDeps, "fetchImpl">> & { config: SupabaseAdminConfig; now: number },
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  const { config, fetchImpl } = deps;
  const headers = {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
    "content-type": "application/json",
    accept: "application/json",
  } as const;

  const licenceHash = lemonLicenceHash(event.orderId);

  // Recherche par la CLÉ DE COMMANDE, pas par une échéance recalculée : la
  // valeur est stable d'une tentative à l'autre, donc un rejeu retrouve
  // toujours la licence qu'il a lui-même écrite.
  const lookup =
    `${config.url}/rest/v1/licences?select=id` +
    `&licence_hash=eq.${encodeURIComponent(licenceHash)}&limit=1`;

  try {
    const existing = await fetchImpl(lookup, { method: "GET", headers });
    if (!existing.ok) {
      console.error(`[lemonsqueezy] lecture licence Supabase : HTTP ${existing.status}`);
      return { ok: false };
    }
    const rows = (await existing.json().catch(() => null)) as LicenceRow[] | null;
    const found = Array.isArray(rows) ? rows[0] : undefined;
    if (found) {
      return { ok: true, id: typeof found.id === "string" ? found.id : null };
    }

    const created = await fetchImpl(`${config.url}/rest/v1/licences`, {
      method: "POST",
      headers: { ...headers, prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify([
        {
          user_id: userId,
          // Colonne NOT NULL du schéma réel : sans elle, 23502.
          licence_hash: licenceHash,
          plan: LEMON_LICENCE_PLAN,
          status: "active",
          expires_at: expiresAt,
          activated_at: new Date(deps.now).toISOString(),
        },
      ]),
    });
    if (!created.ok) {
      const detail = await created.text().catch(() => "");
      console.error(
        `[lemonsqueezy] écriture licence Supabase : HTTP ${created.status} ${detail.slice(0, 300)}`,
      );
      return { ok: false };
    }
    const inserted = (await created.json().catch(() => null)) as LicenceRow[] | null;
    const row = Array.isArray(inserted) ? inserted[0] : undefined;
    return { ok: true, id: typeof row?.id === "string" ? row.id : null };
  } catch (error) {
    console.error("[lemonsqueezy] Supabase injoignable :", describeError(error));
    return { ok: false };
  }
}

/** Avance la commande d'un cran, avec journalisation. `true` si le cran est passé. */
async function advanceOrder(
  sql: WebhookSql,
  reference: string,
  from: string,
  to: string,
  event: LemonEvent,
  licenceId: string | null,
): Promise<boolean> {
  const rows = await sql.query<{ status: string }>(
    `with updated as (
       update purchase_orders
          set status = $3,
              payment_provider = $4,
              payment_reference = coalesce(payment_reference, $5),
              payment_verified_at = case
                when $3 = 'payment_verified' then coalesce(payment_verified_at, now())
                else payment_verified_at
              end,
              delivered_at = case
                when $3 = 'delivered' then coalesce(delivered_at, now())
                else delivered_at
              end,
              updated_at = now()
        where reference = $1 and status = $2
        returning reference, status
     ), logged as (
       insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
       select reference, $6, $3, $7::jsonb from updated
     )
     select status from updated`,
    [
      reference,
      from,
      to,
      LEMON_PROVIDER,
      event.orderId,
      event.userId,
      jsonb({
        source: LEMON_PROVIDER,
        providerOrderId: event.orderId,
        licenceId,
        testMode: event.testMode,
      }),
    ],
  );
  return rows.length > 0;
}

/**
 * Traite un événement payé : idempotence → licence → commande livrée.
 * Ne rejette jamais : toute panne devient un `kind` explicite.
 */
export async function deliverLemonEvent(
  event: LemonEvent,
  deps: DeliveryDeps,
): Promise<DeliveryOutcome> {
  const { sql } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? (process.env as Env);
  const now = deps.now ?? Date.now;

  // 1. Un événement non payé n'écrit rien — mais on répond 200 : demander à
  //    Lemon Squeezy de rejouer ne le rendrait pas payé.
  if (!event.paid) return { kind: "ignored", reason: "not-paid" };

  const detailBase = {
    event: event.name,
    resourceId: event.resourceId,
    providerOrderId: event.orderId,
    testMode: event.testMode,
    total: event.total,
    currency: event.currency,
  };

  // 2. Revendication atomique.
  let claimed: boolean;
  try {
    claimed = await claimEvent(sql, event, detailBase);
  } catch (error) {
    // Journaliser la CAUSE : un `catch` muet rend une panne de production
    // indistinguable d'un bug de code, et le verdict `failed` seul ne dit pas
    // quelle requête a échoué.
    console.error("[lemonsqueezy] revendication impossible :", describeError(error));
    return { kind: "failed", reason: "database" };
  }
  if (!claimed) return { kind: "duplicate", eventKey: event.idempotencyKey, status: "done" };

  // 3. Sans identité vérifiable, aucune licence ne peut être émise.
  if (!event.userId) {
    await finishEvent(sql, event, "unmatched", { ...detailBase, reason: "missing-user" }).catch(
      () => undefined,
    );
    return { kind: "unmatched", reason: "missing-user" };
  }

  if (!event.orderReference) {
    await finishEvent(sql, event, "unmatched", {
      ...detailBase,
      reason: "missing-reference",
      email: event.email,
    }).catch(() => undefined);
    return { kind: "unmatched", reason: "missing-reference" };
  }

  // 4. La commande créée au clic doit exister et appartenir à cet acheteur.
  let order: OrderRow | null;
  try {
    order = await findOrder(sql, event);
  } catch (error) {
    console.error("[lemonsqueezy] recherche de commande impossible :", describeError(error));
    return { kind: "failed", reason: "database" };
  }
  if (!order) {
    await finishEvent(sql, event, "unmatched", { ...detailBase, reason: "order-not-found" }).catch(
      () => undefined,
    );
    return { kind: "unmatched", reason: "order-not-found" };
  }
  if (TERMINAL_STATUSES.has(order.status)) {
    await finishEvent(sql, event, "unmatched", {
      ...detailBase,
      reason: "order-closed",
      status: order.status,
    }).catch(() => undefined);
    return { kind: "unmatched", reason: "order-closed" };
  }

  // 5. Licence d'abord (voir l'avertissement en tête de fichier).
  const config = supabaseAdminConfig(env);
  const expiresAt = licenceExpiryForEvent(event, now());
  let licenceId: string | null = null;

  if (config) {
    const licence = await upsertSupabaseLicence(event, expiresAt, order.user_id, {
      config,
      fetchImpl,
      now: now(),
    });
    if (!licence.ok) {
      await finishEvent(sql, event, "failed", {
        ...detailBase,
        reference: order.reference,
        reason: "licence-write-failed",
      }).catch(() => undefined);
      return { kind: "failed", reason: "licence" };
    }
    licenceId = licence.id;
  } else {
    // La licence EST le produit livré : sans clé de service, on ne peut pas
    // livrer. On échoue BRUYAMMENT (5xx) pour que Lemon Squeezy rejoue une
    // fois la configuration corrigée, au lieu de perdre un paiement.
    await finishEvent(sql, event, "failed", {
      ...detailBase,
      reference: order.reference,
      reason: "supabase-unconfigured",
    }).catch(() => undefined);
    return { kind: "failed", reason: "licence" };
  }

  // 6. Dérouler la chaîne légale des statuts jusqu'à `delivered`.
  const startIndex = PROGRESS_PATH.indexOf(order.status as (typeof PROGRESS_PATH)[number]);
  if (startIndex < 0) {
    await finishEvent(sql, event, "unmatched", {
      ...detailBase,
      reference: order.reference,
      reason: "unknown-status",
      status: order.status,
    }).catch(() => undefined);
    return { kind: "unmatched", reason: "order-closed" };
  }

  let current = order.status;
  for (let index = startIndex + 1; index < PROGRESS_PATH.length; index += 1) {
    const next = PROGRESS_PATH[index] as string;
    let moved: boolean;
    try {
      moved = await advanceOrder(sql, order.reference, current, next, event, licenceId);
    } catch (error) {
      console.error(
        `[lemonsqueezy] transition ${current} → ${next} refusée :`,
        describeError(error),
      );
      await finishEvent(sql, event, "failed", {
        ...detailBase,
        reference: order.reference,
        reason: "status-advance-failed",
        at: next,
      }).catch(() => undefined);
      return { kind: "failed", reason: "database" };
    }
    if (!moved) {
      await finishEvent(sql, event, "failed", {
        ...detailBase,
        reference: order.reference,
        reason: "status-race",
        at: next,
      }).catch(() => undefined);
      return { kind: "failed", reason: "database" };
    }
    current = next;
  }

  await finishEvent(sql, event, "processed", {
    ...detailBase,
    reference: order.reference,
    licenceId,
    expiresAt,
  }).catch(() => undefined);

  return {
    kind: "delivered",
    reference: order.reference,
    userId: order.user_id,
    licenceId,
    expiresAt,
    expiredNow: Date.parse(expiresAt) <= now(),
  };
}
