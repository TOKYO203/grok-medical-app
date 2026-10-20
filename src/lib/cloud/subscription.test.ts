import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBSCRIPTION_PRODUCT,
  formatSubscriptionEnd,
  resolveSubscription,
} from "./subscription.ts";
import type { Entitlement } from "@/core/types";

/* ============================================================================
   État d'abonnement — module PUR.

   Ces tests fixent la règle AFFICHÉE sur /pro : « Abonnement actif » et sa date.
   Aucun test ici ne prétend décider d'un ACCÈS (c'est le serveur qui tranche) :
   seulement du texte juste, et jamais de date inventée.
   ============================================================================ */

const NOW = new Date("2026-10-20T12:00:00Z").getTime();
const IN_45_DAYS = NOW + 45 * 24 * 3600 * 1000;
const IN_2_DAYS = NOW + 2 * 24 * 3600 * 1000;
const YESTERDAY = NOW - 24 * 3600 * 1000;

function entitlement(expiresAt: number | null): Entitlement {
  return {
    id: "e1",
    product: SUBSCRIPTION_PRODUCT,
    grantedAt: NOW - 1000,
    expiresAt,
    reference: "QA-TEST",
    signature: "sig",
    deviceId: "abcdef012345",
  } as unknown as Entitlement;
}

test("une licence Supabase active donne un abonnement daté", () => {
  const state = resolveSubscription(
    { tier: "free", entitlements: [], licenceExpiresAt: IN_45_DAYS, contentUnlocked: true },
    NOW,
  );
  assert.equal(state.active, true);
  assert.equal(state.source, "licence");
  assert.equal(state.expiresAt, IN_45_DAYS);
});

test("une licence expirée ne rend PAS le compte actif", () => {
  const state = resolveSubscription(
    { tier: "free", entitlements: [], licenceExpiresAt: YESTERDAY, contentUnlocked: true },
    NOW,
  );
  assert.equal(state.active, false);
  assert.equal(state.expiresAt, null);
});

test("un droit local OPTIMUS_PRO reste valable (client historique)", () => {
  const state = resolveSubscription(
    {
      tier: "pro",
      entitlements: [entitlement(IN_45_DAYS)],
      licenceExpiresAt: null,
      contentUnlocked: false,
    },
    NOW,
  );
  assert.equal(state.active, true);
  assert.equal(state.source, "receipt");
  assert.equal(state.expiresAt, IN_45_DAYS);
});

test("une licence perpétuelle n'invente pas de date de fin", () => {
  const state = resolveSubscription(
    { tier: "free", entitlements: [], licenceExpiresAt: null, contentUnlocked: true },
    NOW,
  );
  assert.equal(state.active, true);
  assert.equal(state.expiresAt, null);
  assert.equal(formatSubscriptionEnd(state.expiresAt), null);
});

test("la licence fait autorité sur le droit local pour la date", () => {
  const state = resolveSubscription(
    {
      tier: "pro",
      entitlements: [entitlement(IN_2_DAYS)],
      licenceExpiresAt: IN_45_DAYS,
      contentUnlocked: true,
    },
    NOW,
  );
  assert.equal(state.source, "licence");
  assert.equal(state.expiresAt, IN_45_DAYS);
});

test("sans rien, aucun abonnement et aucune date", () => {
  const state = resolveSubscription(
    { tier: "free", entitlements: [], licenceExpiresAt: null, contentUnlocked: false },
    NOW,
  );
  assert.deepEqual(state, { active: false, expiresAt: null, source: null });
});

test("la date est rendue en français long, pas en ISO", () => {
  const label = formatSubscriptionEnd(new Date("2027-01-12T10:00:00Z").getTime());
  assert.ok(label);
  assert.match(label as string, /janvier 2027/);
});
