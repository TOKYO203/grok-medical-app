import assert from "node:assert/strict";
import test from "node:test";
import {
  computeLemonSignature,
  extractLemonEvent,
  isPaidEvent,
  lemonWebhookSecret,
  verifyLemonSignature,
} from "./signature.ts";

/**
 * Vérification de signature des webhooks Lemon Squeezy.
 *
 * Ce que ces tests verrouillent, et pourquoi :
 *   1. un appel non signé ou mal signé n'est JAMAIS accepté (c'est la seule
 *      frontière entre « un paiement a eu lieu » et « n'importe qui prétend
 *      qu'un paiement a eu lieu ») ;
 *   2. la signature porte sur le corps BRUT : le moindre octet modifié invalide ;
 *   3. sans secret configuré, on ne devine pas — on ferme ;
 *   4. `user_id` n'est retenu que s'il a la forme d'un identifiant Supabase :
 *      une licence écrite sur un id inventé ne serait réclamable par personne.
 */

const SECRET = "secret-de-test-lemonsqueezy";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      event_name: "order_created",
      custom_data: {
        user_id: "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
        order_reference: "CMD-SUB-M1B2C3D4-ABCDEF01",
      },
    },
    data: {
      type: "orders",
      id: "42",
      attributes: {
        status: "paid",
        total: 1900,
        currency: "EUR",
        user_email: "acheteur@example.com",
        created_at: "2026-01-01T00:00:00.000Z",
        test_mode: true,
        refunded: false,
      },
    },
    ...overrides,
  };
}

test("accepte une signature HMAC calculée sur le corps brut", async () => {
  const body = JSON.stringify(payload());
  const signature = await computeLemonSignature(body, SECRET);
  assert.equal(await verifyLemonSignature(body, signature, SECRET), "valid");
  // `Headers` normalise la casse : une majuscule dans l'en-tête reste valide.
  assert.equal(await verifyLemonSignature(body, signature.toUpperCase(), SECRET), "valid");
});

test("refuse une signature invalide (401 côté route)", async () => {
  const body = JSON.stringify(payload());
  assert.equal(await verifyLemonSignature(body, "a".repeat(64), SECRET), "invalid");
  // Signature d'un AUTRE corps : c'est le cas d'un rejeu altéré.
  const other = await computeLemonSignature(`${body} `, SECRET);
  assert.equal(await verifyLemonSignature(body, other, SECRET), "invalid");
});

test("refuse un corps modifié après signature", async () => {
  const body = JSON.stringify(payload());
  const signature = await computeLemonSignature(body, SECRET);
  const tampered = body.replace('"status":"paid"', '"status":"paid","total":1');
  assert.notEqual(tampered, body);
  assert.equal(await verifyLemonSignature(tampered, signature, SECRET), "invalid");
});

test("refuse un en-tête absent, vide ou mal formé", async () => {
  const body = JSON.stringify(payload());
  for (const header of [null, undefined, "", "   ", "pas-une-signature", "abc123"]) {
    assert.equal(await verifyLemonSignature(body, header, SECRET), "invalid");
  }
});

test("sans secret configuré, aucune requête n'est acceptée", async () => {
  const body = JSON.stringify(payload());
  const signature = await computeLemonSignature(body, SECRET);
  assert.equal(await verifyLemonSignature(body, signature, null), "unconfigured");
  assert.equal(lemonWebhookSecret({}), null);
  assert.equal(lemonWebhookSecret({ LEMONSQUEEZY_WEBHOOK_SECRET: "   " }), null);
  assert.equal(lemonWebhookSecret({ LEMONSQUEEZY_WEBHOOK_SECRET: SECRET }), SECRET);
});

test("extrait l'acheteur et la référence depuis meta.custom_data", () => {
  const event = extractLemonEvent(payload());
  assert.ok(event);
  assert.equal(event.name, "order_created");
  assert.equal(event.orderId, "42");
  assert.equal(event.userId, "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d");
  assert.equal(event.orderReference, "CMD-SUB-M1B2C3D4-ABCDEF01");
  assert.equal(event.email, "acheteur@example.com");
  assert.equal(event.currency, "EUR");
  assert.equal(event.total, 1900);
  assert.equal(event.paid, true);
  assert.equal(event.testMode, true);
  assert.equal(event.idempotencyKey, "lemonsqueezy:order:42");
});

test("ignore un user_id qui n'est pas un identifiant Supabase", () => {
  const event = extractLemonEvent(
    payload({
      meta: { event_name: "order_created", custom_data: { user_id: "user_42" } },
    }),
  );
  assert.ok(event);
  assert.equal(event.userId, null);
});

test("une souscription s'identifie par son order_id, pas par son subscription_id", () => {
  const event = extractLemonEvent({
    meta: { event_name: "subscription_created", custom_data: { user_id: "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d" } },
    data: {
      type: "subscriptions",
      id: "777",
      attributes: { status: "active", order_id: 42 },
    },
  });
  assert.ok(event);
  assert.equal(event.resourceId, "777");
  assert.equal(event.orderId, "42");
  // Deux événements (commande + souscription) ⇒ UNE seule clé d'idempotence.
  assert.equal(event.idempotencyKey, "lemonsqueezy:order:42");
});

test("un événement non payé n'ouvre aucun droit", () => {
  assert.equal(isPaidEvent("order_created", "pending"), false);
  assert.equal(isPaidEvent("order_created", "paid"), true);
  assert.equal(isPaidEvent("subscription_created", "on_trial"), false);
  assert.equal(isPaidEvent("subscription_created", "active"), true);
  assert.equal(isPaidEvent("order_refunded", "refunded"), false);

  const refunded = extractLemonEvent(
    payload({
      data: {
        type: "orders",
        id: "42",
        attributes: { status: "paid", refunded: true },
      },
    }),
  );
  assert.ok(refunded);
  assert.equal(refunded.paid, false);
});

test("refuse un corps qui n'a pas la forme d'un événement", () => {
  assert.equal(extractLemonEvent(null), null);
  assert.equal(extractLemonEvent("texte"), null);
  assert.equal(extractLemonEvent({}), null);
  assert.equal(extractLemonEvent({ meta: {} }), null);
  assert.equal(extractLemonEvent({ meta: { event_name: "order_created" }, data: {} }), null);
});
