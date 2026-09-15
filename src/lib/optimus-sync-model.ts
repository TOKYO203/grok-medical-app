import { z } from "zod";

const studyLevelSchema = z.union([
  z.number().int().min(1).max(6),
  z.enum(["intern", "resident", "junior", "senior", "consultant", "attending", "other"]),
]);

const syncedProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  optimusId: z.string().regex(/^OM-[A-F0-9]{8}$/),
  studyYear: z.number().int().min(0).max(6),
  studyLevel: studyLevelSchema.optional(),
  country: z.string().trim().max(120),
  faculty: z.string().trim().max(240),
  goal: z.string().trim().max(80),
  prioritySubjects: z.array(z.string().trim().min(1).max(120)).max(20),
  avatar: z.string().trim().min(1).max(80),
  cover: z.enum(["hautes-terres", "baobab", "canal", "clinique", "custom"]),
  onboarded: z.boolean(),
});

const reviewStatsSchema = z.object({
  correct: z.number().int().min(0).max(1_000_000),
  wrong: z.number().int().min(0).max(1_000_000),
  lastReview: z.number().finite().min(0),
  nextReview: z.number().finite().min(0),
  stability: z.number().finite().min(0).max(1_000_000_000),
  difficulty: z.number().finite().min(0).max(1_000_000_000),
  repetitions: z.number().int().min(0).max(1_000_000),
  successes: z.number().int().min(0).max(1_000_000),
  failures: z.number().int().min(0).max(1_000_000),
});

const deckProgressSchema = z.object({
  seen: z.record(z.string().min(1).max(180), reviewStatsSchema),
  completedLessons: z.array(z.number().int().min(0).max(10_000)).max(5_000),
});

const dailySchema = z.object({
  key: z.string().max(32),
  answered: z.number().int().min(0).max(10_000_000),
  xp: z.number().int().min(0).max(1_000_000_000),
});

const purchaseSchema = z.object({
  reference: z.string().trim().min(6).max(100),
  offer: z.enum(["deck", "specialty"]),
  specialty: z.string().trim().min(1).max(80),
  deckNumber: z.number().int().min(1).max(10),
  product: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(300),
  amount: z.number().int().min(0).max(10_000_000_000),
  status: z.enum([
    "created",
    "instructions_requested",
    "proof_ready",
    "verification_pending",
    "delivered",
  ]),
  proofAttached: z.boolean(),
  createdAt: z.number().finite().min(0),
  updatedAt: z.number().finite().min(0),
});

export const optimusSyncSnapshotSchema = z.object({
  version: z.literal(1),
  profile: syncedProfileSchema,
  xp: z.number().int().min(0).max(1_000_000_000),
  streak: z.number().int().min(0).max(100_000),
  lastActiveDay: z.string().max(32),
  weeklyXp: z.number().int().min(0).max(1_000_000_000),
  weeklyKey: z.string().max(32),
  daily: dailySchema,
  progress: z.record(z.string().min(1).max(180), deckProgressSchema),
  badges: z.array(z.string().min(1).max(80)).max(200),
  casesCompleted: z.array(z.string().min(1).max(180)).max(20_000),
  diagnosticsCompleted: z.array(z.string().min(1).max(180)).max(20_000),
  reviewsSucceeded: z.number().int().min(0).max(100_000_000),
  purchases: z.array(purchaseSchema).max(2_000),
});

export type OptimusSyncSnapshot = z.infer<typeof optimusSyncSnapshotSchema>;

export const optimusSyncPushSchema = z.object({
  baseRevision: z.number().int().min(0).nullable(),
  snapshot: optimusSyncSnapshotSchema,
});

function uniqueStrings(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])];
}

