// Modèle freemium (chantier 2) — contrat du quota quotidien du gratuit.
import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_DAILY_QUESTION_LIMIT,
  dailyQuestionQuota,
  isTrialActive,
} from "./daily-quota.ts";

const TODAY = "2026-11-11";
const YESTERDAY = "2026-11-10";

test("la limite gratuite est bien 10 questions/jour", () => {
  assert.equal(FREE_DAILY_QUESTION_LIMIT, 10);
});

test("le gratuit consomme son quota question après question", () => {
  const quota = dailyQuestionQuota({ daily: { key: TODAY, answered: 3 }, todayKey: TODAY, isPremium: false });
  assert.deepEqual(quota, { limit: 10, used: 3, remaining: 7, blocked: false });
});

test("à 10 réponses le jour, une NOUVELLE session est bloquée", () => {
  const quota = dailyQuestionQuota({ daily: { key: TODAY, answered: 10 }, todayKey: TODAY, isPremium: false });
  assert.equal(quota.blocked, true);
  assert.equal(quota.remaining, 0);
});

test("au-delà de 10 (compteur hérité), le blocage reste stable et non négatif", () => {
  const quota = dailyQuestionQuota({ daily: { key: TODAY, answered: 14 }, todayKey: TODAY, isPremium: false });
  assert.equal(quota.blocked, true);
  assert.equal(quota.remaining, 0);
  assert.equal(quota.used, 14);
});

test("un compteur d'un autre jour ne bloque jamais (reset quotidien par la date)", () => {
  const quota = dailyQuestionQuota({ daily: { key: YESTERDAY, answered: 99 }, todayKey: TODAY, isPremium: false });
  assert.deepEqual(quota, { limit: 10, used: 0, remaining: 10, blocked: false });
});

test("un compteur absent, mal formé ou négatif est traité comme zéro", () => {
  const cases: unknown[] = [undefined, null, {}, { key: TODAY, answered: NaN }, { key: TODAY, answered: -5 }];
  for (const daily of cases) {
    const quota = dailyQuestionQuota({ daily: daily as never, todayKey: TODAY, isPremium: false });
    assert.equal(quota.used, 0, String(JSON.stringify(daily)));
    assert.equal(quota.blocked, false);
  }
  // valeur fractionnaire : arrondie vers le bas, jamais bloquante seule
  const frac = dailyQuestionQuota({ daily: { key: TODAY, answered: 2.9 }, todayKey: TODAY, isPremium: false });
  assert.equal(frac.used, 2);
});

test("le premium (licence active) est illimité mais garde son compteur visible", () => {
  const quota = dailyQuestionQuota({ daily: { key: TODAY, answered: 42 }, todayKey: TODAY, isPremium: true });
  assert.deepEqual(quota, { limit: null, used: 42, remaining: null, blocked: false });
});

test("l'essai 7 jours actif débloque l'illimité, expiré non", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  assert.equal(isTrialActive({ expiresAt: now + 1 }, now), true);
  assert.equal(isTrialActive({ expiresAt: now }, now), false);
  assert.equal(isTrialActive({ expiresAt: now - 1 }, now), false);
  const invalid: unknown[] = [null, undefined, {}, { expiresAt: NaN }, { expiresAt: "bientôt" }];
  for (const trial of invalid) {
    assert.equal(isTrialActive(trial as never, now), false);
  }
});
