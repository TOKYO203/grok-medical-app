import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_AUTH_MESSAGES,
  decideCardAuthGate,
  describeCheckoutFailure,
  parseCheckoutFailureBody,
} from "./messages.ts";

/**
 * Le bouton « Payer par Carte » ne doit jamais accuser l'utilisateur d'une panne
 * serveur, ni le déconnecter sur une incertitude.
 */

test("on ne redirige que sur une absence de session CONNUE", () => {
  assert.equal(decideCardAuthGate("anonymous", false), "login");
  // `loading` et `unavailable` ne sont pas des déconnexions : rediriger ici
  // reproduirait le symptôme « double authentification » (AUTH-8).
  assert.equal(decideCardAuthGate("loading", false), "wait");
  assert.equal(decideCardAuthGate("unavailable", false), "cloud-unavailable");
  assert.equal(decideCardAuthGate("unconfigured", false), "cloud-unavailable");
  assert.equal(decideCardAuthGate("authenticated", true), "proceed");
  // Session connue mais jeton pas encore lisible : transitoire, on attend.
  assert.equal(decideCardAuthGate("authenticated", false), "wait");
});

test("chaque décision non nominale a un message propre", () => {
  for (const key of ["login", "wait", "cloud-unavailable"] as const) {
    const message = CARD_AUTH_MESSAGES[key];
    assert.equal(typeof message, "string");
    assert.ok(message.length > 20, `message trop court pour « ${key} »`);
  }
});

test("une panne serveur n'est jamais imputée à la connexion du client", () => {
  for (const reason of ["database", "identity_unconfigured", "identity_unreachable", null]) {
    const failure = describeCheckoutFailure({ status: 503, reason });
    assert.notEqual(failure.kind, "network");
    assert.ok(!/v[ée]rifiez votre connexion/i.test(failure.message), "message trompeur");
    assert.match(failure.message, /Aucun montant n'a été débité/);
  }
});

test("le code d'échec est stable et porte la raison", () => {
  assert.equal(describeCheckoutFailure({ status: 503, reason: "database" }).code, "http-503-database");
  assert.equal(describeCheckoutFailure({ status: 503 }).code, "http-503");
  assert.equal(describeCheckoutFailure({ status: 429 }).kind, "retry");
  assert.equal(describeCheckoutFailure({ status: 400 }).kind, "invalid");
  assert.equal(describeCheckoutFailure({ status: null }).kind, "network");
  assert.equal(describeCheckoutFailure({ status: 401 }).kind, "login");
});

test("un 503 « base » propose une alternative réelle", () => {
  const failure = describeCheckoutFailure({ status: 503, reason: "database" });
  assert.match(failure.message, /Mobile Money/);
  assert.equal(failure.kind, "unavailable");
});

test("un corps d'erreur illisible reste un cas normal", () => {
  assert.deepEqual(parseCheckoutFailureBody(null), { error: null, reason: null });
  assert.deepEqual(parseCheckoutFailureBody("<html>"), { error: null, reason: null });
  assert.deepEqual(parseCheckoutFailureBody({ error: "checkout_unavailable", reason: "database" }), {
    error: "checkout_unavailable",
    reason: "database",
  });
});
