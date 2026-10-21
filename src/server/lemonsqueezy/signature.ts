/**
 * Webhooks Lemon Squeezy — vérification de signature et lecture de l'événement.
 *
 * MODULE PUR : aucune I/O, aucun réseau, aucune horloge. Le handler
 * (`src/server/lemonsqueezy/webhook.ts`) ne fait que brancher ces fonctions sur
 * `Request` / `Response`, ce qui rend tout ce qui décide testable sous
 * `node --test` sans base ni serveur — même convention que
 * `src/server/license-verify.ts`.
 *
 * Contrat Lemon Squeezy (docs « Signing requests ») :
 *   X-Signature = HMAC-SHA256(secret, corps BRUT de la requête), hexadécimal.
 *
 * Deux conséquences non négociables :
 *   1. on signe les OCTETS REÇUS, jamais `JSON.stringify(payload)` : une clé
 *      réordonnée ou un espace déplacé changerait le HMAC et ferait rejeter un
 *      webhook pourtant authentique ;
 *   2. la comparaison est à TEMPS CONSTANT — un `===` laisse fuir, par le temps
 *      de réponse, la longueur du préfixe correct.
 *
 * Aucun import `node:crypto` : Web Crypto existe sous Node ≥ 18 ET sous
 * Cloudflare Workers, alors qu'un `node:crypto` imposerait `nodejs_compat` sur
 * l'edge. C'est déjà le choix de `src/content/deck-signature.ts`.
 */

/** En-tête portant la signature (`Headers` est insensible à la casse). */
export const SIGNATURE_HEADER = "x-signature";

/** Un payload réel pèse ~4 Kio ; au-delà de 256 Kio on refuse sans signer. */
export const MAX_WEBHOOK_BYTES = 256 * 1024;

/** Empreinte HMAC-SHA256 hexadécimale : exactement 64 caractères. */
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;

/** Identifiant Supabase (`auth.users.id`) — la cible d'une licence. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SignatureVerdict = "valid" | "invalid" | "unconfigured";

type Env = Record<string, string | undefined>;

/** Secret du webhook, ou `null` s'il est absent/vide (⇒ on REFUSE tout). */
export function lemonWebhookSecret(
  env: Env = process.env as Env,
): string | null {
  const secret = (env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "").trim();
  return secret.length > 0 ? secret : null;
}

/** HMAC-SHA256(secret, rawBody) en hexadécimal minuscule. */
export async function computeLemonSignature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparaison à temps constant de deux chaînes hexadécimales. */
function constantTimeEqual(a: string, b: string): boolean {
  // Les deux côtés font 64 caractères (motif vérifié avant l'appel) : la
  // longueur ne porte donc aucune information exploitable.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Vérifie `X-Signature` contre le corps brut reçu.
 *
 * `unconfigured` n'est PAS une acceptation : sans secret, un webhook ne peut
 * pas être distingué d'un appel anonyme, donc la route répond 503 (fail closed).
 * Accepter « faute de secret » reviendrait à ouvrir l'émission de licences à
 * quiconque connaît l'URL.
 */
export async function verifyLemonSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null = lemonWebhookSecret(),
): Promise<SignatureVerdict> {
  if (!secret) return "unconfigured";
  const provided = (header ?? "").trim();
  if (!SIGNATURE_PATTERN.test(provided)) return "invalid";
  const expected = await computeLemonSignature(rawBody, secret);
  return constantTimeEqual(expected, provided.toLowerCase()) ? "valid" : "invalid";
}

/* ─────────────────────────── Lecture de l'événement ─────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Texte non vide, ou `null`. Accepte les nombres (LS renvoie `order_id: 2`). */
function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Un événement est-il un PAIEMENT réellement encaissé ?
 *
 * `order_created` → `paid`. C'est le déclencheur du produit « Optimus Premium
 * Trimestre », vendu en paiement unique (aucun prélèvement récurrent, contrat
 * affiché sur /tarifs).
 *
 * `subscription_created` → `active` seulement. `on_trial` est VOLONTAIREMENT
 * exclu : un essai n'est pas un paiement et ne doit pas émettre de licence.
 * Conservé ici pour qu'une variante récurrente du produit fonctionne sans
 * retoucher la vérification.
 */
