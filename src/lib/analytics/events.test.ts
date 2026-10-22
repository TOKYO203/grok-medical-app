/**
 * Garde-fous de la mesure produit.
 *
 * Un système de mesure est une porte d'entrée sur la base : ce qui n'est pas
 * borné ici finit par entrer. Ces tests vérifient donc les refus autant que les
 * acceptations — un nom inconnu, un texte libre, une valeur géante ou un
 * identifiant qui ressemble à une identité doivent être REJETÉS.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_PROP_KEYS,
  MAX_BATCH,
  MAX_VALUE_LENGTH,
  PRODUCT_EVENTS,
  computeRetention,
  isAnonId,
  normalizeBatch,
  normalizeEvent,
} from "./events.ts";

const ANON = "0123456789abcdef0123456789abcdef";

test("la liste des événements est celle de la roadmap", () => {
  assert.deepEqual([...PRODUCT_EVENTS], [
    "signup",
    "onboarding_done",
    "first_content_viewed",
    "session_completed",
    "day_streak",
    "paywall_viewed",
    "purchase",
  ]);
});

test("un événement connu avec des propriétés autorisées est normalisé", () => {
  const result = normalizeEvent({
    name: "session_completed",
    anonId: ANON,
    props: { surface: "qcm", count: 12, minutes: 9.5, offered: undefined },
  });
  // `offered` n'est pas dans la liste blanche → refus global (on ne devine pas).
  assert.equal(result.ok, false);

  const clean = normalizeEvent({
    name: "session_completed",
    anonId: ANON,
    props: { surface: "qcm", count: 12, minutes: 9.5 },
  });
  assert.equal(clean.ok, true);
  if (clean.ok) {
    assert.equal(clean.event.name, "session_completed");
    assert.deepEqual(clean.event.props, { surface: "qcm", count: 12, minutes: 9.5 });
  }
});

test("un nom d'événement inconnu est refusé", () => {
  const result = normalizeEvent({ name: "signup_pro_max", anonId: ANON });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unknown_event");
});

test("le texte libre ne peut pas entrer (protection contre les données personnelles)", () => {
  // Un message d'erreur complet, une adresse e-mail : hors liste blanche.
  for (const props of [
    { message: "TypeError: cannot read properties of undefined at /src/x.tsx:42" },
    { email: "etudiant@exemple.mg" },
    { stack: "Error\n at foo" },
  ]) {
    const result = normalizeEvent({ name: "paywall_viewed", anonId: ANON, props });
    assert.equal(result.ok, false, `accepté à tort : ${JSON.stringify(props)}`);
  }
});

test("une valeur trop longue ou non scalaire est refusée", () => {
  const long = "x".repeat(MAX_VALUE_LENGTH + 1);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props: { source: long } }).ok, false);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props: { source: { a: 1 } } }).ok, false);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props: { source: ["a"] } }).ok, false);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props: { count: Number.NaN } }).ok, false);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props: { count: Infinity } }).ok, false);
});

test("trop de propriétés est refusé", () => {
  const props = Object.fromEntries(ALLOWED_PROP_KEYS.map((k, i) => [k, i]));
  assert.ok(Object.keys(props).length > 6);
  assert.equal(normalizeEvent({ name: "signup", anonId: ANON, props }).ok, false);
});

test("un identifiant anonyme ne peut pas être une identité", () => {
  assert.equal(isAnonId(ANON), true);
  assert.equal(isAnonId("etudiant@exemple.mg"), false);
  assert.equal(isAnonId("3fe8b5b7-b109-4f06-afdf-47efcccd33f0"), false); // UUID d'utilisateur
  assert.equal(isAnonId("court"), false);
  assert.equal(normalizeEvent({ name: "signup", anonId: "etudiant@exemple.mg" }).ok, false);
  assert.equal(normalizeEvent({ name: "signup", anonId: null }).ok, true);
});

test("un lot partiellement invalide conserve les événements valides", () => {
  const batch = normalizeBatch([
    { name: "signup", anonId: ANON },
    { name: "n_importe_quoi", anonId: ANON },
    { name: "paywall_viewed", anonId: ANON, props: { offer: "subscription" } },
    null,
  ]);
  assert.equal(batch.ok, true);
  if (batch.ok) {
    assert.equal(batch.events.length, 2);
    assert.equal(batch.rejected, 2);
  }
});

test("un lot vide, trop gros ou mal typé est refusé", () => {
  assert.equal(normalizeBatch([]).ok, false);
  assert.equal(normalizeBatch("nope").ok, false);
  const tooMany = Array.from({ length: MAX_BATCH + 1 }, () => ({ name: "signup", anonId: ANON }));
  assert.equal(normalizeBatch(tooMany).ok, false);
});

test("rétention : un inscrit actif J0 et J7 compte 100 % à J0 et J7", () => {
  const events = [
    { name: "signup", anonId: ANON, day: "2026-10-01" },
    { name: "session_completed", anonId: ANON, day: "2026-10-01" },
    { name: "session_completed", anonId: ANON, day: "2026-10-08" },
  ];
  const { cohorts } = computeRetention(events, 7);
  assert.equal(cohorts.length, 1);
  assert.equal(cohorts[0].day, "2026-10-01");
  assert.equal(cohorts[0].size, 1);
  assert.equal(cohorts[0].retention[0], 100);
  assert.equal(cohorts[0].retention[7], 100);
  assert.equal(cohorts[0].retention[3], 0);
});

test("rétention : deux inscrits, un seul actif → 50 %", () => {
  const other = "fedcba9876543210fedcba9876543210";
  const events = [
    { name: "signup", anonId: ANON, day: "2026-10-01" },
    { name: "signup", anonId: other, day: "2026-10-01" },
    { name: "first_content_viewed", anonId: ANON, day: "2026-10-01" },
  ];
  const { cohorts } = computeRetention(events, 3);
  assert.equal(cohorts[0].size, 2);
  assert.equal(cohorts[0].retention[0], 50);
  assert.equal(cohorts[0].retention[1], 0);
});
