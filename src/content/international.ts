/**
 * Paiement international — configuration et construction de l'URL de checkout.
 *
 * MODULE PUR : aucune I/O, aucun accès réseau. Il est partagé par le bouton de
 * `/tarifs` (qui construit l'URL) et par les tests, sans dépendre de
 * `import.meta.env` au chargement — un module qui lit `import.meta.env` à
 * l'import casse sous `node --test`.
 *
 * POURQUOI LE PRIX EN EUROS N'EST PAS UNE CONVERSION
 * `formatPrice(15_000, "EUR")` affiche « ≈ 3 € » (taux indicatif). Or Lemon
 * Squeezy débite réellement 19 €. Afficher 3 € à côté d'un bouton qui prélève
 * 19 € serait un mensonge tarifaire : le panneau international affiche donc le
 * montant FACTURÉ (`PRICE_EUR`), pas la conversion indicative.
 */

/** Prix réellement débité par Lemon Squeezy, en euros. */
export const PRICE_EUR = {
  subscriptionQuarter: 19,
} as const;

/** Sous-domaine de la boutique (l'URL est `https://<slug>.lemonsqueezy.com`). */
export const DEFAULT_LEMON_STORE_SLUG = "optimus888";

/**
 * Valeur de repli quand `VITE_LEMONSQUEEZY_VARIANT_ID` n'est pas configurée.
 *
 * Elle garde l'interface rendue et testable, mais `isLemonCheckoutConfigured()`
 * renvoie `false` : le bouton est alors désactivé avec un message explicite,
 * plutôt que d'envoyer l'acheteur sur un checkout inexistant (« n'annoncer
 * payable que ce qui est payable », doctrine de /tarifs).
 */
export const LEMON_VARIANT_PLACEHOLDER = "00000000-0000-4000-8000-000000000000";

export type LemonCheckoutConfig = {
  storeSlug: string;
  variantId: string;
};

type Env = Record<string, string | undefined>;

/** Sous-domaine sûr : minuscules, chiffres et tirets (pas de `/`, pas de `.`). */
const STORE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Un identifiant de variante Lemon Squeezy est un UUID. */
const VARIANT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lit la configuration, avec repli sur la boutique et le placeholder.
 *
 * Une valeur malformée est IGNORÉE (repli) plutôt qu'injectée dans une URL :
 * `storeSlug` participe au nom d'hôte, donc un slug libre permettrait de faire
 * pointer le bouton de paiement vers un autre domaine.
 */
export function readLemonCheckoutConfig(env: Env | undefined): LemonCheckoutConfig {
  const rawSlug = (env?.VITE_LEMONSQUEEZY_STORE_SLUG ?? "").trim().toLowerCase();
  const rawVariant = (env?.VITE_LEMONSQUEEZY_VARIANT_ID ?? "").trim();

  return {
    storeSlug: STORE_SLUG_PATTERN.test(rawSlug) ? rawSlug : DEFAULT_LEMON_STORE_SLUG,
    variantId: VARIANT_PATTERN.test(rawVariant) ? rawVariant : LEMON_VARIANT_PLACEHOLDER,
  };
}

/** La boutique est-elle réellement branchée sur une variante ? */
export function isLemonCheckoutConfigured(config: LemonCheckoutConfig): boolean {
  return (
    config.variantId !== LEMON_VARIANT_PLACEHOLDER && VARIANT_PATTERN.test(config.variantId)
  );
}

export type LemonCheckoutLinkInput = {
  config: LemonCheckoutConfig;
  /** Identifiant Supabase de l'acheteur — relu dans `meta.custom_data`. */
  userId: string;
  email?: string | null;
  /** Référence `CMD-…` de la commande créée au clic. */
  orderReference?: string | null;
};

/**
 * URL de checkout pré-remplie.
 *
 * Le format des paramètres est celui documenté par Lemon Squeezy
 * (`checkout[custom][user_id]`, `checkout[email]`) : les crochets restent
 * LITTÉRAUX et seules les valeurs sont encodées. Passer par `URLSearchParams`
 * encoderait les crochets en `%5B`/`%5D` — accepté en théorie (RFC 3986), mais
 * autant respecter à la lettre un contrat qu'on ne peut pas tester chez le
 * fournisseur.
 */
export function buildLemonCheckoutUrl(input: LemonCheckoutLinkInput): string {
  const { config, userId, email, orderReference } = input;
  const params: string[] = [];

  if (userId) params.push(`checkout[custom][user_id]=${encodeURIComponent(userId)}`);
  if (orderReference) {
    params.push(`checkout[custom][order_reference]=${encodeURIComponent(orderReference)}`);
  }
  if (email) params.push(`checkout[email]=${encodeURIComponent(email)}`);

  const base = `https://${config.storeSlug}.lemonsqueezy.com/checkout/buy/${encodeURIComponent(
    config.variantId,
  )}`;
  return params.length > 0 ? `${base}?${params.join("&")}` : base;
}

/** Montant en unité mineure (centimes) — ce que stocke `purchase_orders.amount`. */
export function subscriptionAmountCents(): number {
  return Math.round(PRICE_EUR.subscriptionQuarter * 100);
}

/**
 * Montant en euros tel qu'il est DÉBITÉ (« 19,00 € »).
 *
 * `formatPrice(15_000, "EUR")` renvoie « ≈ 3 € » (conversion indicative) : ce
 * n'est pas le prix du panneau international, et l'afficher à côté d'un bouton
 * qui prélève 19 € serait trompeur.
 */
export function formatEuroAmount(amount: number): string {
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} €`;
}

/**
 * Identifiant de demande de commande (UUID v4).
 *
 * Il rend le clic idempotent : `UNIQUE (user_id, client_request_id)` garantit
 * qu'un double-clic produit UNE commande, donc une seule référence envoyée au
 * checkout. `crypto.randomUUID()` n'existe QUE dans un contexte sécurisé
 * (https, localhost) : sur un accès en http simple il est absent, et un
 * `crypto.randomUUID()` non protégé ferait échouer le bouton au lieu d'ouvrir
 * le paiement. D'où le repli sur `getRandomValues`, qui n'a pas cette
 * restriction.
 */
export function newCheckoutRequestId(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    // Repli ultime : Math.random n'est pas cryptographique, mais cet
    // identifiant n'est PAS un secret (il sert uniquement de clé
    // d'idempotence, contrôlée côté serveur par `UNIQUE`).
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  // Version 4, variante RFC 4122 — requis par `z.string().uuid()` côté serveur.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
