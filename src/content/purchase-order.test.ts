import assert from "node:assert/strict";
import test from "node:test";
import {
  advancePurchase,
  fulfillmentRequestMessage,
  licenseDurationDays,
  licenseExpiryFor,
  normalizePremiumOrderInput,
  orderAmount,
  orderLabel,
  orderProduct,
  paymentRequestMessage,
  PREMIUM_SPECIALTIES,
  purchaseReferencePrefix,
  PURCHASE_REFERENCE_PATTERN,
  purchaseStatusRank,
  SUBSCRIPTION_PRODUCT,
  type PremiumOrder,
} from "./purchase-order.ts";
import { PRICES_MGA, SUBSCRIPTION_MONTHS } from "./pricing.ts";

const order: PremiumOrder = {
  reference: "CMD-TEST-01",
  offer: "deck",
  specialty: "neurologie",
  deckNumber: 3,
};

test("Premium pricing and product codes remain aligned with the selected offer", () => {
  assert.equal(orderAmount(order), 15_000);
  assert.equal(orderProduct(order), "NEURO_DECK_03");
  assert.equal(orderAmount({ ...order, offer: "specialty" }), 22_000);
  assert.equal(orderProduct({ ...order, offer: "specialty" }), "NEURO_PACK_15");
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

  assert.equal(created.amount, 15_000);
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
  assert.match(payment, /15[\s\u202f]000 Ar/);
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

/* ============================================================================
   ABONNEMENT TRIMESTRIEL (ABO-11) — payable par le MÊME tunnel.

   Ces tests verrouillent les trois choses qui, si elles divergent, font payer un
   client sans rien lui livrer : le MONTANT, le PRODUIT de licence, et l'ÉCHÉANCE.
   ============================================================================ */

const subscription: PremiumOrder = {
  reference: "CMD-SUB-TEST-01",
  offer: "subscription",
  specialty: "all",
  deckNumber: 1,
};

test("l'abonnement facture 35 000 Ar et émet le produit qui ouvre tout le Premium", () => {
  assert.equal(orderAmount(subscription), 35_000);
  assert.equal(orderAmount(subscription), PRICES_MGA.subscriptionQuarter);
  assert.equal(orderProduct(subscription), SUBSCRIPTION_PRODUCT);
  // `OPTIMUS_PRO` est le droit reconnu par les gardes d'accès existantes.
  assert.equal(orderProduct(subscription), "OPTIMUS_PRO");
  assert.equal(orderLabel(subscription), "Abonnement Trimestriel · Accès illimité 3 mois");
  // Un abonnement n'a ni spécialité ni module : ces valeurs ne doivent jamais
  // changer le produit facturé.
  assert.equal(orderProduct({ ...subscription, specialty: "cardiologie", deckNumber: 7 }), "OPTIMUS_PRO");
});

test("les offres à l'unité restent au tarif et au produit inchangés", () => {
  assert.equal(orderAmount({ ...order, offer: "deck" }), 15_000);
  assert.equal(orderAmount({ ...order, offer: "specialty" }), 22_000);
  assert.equal(orderProduct({ ...order, offer: "specialty" }), "NEURO_PACK_15");
  // Toutes les licences durent 90 jours (aucun accès à vie).
  assert.equal(licenseDurationDays("deck"), 90);
  assert.equal(licenseDurationDays("specialty"), 90);
  assert.equal(licenseExpiryFor("deck", 0), new Date(90 * 86_400_000).toISOString());
});

test("la licence d'abonnement expire à 3 mois (90 jours), pas à la seconde près", () => {
  assert.equal(licenseDurationDays("subscription"), SUBSCRIPTION_MONTHS * 30);
  assert.equal(licenseDurationDays("subscription"), 90);
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  const expiry = licenseExpiryFor("subscription", now);
  assert.ok(expiry);
  assert.equal(Date.parse(expiry), now + 90 * 86_400_000);
  assert.equal(new Date(Date.parse(expiry)).toISOString(), expiry);
  // Déterministe : c'est la même règle qui écrit la base et signe le reçu.
  assert.equal(licenseExpiryFor("subscription", now), expiry);
});

test("la forme d'une commande est normalisée CÔTÉ SERVEUR", () => {
  // Abonnement : la spécialité et le module envoyés par le client sont ignorés.
  assert.deepEqual(
    normalizePremiumOrderInput({ offer: "subscription", specialty: "cardiologie", deckNumber: 9 }),
    { offer: "subscription", specialty: "all", deckNumber: 1 },
  );
  assert.deepEqual(normalizePremiumOrderInput({ offer: "subscription" }), {
    offer: "subscription",
    specialty: "all",
    deckNumber: 1,
  });
  // Offres à l'unité : spécialité et module obligatoires.
  assert.deepEqual(normalizePremiumOrderInput({ offer: "deck", specialty: "neurologie", deckNumber: 3 }), {
    offer: "deck",
    specialty: "neurologie",
    deckNumber: 3,
  });
  assert.deepEqual(normalizePremiumOrderInput({ offer: "specialty", specialty: "urgences" }), {
    offer: "specialty",
    specialty: "urgences",
    deckNumber: 1,
  });
  assert.throws(() => normalizePremiumOrderInput({ offer: "deck", specialty: "neurologie" }), /Module/);
  assert.throws(() => normalizePremiumOrderInput({ offer: "deck", specialty: "neurologie", deckNumber: 11 }), /Module/);
  assert.throws(() => normalizePremiumOrderInput({ offer: "specialty" }), /Spécialité/);
  assert.throws(() => normalizePremiumOrderInput({ offer: "deck", specialty: "all", deckNumber: 1 }), /Spécialité/);
});

test("la référence d'abonnement est identifiable ET valide le format partagé", () => {
  assert.equal(purchaseReferencePrefix("subscription"), "CMD-SUB");
  assert.equal(purchaseReferencePrefix("deck"), "CMD");
  assert.match("CMD-SUB-M1B2C3D4-ABCDEF01", PURCHASE_REFERENCE_PATTERN);
  assert.match("CMD-M1B2C3D4-ABCDEF01", PURCHASE_REFERENCE_PATTERN);
  assert.doesNotMatch("CMD-SUB-M1B2C3D4-ABCDEF0", PURCHASE_REFERENCE_PATTERN);
  assert.doesNotMatch("SUB-M1B2C3D4-ABCDEF01", PURCHASE_REFERENCE_PATTERN);
  // L'offre se lit dans la référence : un opérateur ne confond pas un
  // abonnement de 15 000 Ar avec un module de 3 000 Ar.
  assert.notEqual(purchaseReferencePrefix("subscription"), purchaseReferencePrefix("deck"));
});

test("le message de demande d'abonnement porte le bon montant et le bon produit", () => {
  const message = paymentRequestMessage(subscription, "OM-12AB34CD");
  assert.match(message, /35[\s\u202f]000 Ar/);
  assert.match(message, /OPTIMUS_PRO/);
  assert.match(message, /Abonnement Trimestriel/);
  assert.doesNotMatch(message, /3[\s\u202f]000 Ar/);
});