export function isPaidEvent(eventName: string, status: string): boolean {
  if (eventName === "order_created") return status === "paid";
  if (eventName === "subscription_created") return status === "active";
  return false;
}

export type LemonEvent = {
  /** `data.id` : l'`order_id` (ou `subscription_id`) Lemon Squeezy. */
  resourceId: string;
  /** Identifiant de COMMANDE : `order_id` de la souscription, sinon `data.id`. */
  orderId: string;
  /** `meta.event_name`, ex. `order_created`. */
  name: string;
  /** `data.type`, ex. `orders`. */
  type: string;
  status: string;
  paid: boolean;
  /** Supabase `auth.users.id` — `null` si absent ou mal formé. */
  userId: string | null;
  /** Notre référence `CMD-LS-…` passée en custom data (facultative). */
  orderReference: string | null;
  email: string | null;
  /** Total facturé, en unité mineure de `currency` (1900 = 19,00 €). */
  total: number | null;
  currency: string | null;
  /** Horodatage Lemon Squeezy de la commande — ancre STABLE de l'échéance. */
  createdAt: string | null;
  testMode: boolean;
  /**
   * Clé d'idempotence : UNE licence par COMMANDE Lemon Squeezy.
   *
   * Utiliser `data.id` ne suffirait pas — pour un abonnement,
   * `subscription_created` porte l'id de la SOUSCRIPTION, pas celui de la
   * commande, et les deux événements émettraient alors deux licences pour un
   * seul encaissement.
   */
  idempotencyKey: string;
};

/** Lit l'événement, ou `null` si la forme minimale n'est pas respectée. */
export function extractLemonEvent(payload: unknown): LemonEvent | null {
  const root = asRecord(payload);
  const meta = asRecord(root?.meta);
  const data = asRecord(root?.data);
  const attributes = asRecord(data?.attributes);

  const resourceId = asText(data?.id);
  const name = asText(meta?.event_name);
  if (!resourceId || !name) return null;

  const type = (asText(data?.type) ?? "").toLowerCase();
  const status = (asText(attributes?.status) ?? "").toLowerCase();

  // `meta.custom_data` est le contrat documenté ; `attributes.custom_data` est
  // accepté en repli au cas où Lemon Squeezy le dupliquerait un jour.
  const custom =
    asRecord(meta?.custom_data) ?? asRecord(attributes?.custom_data) ?? {};

  // Un identifiant qui n'est pas un UUID Supabase n'est pas « un peu valide » :
  // écrire une licence sur un id inventé créerait une ligne que personne ne
  // pourrait jamais réclamer. On le traite comme ABSENT (événement `unmatched`).
  const rawUserId = asText(custom.user_id);
  const userId = rawUserId && UUID_PATTERN.test(rawUserId) ? rawUserId : null;

  // Pour une souscription, la COMMANDE est `attributes.order_id`.
  const orderId =
    type === "subscriptions"
      ? (asText(attributes?.order_id) ?? resourceId)
      : resourceId;

  const refunded = attributes?.refunded === true;

  return {
    resourceId,
    orderId,
    name,
    type,
    status,
    paid: !refunded && isPaidEvent(name, status),
    userId,
    orderReference: asText(custom.order_reference),
    email: asText(attributes?.user_email),
    total: asNumber(attributes?.total),
    currency: asText(attributes?.currency),
    createdAt: asText(attributes?.created_at),
    testMode: attributes?.test_mode === true,
    idempotencyKey: `lemonsqueezy:order:${orderId}`,
  };
}
