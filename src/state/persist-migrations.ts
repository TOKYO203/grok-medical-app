export const OPTIMUS_PERSIST_VERSION = 2;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Upgrade persisted Optimus data without trusting its shape.
 *
 * The pre-versioned `optimus-v2` store is treated as version 0 by Zustand. We
 * preserve known learning data while repairing malformed scalar/collection
 * fields so a corrupted localStorage entry cannot poison the runtime state.
 */
export function migrateOptimusPersistedState(
  persistedState: unknown,
  persistedVersion: number,
): UnknownRecord {
  const source = record(persistedState);
  if (!source) return {};

  const next: UnknownRecord = { ...source };
  const profile = record(source.profile);
  if (profile) {
    const migratedProfile: UnknownRecord = { ...profile };
    const studyYear = finiteNumber(profile.studyYear, 5);
    migratedProfile.studyYear = studyYear;

    // Older installs only stored studyYear. Keep the user's level when moving
    // to the newer studyLevel model rather than resetting onboarding choices.
    if (
      persistedVersion < 2 &&
      migratedProfile.studyLevel === undefined &&
      Number.isInteger(studyYear) &&
      studyYear >= 1 &&
      studyYear <= 6
    ) {
      migratedProfile.studyLevel = studyYear;
    }
    next.profile = migratedProfile;
  }

  next.xp = finiteNumber(source.xp, 0);
  next.streak = finiteNumber(source.streak, 0);
  next.lastActiveDay = stringValue(source.lastActiveDay, "");
  next.weeklyXp = finiteNumber(source.weeklyXp, 0);
  next.weeklyKey = stringValue(source.weeklyKey, "");
  next.reviewsSucceeded = finiteNumber(source.reviewsSucceeded, 0);

  // Collection fields are repaired to an empty collection only when their
  // persisted value is malformed. Valid legacy arrays/objects are preserved.
  next.importedDecks = arrayValue(source.importedDecks);
  next.entitlements = arrayValue(source.entitlements);
  next.licenseReceipts = arrayValue(source.licenseReceipts);
  next.badges = arrayValue(source.badges);
  next.casesCompleted = arrayValue(source.casesCompleted);
  next.diagnosticsCompleted = arrayValue(source.diagnosticsCompleted);
  next.syncQueue = arrayValue(source.syncQueue);
  next.contacts = arrayValue(source.contacts);
  next.purchases = arrayValue(source.purchases);
  next.progress = record(source.progress) ?? {};

  const daily = record(source.daily);
  next.daily = daily
    ? {
        ...daily,
        key: stringValue(daily.key, ""),
        answered: finiteNumber(daily.answered, 0),
        xp: finiteNumber(daily.xp, 0),
      }
    : { key: "", answered: 0, xp: 0 };

  return next;
}
