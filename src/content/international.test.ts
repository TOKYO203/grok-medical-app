import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LEMON_STORE_SLUG,
  LEMON_VARIANT_PLACEHOLDER,
  PRICE_EUR,
  buildLemonCheckoutUrl,
  formatEuroAmount,
  isLemonCheckoutConfigured,
  readLemonCheckoutConfig,
  subscriptionAmountCents,
} from "./international.ts";

/**
 * Paiement international — configuration et URL de checkout.
 *
 * L'URL est le seul endroit où l'application parle à Lemon Squeezy : une faute
 * de paramètre (`checkout[custom][user_id]`) ne casse pas le build, elle rend
 * simplement la licence impossible à rattacher — le client paie et n'obtient
 * rien. D'où des assertions sur la forme exacte de l'URL.
 */

const VARIANT = "6b2f0c4a-1d3e-4f5a-8b9c-0d1e2f3a4b5c";

test("lit la configuration et retombe sur des valeurs sûres", () => {
  const configured = readLemonCheckoutConfig({
    VITE_LEMONSQUEEZY_STORE_SLUG: "optimus888",
    VITE_LEMONSQUEEZY_VARIANT_ID: VARIANT,
  });
  assert.deepEqual(configured, { storeSlug: "optimus888", variantId: VARIANT });
  assert.equal(isLemonCheckoutConfigured(configured), true);

  const empty = readLemonCheckoutConfig(undefined);
  assert.equal(empty.storeSlug, DEFAULT_LEMON_STORE_SLUG);
  assert.equal(empty.variantId, LEMON_VARIANT_PLACEHOLDER);
  // Un placeholder n'est PAS une boutique configurée : /tarifs le dit.
  assert.equal(isLemonCheckoutConfigured(empty), false);

  // Une valeur malformée ne doit jamais atterrir dans un nom d'hôte.
  const hostile = readLemonCheckoutConfig({
    VITE_LEMONSQUEEZY_STORE_SLUG: "evil.com/checkout",
    VITE_LEMONSQUEEZY_VARIANT_ID: "pas-un-uuid",
  });
  assert.equal(hostile.storeSlug, DEFAULT_LEMON_STORE_SLUG);
  assert.equal(hostile.variantId, LEMON_VARIANT_PLACEHOLDER);
});

test("construit l'URL de checkout avec les paramètres documentés", () => {
  const url = buildLemonCheckoutUrl({
    config: { storeSlug: "optimus888", variantId: VARIANT },
    userId: "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
    email: "acheteur@example.com",
    orderReference: "CMD-SUB-M1B2C3D4-ABCDEF01",
  });

  assert.ok(
    url.startsWith(`https://optimus888.lemonsqueezy.com/checkout/buy/${VARIANT}?`),
    url,
  );
  // Crochets LITTÉRAUX (format documenté par Lemon Squeezy), valeurs encodées.
  assert.match(url, /checkout\[custom\]\[user_id\]=3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d/);
  assert.match(url, /checkout\[custom\]\[order_reference\]=CMD-SUB-M1B2C3D4-ABCDEF01/);
  assert.match(url, /checkout\[email\]=acheteur%40example\.com/);
});

test("omet les paramètres facultatifs absents", () => {
  const url = buildLemonCheckoutUrl({
    config: { storeSlug: "optimus888", variantId: VARIANT },
    userId: "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
  });
  assert.ok(!url.includes("checkout[email]"), url);
  assert.ok(!url.includes("order_reference"), url);
  assert.ok(url.includes("checkout[custom][user_id]="));
});

test("le montant facturé est celui affiché, pas la conversion indicative", () => {
  assert.equal(PRICE_EUR.subscriptionQuarter, 19);
  assert.equal(subscriptionAmountCents(), 1900);
  // `formatPrice(15_000, "EUR")` dirait « ≈ 3 € » : ce n'est pas le prix débité.
  assert.equal(formatEuroAmount(PRICE_EUR.subscriptionQuarter), "19,00 €");
});

test("l'identifiant de demande est un UUID v4 accepté par le serveur", async () => {
  const { newCheckoutRequestId } = await import("./international.ts");
  // `checkoutRequestSchema` exige un UUID : un identifiant d'une autre forme
  // ferait échouer le bouton au moment du clic, chez le client.
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const first = newCheckoutRequestId();
  assert.match(first, uuidV4);
  assert.notEqual(first, newCheckoutRequestId(), "deux clics = deux identifiants");
});
