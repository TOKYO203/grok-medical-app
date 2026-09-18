export const OPTIMUS_PERSIST_VERSION = 2;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
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
 * Upgrade an Optimus Zustand payload without trusting its persisted shape.
 *
 * The historical `optimus-v2` entry had no explicit Zustand version, so Zustand
 * treats it as version 0. The migration preserves valid learning state and only
 * repairs malformed scalar/collection fields. Business entitlements are still
 * revalidated by the runtime store after hydration.
 */
export function migrateOptimusPersistedState(
  persistedState: unknown,
  persistedVersion: number,
): UnknownRecord {
  const source = asRecord(persistedState);
  if (!source) return {};

  const next: UnknownRecord = { ...source };
  const profile = asRecord(source.profile);
  if (profile) {
    const migratedProfile: UnknownRecord = { ...profile };
    const studyYear = finiteNumber(profile.studyYear, 5);
    migratedProfile.studyYear = studyYear;

    // Legacy installs only had studyYear. Preserve it when the newer studyLevel
    // field is absent instead of silently resetting the learner's level.
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

  next.importedDecks = arrayValue(source.importedDecks);
  next.entitlements = arrayValue(source.entitlements);
  next.licenseReceipts = arrayValue(source.licenseReceipts);
  next.badges = arrayValue(source.badges);
  next.casesCompleted = arrayValue(source.casesCompleted);
  next.diagnosticsCompleted = arrayValue(source.diagnosticsCompleted);
  next.syncQueue = arrayValue(source.syncQueue);
  next.contacts = arrayValue(source.contacts);
  next.purchases = arrayValue(source.purchases);
  next.progress = asRecord(source.progress) ?? {};

  const daily = asRecord(source.daily);
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
