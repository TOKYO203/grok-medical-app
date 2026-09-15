import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeOptimusSnapshots,
  optimusSyncSnapshotSchema,
  type OptimusSyncSnapshot,
} from "./optimus-sync-model.ts";

function snapshot(overrides: Partial<OptimusSyncSnapshot> = {}): OptimusSyncSnapshot {
  return optimusSyncSnapshotSchema.parse({
    version: 1,
    profile: {
      displayName: "Alice",
      optimusId: "OM-A1B2C3D4",
      studyYear: 5,
      studyLevel: 5,
      country: "Madagascar",
      faculty: "Faculté A",
      goal: "edn",
      prioritySubjects: ["Cardiologie"],
      avatar: "stethoscope",
      cover: "hautes-terres",
      onboarded: true,
    },
    xp: 100,
    streak: 2,
    lastActiveDay: "2026-09-14",
    weeklyXp: 100,
    weeklyKey: "2026-W38",
    daily: { key: "2026-09-14", answered: 5, xp: 100 },
    progress: {},
    badges: [],
    casesCompleted: [],
    diagnosticsCompleted: [],
    reviewsSucceeded: 0,
    purchases: [],
    ...overrides,
  });
}

const stats = (lastReview: number, repetitions: number) => ({
  correct: repetitions,
  wrong: 0,
  lastReview,
  nextReview: lastReview + 86_400_000,
  stability: 2,
  difficulty: 3,
  repetitions,
  successes: repetitions,
  failures: 0,
});

test("server Optimus ID stays authoritative while monotonic learning progress is merged", () => {
  const local = snapshot({
    profile: { ...snapshot().profile, displayName: "Local", optimusId: "OM-11111111" },
    xp: 220,
    badges: ["q100"],
    casesCompleted: ["CASE-LOCAL"],
    progress: {
      cardio: { seen: { q1: stats(200, 2) }, completedLessons: [0] },
    },
  });
  const remote = snapshot({
    profile: { ...snapshot().profile, displayName: "Cloud", optimusId: "OM-22222222" },
    xp: 180,
    badges: ["streak7"],
    casesCompleted: ["CASE-CLOUD"],
    progress: {
      cardio: {
        seen: { q1: stats(100, 1), q2: stats(300, 3) },
        completedLessons: [1],
      },
    },
  });

  const merged = mergeOptimusSnapshots(local, remote, { preferLocalProfile: true });
  assert.equal(merged.profile.optimusId, "OM-22222222");
  assert.equal(merged.profile.displayName, "Local");
  assert.equal(merged.xp, 220);
  assert.deepEqual(new Set(merged.badges), new Set(["q100", "streak7"]));
  assert.deepEqual(new Set(merged.casesCompleted), new Set(["CASE-LOCAL", "CASE-CLOUD"]));
  assert.equal(merged.progress.cardio?.seen.q1?.lastReview, 200);
  assert.equal(merged.progress.cardio?.seen.q2?.lastReview, 300);
  assert.deepEqual(merged.progress.cardio?.completedLessons, [0, 1]);
});

test("a new device keeps the cloud profile while still retaining newer learning progress", () => {
  const local = snapshot({
    profile: { ...snapshot().profile, displayName: "Fresh device", optimusId: "OM-AAAAAAAA" },
    xp: 250,
  });
  const remote = snapshot({
    profile: { ...snapshot().profile, displayName: "Cloud profile", optimusId: "OM-BBBBBBBB" },
    xp: 200,
  });

  const merged = mergeOptimusSnapshots(local, remote, { preferLocalProfile: false });
  assert.equal(merged.profile.displayName, "Cloud profile");
  assert.equal(merged.profile.optimusId, "OM-BBBBBBBB");
  assert.equal(merged.xp, 250);
});

test("week comparison is numeric, so W10 correctly supersedes W9", () => {
  const local = snapshot({ weeklyKey: "2026-W9", weeklyXp: 900 });
  const remote = snapshot({ weeklyKey: "2026-W10", weeklyXp: 100 });
  const merged = mergeOptimusSnapshots(local, remote, { preferLocalProfile: true });
  assert.equal(merged.weeklyKey, "2026-W10");
  assert.equal(merged.weeklyXp, 100);
});

test("latest purchase state wins per reference", () => {
  const basePurchase = {
    reference: "OPT-ORDER-001",
    offer: "deck" as const,
    specialty: "neurologie",
    deckNumber: 1,
    product: "NEURO_DECK_01",
    label: "Neurologie · Deck 1/10",
    amount: 3000,
    proofAttached: false,
    createdAt: 1,
  };
  const local = snapshot({
    purchases: [{ ...basePurchase, status: "proof_ready", updatedAt: 20 }],
  });
  const remote = snapshot({
    purchases: [{ ...basePurchase, status: "instructions_requested", updatedAt: 10 }],
  });

  const merged = mergeOptimusSnapshots(local, remote, { preferLocalProfile: true });
  assert.equal(merged.purchases[0]?.status, "proof_ready");
});
