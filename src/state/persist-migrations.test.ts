import assert from "node:assert/strict";
import test from "node:test";
import {
  migrateOptimusPersistedState,
  OPTIMUS_PERSIST_VERSION,
} from "./persist-migrations.ts";

test("legacy unversioned Optimus state keeps XP, progress and learner profile", () => {
  const legacy = {
    profile: {
      displayName: "Aina",
      optimusId: "OM-ABC123",
      deviceId: "device-1",
      tier: "free",
      studyYear: 4,
      country: "Madagascar",
      faculty: "FM Antananarivo",
      goal: "edn",
      prioritySubjects: ["Cardiologie"],
      avatar: "stethoscope",
      cover: "hautes-terres",
      coverDataUrl: null,
      onboarded: true,
    },
    xp: 2450,
    streak: 8,
    lastActiveDay: "2026-09-14",
    weeklyXp: 520,
    weeklyKey: "2026-W38",
    daily: { key: "2026-09-15", answered: 12, xp: 180 },
    progress: {
      cardio: {
        seen: {
          q1: { repetitions: 3, correct: 2, wrong: 1 },
        },
        completedLessons: [0, 1],
      },
    },
    importedDecks: [],
    entitlements: [],
    licenseReceipts: [],
    badges: ["streak7"],
    casesCompleted: ["case-1"],
    diagnosticsCompleted: ["diag-1"],
    reviewsSucceeded: 9,
    syncQueue: [],
    contacts: [],
    purchases: [],
  };

  const migrated = migrateOptimusPersistedState(legacy, 0);
  assert.equal(OPTIMUS_PERSIST_VERSION, 2);
  assert.equal(migrated.xp, 2450);
  assert.equal(migrated.streak, 8);
  assert.deepEqual(migrated.progress, legacy.progress);
  assert.deepEqual(migrated.badges, ["streak7"]);
  assert.deepEqual(migrated.casesCompleted, ["case-1"]);

  const profile = migrated.profile as Record<string, unknown>;
  assert.equal(profile.displayName, "Aina");
  assert.equal(profile.studyYear, 4);
  assert.equal(profile.studyLevel, 4);
});

test("malformed persisted fields are repaired instead of poisoning hydration", () => {
  const migrated = migrateOptimusPersistedState(
    {
      profile: { displayName: "Test", studyYear: Number.NaN },
      xp: Number.NaN,
      streak: "broken",
      daily: "broken",
      progress: [],
      badges: "broken",
      importedDecks: null,
    },
    0,
  );

  assert.equal(migrated.xp, 0);
  assert.equal(migrated.streak, 0);
  assert.deepEqual(migrated.daily, { key: "", answered: 0, xp: 0 });
  assert.deepEqual(migrated.progress, {});
  assert.deepEqual(migrated.badges, []);
  assert.deepEqual(migrated.importedDecks, []);

  const profile = migrated.profile as Record<string, unknown>;
  assert.equal(profile.displayName, "Test");
  assert.equal(profile.studyYear, 5);
  assert.equal(profile.studyLevel, 5);
});

test("already current data is preserved while unsafe collection shapes are normalized", () => {
  const current = {
    profile: { displayName: "Miora", studyYear: 0, studyLevel: "senior" },
    xp: 99,
    progress: { neuro: { seen: {}, completedLessons: [] } },
    badges: [],
    importedDecks: [],
    entitlements: [],
    licenseReceipts: [],
    casesCompleted: [],
    diagnosticsCompleted: [],
    syncQueue: [],
    contacts: [],
    purchases: [],
  };

  const migrated = migrateOptimusPersistedState(current, OPTIMUS_PERSIST_VERSION);
  assert.equal(migrated.xp, 99);
  assert.deepEqual(migrated.progress, current.progress);
  assert.equal((migrated.profile as Record<string, unknown>).studyLevel, "senior");
});