function mergeProgress(
  local: OptimusSyncSnapshot["progress"],
  remote: OptimusSyncSnapshot["progress"],
): OptimusSyncSnapshot["progress"] {
  const merged: OptimusSyncSnapshot["progress"] = {};
  const deckIds = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const deckId of deckIds) {
    const localDeck = local[deckId];
    const remoteDeck = remote[deckId];
    if (!localDeck) {
      merged[deckId] = remoteDeck;
      continue;
    }
    if (!remoteDeck) {
      merged[deckId] = localDeck;
      continue;
    }

    const seen = { ...remoteDeck.seen };
    for (const [questionId, localStats] of Object.entries(localDeck.seen)) {
      const remoteStats = seen[questionId];
      if (
        !remoteStats ||
        localStats.lastReview > remoteStats.lastReview ||
        (localStats.lastReview === remoteStats.lastReview &&
          localStats.repetitions > remoteStats.repetitions)
      ) {
        seen[questionId] = localStats;
      }
    }
    merged[deckId] = {
      seen,
      completedLessons: [...new Set([...remoteDeck.completedLessons, ...localDeck.completedLessons])].sort(
        (a, b) => a - b,
      ),
    };
  }
  return merged;
}

function weekOrdinal(value: string): number {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number(match[2]);
}

function mergePurchases(
  local: OptimusSyncSnapshot["purchases"],
  remote: OptimusSyncSnapshot["purchases"],
): OptimusSyncSnapshot["purchases"] {
  const byReference = new Map(remote.map((purchase) => [purchase.reference, purchase]));
  for (const purchase of local) {
    const previous = byReference.get(purchase.reference);
    if (!previous || purchase.updatedAt > previous.updatedAt) {
      byReference.set(purchase.reference, purchase);
    }
  }
  return [...byReference.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function mergeOptimusSnapshots(
  local: OptimusSyncSnapshot,
  remote: OptimusSyncSnapshot,
  options: { preferLocalProfile: boolean },
): OptimusSyncSnapshot {
  const localDayIsNewer = local.lastActiveDay > remote.lastActiveDay;
  const sameActiveDay = local.lastActiveDay === remote.lastActiveDay;
  const localWeekIsNewer = weekOrdinal(local.weeklyKey) > weekOrdinal(remote.weeklyKey);
  const sameWeek = local.weeklyKey === remote.weeklyKey;
  const localDailyIsNewer = local.daily.key > remote.daily.key;
  const sameDaily = local.daily.key === remote.daily.key;

  const profileBase = options.preferLocalProfile
    ? { ...remote.profile, ...local.profile }
    : { ...local.profile, ...remote.profile };

  return {
    version: 1,
    profile: {
      ...profileBase,
      // Once an account already exists on the server, its Optimus ID is authoritative.
      optimusId: remote.profile.optimusId,
      onboarded: local.profile.onboarded || remote.profile.onboarded,
    },
    xp: Math.max(local.xp, remote.xp),
    streak: localDayIsNewer
      ? local.streak
      : remote.lastActiveDay > local.lastActiveDay
        ? remote.streak
        : Math.max(local.streak, remote.streak),
    lastActiveDay: localDayIsNewer ? local.lastActiveDay : remote.lastActiveDay,
    weeklyXp: localWeekIsNewer
      ? local.weeklyXp
      : weekOrdinal(remote.weeklyKey) > weekOrdinal(local.weeklyKey)
        ? remote.weeklyXp
        : sameWeek
          ? Math.max(local.weeklyXp, remote.weeklyXp)
          : remote.weeklyXp,
    weeklyKey: localWeekIsNewer ? local.weeklyKey : remote.weeklyKey,
    daily: localDailyIsNewer
      ? local.daily
      : remote.daily.key > local.daily.key
        ? remote.daily
        : sameDaily
          ? {
              key: local.daily.key,
              answered: Math.max(local.daily.answered, remote.daily.answered),
              xp: Math.max(local.daily.xp, remote.daily.xp),
            }
          : remote.daily,
    progress: mergeProgress(local.progress, remote.progress),
    badges: uniqueStrings(local.badges, remote.badges),
    casesCompleted: uniqueStrings(local.casesCompleted, remote.casesCompleted),
    diagnosticsCompleted: uniqueStrings(local.diagnosticsCompleted, remote.diagnosticsCompleted),
    reviewsSucceeded: Math.max(local.reviewsSucceeded, remote.reviewsSucceeded),
    purchases: mergePurchases(local.purchases, remote.purchases),
  };
}
