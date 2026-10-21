/**
 * Ouverture d'un paiement international — SERVEUR uniquement.
 *
 * Deux responsabilités, dans cet ordre :
 *   1. **Identifier l'acheteur** : le jeton d'accès Supabase est vérifié PAR
 *      SUPABASE (`GET /auth/v1/user`). Aucune clé de service n'est utilisée ici
 *      et l'identifiant n'est jamais accepté depuis le corps de la requête.
 *   2. **Créer la commande AVANT le départ vers Lemon Squeezy** : c'est ce qui
 *      permet de transmettre une référence `CMD-…` dans `custom_data`, donc de
 *      retrouver la commande au retour du webhook et de la livrer sans jamais
 *      faire confiance à un montant envoyé par le client.
 *
 * ⚠️ `user_id` ET `optimus_id` valent l'identifiant Supabase.
 * L'Optimus ID (`OM-XXXXXXXX`) est une identité LOCALE malgache, dérivée d'un
 * appareil et synchronisée via Better Auth. Un acheteur international n'en a
 * pas au moment de payer : inventer un `OM-…` fabriquerait une identité qui ne
 * correspondrait à aucun profil. Les deux colonnes restent donc renseignées
 * (elles sont `NOT NULL`) avec l'identité réellement vérifiée.
 *
 * ⚠️ `amount` est exprimé en UNITÉ MINEURE de `currency` (cf. migration 0016) :
 * 1900 + 'EUR' = 19,00 €. Sans la colonne `currency`, la même ligne se lirait
 * « 1 900 Ar » dans le back-office.
 */

import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  orderLabel,
  orderProduct,
  purchaseReferencePrefix,
  PURCHASE_REFERENCE_PATTERN,
  type PremiumOrder,
} from "../../content/purchase-order.ts";
import { subscriptionAmountCents } from "../../content/international.ts";
import {
  isValidAccessToken,
  supabaseServerConfig,
} from "../licence-session.server.ts";

type Env = Record<string, string | undefined>;

/** Surface SQL minimale (compatible `Sql` de `@/lib/db` et un faux de test). */
export type CheckoutSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export const checkoutRequestSchema = z.object({
  clientRequestId: z.string().uuid(),
});

export type CheckoutIdentity = { userId: string; email: string | null };

export type CheckoutIdentityResult =
  | { ok: true; identity: CheckoutIdentity }
  | { ok: false; reason: "unconfigured" | "invalid" | "unreachable" };

/**
 * Vérifie le jeton auprès de Supabase (c'est l'émetteur qui juge, pas nous).
 * Ne rejette jamais : toute panne devient un `reason` explicite.
 */
export async function verifyCheckoutIdentity(
  accessToken: unknown,
  deps: { fetchImpl?: typeof fetch; env?: Env } = {},
): Promise<CheckoutIdentityResult> {
  const config = supabaseServerConfig(deps.env ?? (process.env as Env));
  if (!config) return { ok: false, reason: "unconfigured" };
  // Même validateur que le pont de licence : une seule définition de « jeton
  // plausible » dans le dépôt, donc un seul endroit à corriger.
  if (!isValidAccessToken(accessToken)) return { ok: false, reason: "invalid" };

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken.trim()}`,
        accept: "application/json",
      },
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid" };
    }
    if (!response.ok) return { ok: false, reason: "unreachable" };

    const user = (await response.json().catch(() => null)) as {
      id?: unknown;
      email?: unknown;
    } | null;
    const userId = typeof user?.id === "string" ? user.id.trim() : "";
    if (!userId) return { ok: false, reason: "invalid" };
    const email =
      typeof user?.email === "string" && user.email.trim() ? user.email.trim() : null;
    return { ok: true, identity: { userId, email } };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/**
 * Référence de commande — MÊME forme que le tunnel historique
 * (`CMD-SUB-<horodatage base36>-<8 hex>`), donc acceptée par
 * `PURCHASE_REFERENCE_PATTERN` et par tous les écrans d'administration qui
 * valident une référence. Le fournisseur, lui, est porté par
 * `purchase_orders.payment_provider`.
 */
export function makeInternationalReference(now = Date.now()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${purchaseReferencePrefix("subscription")}-${now.toString(36).toUpperCase()}-${suffix}`;
}

export type CreateOrderResult =
  | { ok: true; reference: string; userId: string; created: boolean; expiresAt: string | null }
  | { ok: false; reason: "database" };

/**
 * Forme canonique de la commande internationale. `reference` n'est pas encore
 * connue ici : `orderProduct()` / `orderLabel()` ne la lisent pas (elle ne sert
 * qu'au stockage et à la recherche), d'où cette valeur d'attente explicite
 * plutôt qu'un objet partiel.
 */
const SUBSCRIPTION_ORDER: PremiumOrder = {
  reference: "CMD-SUB-PREVIEW-00000000",
  offer: "subscription",
  specialty: "all",
  deckNumber: 1,
};

/** Devise de l'offre internationale (ISO 4217) — cf. migration 0016. */
const ORDER_CURRENCY = "EUR";

/**
 * Insère la commande (ou renvoie celle du même `clientRequestId`).
 *
 * L'idempotence est portée par `UNIQUE (user_id, client_request_id)` : un
 * double-clic sur « Payer par carte » produit donc UNE commande, pas deux —
 * sans quoi deux références distinctes seraient envoyées au même checkout et
 * une seule serait livrable.
 */
export async function createInternationalOrder(
  input: { sql: CheckoutSql; identity: CheckoutIdentity; clientRequestId: string; now?: number },
): Promise<CreateOrderResult> {
  const { sql, identity, clientRequestId } = input;
  const now = input.now ?? Date.now();

  const reference = makeInternationalReference(now);
  const product = orderProduct(SUBSCRIPTION_ORDER);
  const label = `${orderLabel(SUBSCRIPTION_ORDER)} · Paiement international`;
  const amount = subscriptionAmountCents();

  if (!PURCHASE_REFERENCE_PATTERN.test(reference)) {
    // Garde-fou de forme : si le format change un jour, on veut le savoir ici
    // plutôt que de découvrir en production que l'administration refuse la ligne.
    throw new Error("Référence de commande invalide");
  }

  try {
    const rows = await sql.query<{ reference: string; user_id: string }>(
      `insert into purchase_orders (
         reference, user_id, client_request_id, optimus_id, offer, specialty,
         deck_number, product, label, amount, currency, status,
         payment_provider, created_at, updated_at
       ) values ($1,$2,$3,$4,'subscription','all',1,$5,$6,$7,$8,'created','lemonsqueezy',now(),now())
       on conflict (user_id, client_request_id)
       do update set client_request_id = excluded.client_request_id
       returning reference, user_id`,
      [
        reference,
        identity.userId,
        clientRequestId,
        identity.userId,
        product,
        label,
        amount,
        ORDER_CURRENCY,
      ],
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: "database" };

    const created = row.reference === reference;
    if (created) {
      await sql.query(
        `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
         values ($1, $2, 'created', $3::jsonb)`,
        [
          row.reference,
          identity.userId,
          JSON.stringify({
            source: "lemonsqueezy",
            offer: "subscription",
            amount,
            currency: "EUR",
            email: identity.email,
          }),
        ],
      );
    }

    return {
      ok: true,
      reference: row.reference,
      userId: row.user_id,
      created,
      // L'échéance n'est PAS décidée ici : elle le sera à la livraison, ancrée
      // sur l'horodatage de la commande Lemon Squeezy (cf. delivery.ts).
      expiresAt: null,
    };
  } catch {
    return { ok: false, reason: "database" };
  }
}
