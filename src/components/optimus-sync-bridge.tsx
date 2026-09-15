import { useEffect } from "react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  mergeOptimusSnapshots,
  optimusSyncSnapshotSchema,
  type OptimusSyncSnapshot,
} from "@/lib/optimus-sync-model";
import { pullOptimusState, pushOptimusState } from "@/lib/optimus-sync";
import { useOptimus, type OptimusState } from "@/state/store";

const OWNER_KEY = "optimus.sync.user-id";
const SYNC_DEBOUNCE_MS = 1_500;
const RETRY_MS = 15_000;

function buildSnapshot(state: OptimusState): OptimusSyncSnapshot {
  return optimusSyncSnapshotSchema.parse({
    version: 1,
    profile: {
      displayName: state.profile.displayName,
      optimusId: state.profile.optimusId,
      studyYear: state.profile.studyYear,
      studyLevel: state.profile.studyLevel,
      country: state.profile.country,
      faculty: state.profile.faculty,
      goal: state.profile.goal,
      prioritySubjects: state.profile.prioritySubjects,
      avatar: state.profile.avatar,
      // A custom cover is a device-local image asset. Do not pretend it exists on another device.
      cover: state.profile.cover === "custom" ? "hautes-terres" : state.profile.cover,
      onboarded: state.profile.onboarded,
    },
    xp: state.xp,
    streak: state.streak,
    lastActiveDay: state.lastActiveDay,
    weeklyXp: state.weeklyXp,
    weeklyKey: state.weeklyKey,
    daily: state.daily,
    progress: state.progress,
    badges: state.badges,
    casesCompleted: state.casesCompleted,
    diagnosticsCompleted: state.diagnosticsCompleted,
    reviewsSucceeded: state.reviewsSucceeded,
  });
}

function applySnapshot(snapshot: OptimusSyncSnapshot): void {
  useOptimus.setState((current) => ({
    profile: {
      ...current.profile,
      ...snapshot.profile,
      // Device identity, Premium tier and custom image bytes are never cloud-synced.
      deviceId: current.profile.deviceId,
      tier: current.profile.tier,
      cover:
        current.profile.cover === "custom" && current.profile.coverDataUrl
          ? "custom"
          : snapshot.profile.cover,
      coverDataUrl: current.profile.coverDataUrl,
    },
    xp: snapshot.xp,
    streak: snapshot.streak,
    lastActiveDay: snapshot.lastActiveDay,
    weeklyXp: snapshot.weeklyXp,
    weeklyKey: snapshot.weeklyKey,
    daily: snapshot.daily,
    progress: snapshot.progress,
    badges: snapshot.badges as OptimusState["badges"],
    casesCompleted: snapshot.casesCompleted,
    diagnosticsCompleted: snapshot.diagnosticsCompleted,
    reviewsSucceeded: snapshot.reviewsSucceeded,
  }));
}

function localOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function saveLocalOwner(userId: string): void {
  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

/**
 * Bridges offline-first learning state with an authenticated server snapshot.
 * Commerce, entitlements, device keys and Premium content deliberately use separate stores.
 */
export function OptimusSyncBridge() {
  const { user, isPending } = useCurrentUserState();
  const hydrated = useOptimus((state) => state.hydrated);
  const userId = user?.id ?? null;
  const userDisplayName = user?.displayName ?? null;
  const userIsDevFallback = user?.isDevFallback ?? false;

  useEffect(() => {
    if (!authEnabled || isPending || !userId || !hydrated || userIsDevFallback) return;

    let disposed = false;
    let initialized = false;
    let applyingRemote = false;
    let syncing = false;
    let queuedWhileSyncing = false;
    let revision = 0;
    let lastSerialized = "";
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let unsubscribe: (() => void) | undefined;

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const clearRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const stopForUserErasure = () => {
      initialized = false;
      queuedWhileSyncing = false;
      clearTimer();
      clearRetry();
      unsubscribe?.();
      unsubscribe = undefined;
      window.removeEventListener("online", schedulePush);
    };

    const markSnapshotSynced = (startedAt: number) => {
      applyingRemote = true;
      useOptimus.setState((state) => ({
        syncQueue: state.syncQueue.filter((event) => event.createdAt > startedAt),
      }));
      applyingRemote = false;
    };

    const pushCurrent = async () => {
      if (disposed || !initialized) return;
      if (syncing) {
        queuedWhileSyncing = true;
        return;
      }

      const snapshot = buildSnapshot(useOptimus.getState());
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSerialized) return;

      syncing = true;
      queuedWhileSyncing = false;
      const startedAt = Date.now();
      try {
        let result = await pushOptimusState({
          data: { baseRevision: revision || null, snapshot },
        });

        if (result.suspended) {
          stopForUserErasure();
          return;
        }

        if (result.conflict && result.snapshot) {
          const merged = mergeOptimusSnapshots(snapshot, result.snapshot, {
            preferLocalProfile: true,
          });
          applyingRemote = true;
          applySnapshot(merged);
          applyingRemote = false;
          result = await pushOptimusState({
            data: { baseRevision: result.revision, snapshot: merged },
          });
          if (result.suspended) {
            stopForUserErasure();
            return;
          }
        }

        if (!result.ok || !result.snapshot) {
          throw new Error("Conflit de synchronisation non résolu");
        }

        revision = result.revision;
        lastSerialized = JSON.stringify(result.snapshot);
        markSnapshotSynced(startedAt);
        clearRetry();
      } catch (error) {
        console.warn("[optimus-sync] push deferred", error);
        clearRetry();
        retryTimer = window.setTimeout(() => void pushCurrent(), RETRY_MS);
      } finally {
        syncing = false;
        if (queuedWhileSyncing && !disposed && initialized) {
          queuedWhileSyncing = false;
          clearTimer();
          timer = window.setTimeout(() => void pushCurrent(), 0);
        }
      }
    };

    const schedulePush = () => {
      if (!initialized || disposed || applyingRemote) return;
      clearTimer();
      timer = window.setTimeout(() => void pushCurrent(), SYNC_DEBOUNCE_MS);
    };

    const initialize = async () => {
      try {
        const owner = localOwner();
        const sameOwner = owner === userId;

        // Never merge another authenticated user's local learning history into this account.
        if (owner && !sameOwner) {
          useOptimus.getState().resetLocal();
        }

        if (useOptimus.getState().profile.optimusId === "OM-GUEST") {
          useOptimus.getState().createFreeAccount(userDisplayName ?? "Étudiant");
        }

        const local = buildSnapshot(useOptimus.getState());
        const remote = await pullOptimusState();
        if (disposed) return;

        // A user-requested erasure is durable across devices. Do not recreate a
        // deleted snapshot until the user explicitly re-enables cloud sync.
        if (remote.syncSuspended) {
          saveLocalOwner(userId);
          stopForUserErasure();
          return;
        }

        let effective = local;
        revision = remote.revision;

        if (remote.snapshot) {
          effective = mergeOptimusSnapshots(local, remote.snapshot, {
            // On a new device/account switch, server profile settings are authoritative.
            preferLocalProfile: sameOwner,
          });
          applyingRemote = true;
          applySnapshot(effective);
          applyingRemote = false;

          if (JSON.stringify(effective) !== JSON.stringify(remote.snapshot)) {
            const pushed = await pushOptimusState({
              data: { baseRevision: remote.revision, snapshot: effective },
            });
            if (pushed.suspended) {
              saveLocalOwner(userId);
              stopForUserErasure();
              return;
            }
            if (pushed.ok) {
              revision = pushed.revision;
              effective = pushed.snapshot;
            } else if (pushed.snapshot) {
              revision = pushed.revision;
              effective = mergeOptimusSnapshots(effective, pushed.snapshot, {
                preferLocalProfile: true,
              });
              applyingRemote = true;
              applySnapshot(effective);
              applyingRemote = false;
            }
          }
        } else {
          const pushed = await pushOptimusState({
            data: { baseRevision: null, snapshot: local },
          });
          if (pushed.suspended) {
            saveLocalOwner(userId);
            stopForUserErasure();
            return;
          }
          if (pushed.ok) {
            revision = pushed.revision;
            effective = pushed.snapshot;
          } else if (pushed.snapshot) {
            revision = pushed.revision;
            effective = mergeOptimusSnapshots(local, pushed.snapshot, {
              preferLocalProfile: false,
            });
            applyingRemote = true;
            applySnapshot(effective);
            applyingRemote = false;
          }
        }

        saveLocalOwner(userId);
        lastSerialized = JSON.stringify(buildSnapshot(useOptimus.getState()));
        initialized = true;
        unsubscribe = useOptimus.subscribe(() => schedulePush());
        window.addEventListener("online", schedulePush);
      } catch (error) {
        console.warn("[optimus-sync] initial sync deferred", error);
        if (!disposed) {
          clearRetry();
          retryTimer = window.setTimeout(() => void initialize(), RETRY_MS);
        }
      }
    };

    void initialize();

    return () => {
      disposed = true;
      clearTimer();
      clearRetry();
      unsubscribe?.();
      window.removeEventListener("online", schedulePush);
    };
  }, [hydrated, isPending, userDisplayName, userId, userIsDevFallback]);

  return null;
}
