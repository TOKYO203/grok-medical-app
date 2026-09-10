import assert from "node:assert/strict";
import test from "node:test";
import {
  advancePurchase,
  fulfillmentRequestMessage,
  orderAmount,
  orderProduct,
  paymentRequestMessage,
  PREMIUM_SPECIALTIES,
  purchaseStatusRank,
  type PremiumOrder,
} from "./purchase-order.ts";

const order: PremiumOrder = {
  reference: "CMD-TEST-01",
  offer: "deck",
  specialty: "neurologie",
  deckNumber: 3,
};

test("Premium pricing and product codes remain aligned with the selected offer", () => {
  assert.equal(orderAmount(order), 3_000);
  assert.equal(orderProduct(order), "NEURO_DECK_03");
  assert.equal(orderAmount({ ...order, offer: "specialty" }), 27_000);
  assert.equal(orderProduct({ ...order, offer: "specialty" }), "NEURO_PACK_10");
  for (const specialty of PREMIUM_SPECIALTIES) {
    for (const deckNumber of [1, 10]) {
      assert.match(
        orderProduct({ ...order, specialty: specialty.id, deckNumber }),
        /^[A-Z][A-Z0-9_]{2,63}$/,
      );
    }
  }
});

test("purchase tracking is monotonic and keeps canonical order details", () => {
  const created = advancePurchase(order, "created", undefined, false, 100);
  const pending = advancePurchase(order, "verification_pending", created, true, 200);
  const staleUpdate = advancePurchase(order, "instructions_requested", pending, false, 300);

  assert.equal(created.amount, 3_000);
  assert.equal(created.label, "Neurologie · Deck 3/10");
  assert.equal(created.product, "NEURO_DECK_03");
  assert.equal(staleUpdate.status, "verification_pending");
  assert.equal(staleUpdate.proofAttached, true);
  assert.equal(staleUpdate.createdAt, 100);
  assert.ok(purchaseStatusRank("delivered") > purchaseStatusRank(staleUpdate.status));
});

test("changing the product under one reference resets its progress", () => {
  const pending = advancePurchase(order, "verification_pending", undefined, true, 100);
  const changed = advancePurchase({ ...order, deckNumber: 4 }, "created", pending, false, 200);

  assert.equal(changed.product, "NEURO_DECK_04");
  assert.equal(changed.status, "created");
  assert.equal(changed.createdAt, 200);
});

test("payment and fulfillment messages carry the exact order and device binding", () => {
  const payment = paymentRequestMessage(order, "OM-12AB34CD");
  assert.match(payment, /3[\s\u202f]000 Ar/);
  assert.match(payment, /numéro Mobile Money officiel/);

  const fulfillment = fulfillmentRequestMessage(order, {
    optimusId: "OM-12AB34CD",
    deviceId: "device-12345678",
    deviceKeyId: "device-key-12345678",
    publicKey: "public-key-12345678",
  });
  assert.match(fulfillment, /NEURO_DECK_03/);
  assert.match(fulfillment, /device-key-12345678/);
  assert.match(fulfillment, /public-key-12345678/);
});
