import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BADGE_CATALOG, type BadgeId } from "@/content/badges";
import { BUILTIN_DECKS } from "@/content/catalog";
import { deckMastery, deckProgressPct } from "@/core/mastery";
import { applyReview, emptyStats } from "@/core/spaced-repetition";
import { leagueFromWeeklyXp, type LeagueId } from "@/core/scoring";
import type {
  AccountTier,
  ContactDraft,
  CoverId,
  Deck,
  DeckProgress,
  Entitlement,
  Profile,
  SyncEvent,
  SyncEventType,
} from "@/core/types";
import { todayKey, uid } from "@/lib/utils";

function makeOptimusId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `OM-${hex}`;
}

function makeDeviceId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const defaultProfile = (): Profile => ({
  displayName: "Invité",
  optimusId: "OM-GUEST",
  deviceId: "device-local",
  tier: "guest",
  studyYear: 5,
  country: "Madagascar",
  faculty: "",
  goal: "edn",
  prioritySubjects: ["Cardiologie"],
  avatar: "stethoscope",
  cover: "hautes-terres",
  coverDataUrl: null,
  onboarded: false,
});

type Daily = { key: string; answered: number; xp: number };

type PersistShape = {
  profile: Profile;
  xp: number;
  streak: number;
  lastActiveDay: string;
  weeklyXp: number;
  weeklyKey: string;
  daily: Daily;
  progress: Record<string, DeckProgress>;
  importedDecks: Deck[];
  entitlements: Entitlement[];
  badges: BadgeId[];
  casesCompleted: string[];
  diagnosticsCompleted: string[];
  reviewsSucceeded: number;
  syncQueue: SyncEvent[];
  contacts: ContactDraft[];
};

export type OptimusState = PersistShape & {
  hydrated: boolean;
  markHydrated: () => void;
  completeOnboarding: (p: Partial<Profile>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  createFreeAccount: (name: string) => void;
  activatePro: () => void;
  grantEntitlement: (product: string) => void;
  importDeck: (deck: Deck) => void;
  recordAnswer: (opts: {
    deckId: string;
    questionId: string;
    ok: boolean;
    xp: number;
    mode: string;
  }) => void;
  completeLesson: (deckId: string, lessonIndex: number) => void;
  completeCase: (caseId: string, xp: number) => void;
  completeDiagnostic: (id: string, xp: number) => void;
  enqueue: (type: SyncEventType, payload: Record<string, unknown>) => void;
  markQueueSynced: () => void;
  addContact: (kind: ContactDraft["kind"], body: string) => void;
  resetLocal: () => void;
};

function weekKey(ts = Date.now()): string {
  const d = new Date(ts);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function bumpStreak(lastActiveDay: string, today: string, streak: number): number {
  if (lastActiveDay === today) return streak;
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  const yKey = todayKey(y.getTime());
  if (lastActiveDay === yKey) return streak + 1;
  return 1;
}

function unlockBadges(state: PersistShape): BadgeId[] {
  const have = new Set(state.badges);
  const add = (id: BadgeId) => {
    if (!have.has(id)) have.add(id);
  };
  if (state.streak >= 7) add("streak7");
  const answered = Object.values(state.progress).reduce(
    (n, p) => n + Object.values(p.seen).reduce((a, s) => a + s.repetitions, 0),
    0,
  );
  if (answered >= 100) add("q100");
  if (state.casesCompleted.length >= 1) add("firstCase");
  const cardio = BUILTIN_DECKS.find((d) => d.id === "cardio");
  if (cardio) {
    const seen = state.progress.cardio?.seen ?? {};
    const qs = cardio.questions.filter((q) => seen[q.id]);
    if (qs.length >= 6) {
      const acc =
        qs.reduce((a, q) => a + (seen[q.id]?.correct ?? 0), 0) /
        Math.max(1, qs.reduce((a, q) => a + (seen[q.id]?.correct ?? 0) + (seen[q.id]?.wrong ?? 0), 0));
      if (acc >= 0.9) add("cardio90");
    }
  }
  const walked = Object.values(state.progress).filter((p) => Object.keys(p.seen).length > 0).length;
  if (walked >= 5) add("modules5");
  if (state.importedDecks.length >= 1) add("firstImport");
  if (state.diagnosticsCompleted.length >= 1) add("diagnostic");
  if (state.reviewsSucceeded >= 20) add("reviewer");
  const trop = state.progress.tropical;
  if (trop && Object.keys(trop.seen).length >= 6) add("tropical");
  return [...have] as BadgeId[];
}

const persistDefaults: PersistShape = {
  profile: defaultProfile(),
  xp: 0,
  streak: 0,
  lastActiveDay: "",
  weeklyXp: 0,
  weeklyKey: weekKey(),
  daily: { key: todayKey(), answered: 0, xp: 0 },
  progress: {},
  importedDecks: [],
  entitlements: [{ id: "ent-free", product: "OPTIMUS_FREE", issuedAt: Date.now(), expiresAt: null }],
  badges: [],
  casesCompleted: [],
  diagnosticsCompleted: [],
  reviewsSucceeded: 0,
  syncQueue: [],
  contacts: [],
};

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useOptimus = create<OptimusState>()(
  persist(
    (set) => ({
      ...persistDefaults,
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),
      completeOnboarding: (p) =>
        set((s) => ({
          profile: {
            ...s.profile,
            ...p,
            onboarded: true,
            deviceId: s.profile.deviceId === "device-local" ? makeDeviceId() : s.profile.deviceId,
            optimusId: s.profile.optimusId === "OM-GUEST" ? makeOptimusId() : s.profile.optimusId,
          },
        })),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      createFreeAccount: (name) =>
        set((s) => ({
          profile: {
            ...s.profile,
            displayName: name.trim() || "Étudiant",
            tier: s.profile.tier === "pro" ? "pro" : "free",
            optimusId:
              s.profile.optimusId.startsWith("OM-") && s.profile.optimusId !== "OM-GUEST"
                ? s.profile.optimusId
                : makeOptimusId(),
            deviceId: s.profile.deviceId === "device-local" ? makeDeviceId() : s.profile.deviceId,
          },
        })),
      activatePro: () =>
        set((s) => {
          const products = ["OPTIMUS_PRO", "CARDIO_PRO", "NEURO_PRO", "INFECTIO_PRO", "URGENCES_PRO", "DERMATO_PRO"];
          const have = new Set(s.entitlements.map((e) => e.product));
          const extra = products
            .filter((p) => !have.has(p))
            .map((product) => ({
              id: uid("ent"),
              product,
              issuedAt: Date.now(),
              expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365,
            }));
          return {
            profile: { ...s.profile, tier: "pro" as AccountTier },
            entitlements: [...s.entitlements, ...extra],
          };
        }),
      grantEntitlement: (product) =>
        set((s) => {
          if (s.entitlements.some((e) => e.product === product)) return s;
          return {
            entitlements: [
              ...s.entitlements,
              { id: uid("ent"), product, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 },
            ],
          };
        }),
      importDeck: (deck) =>
        set((s) => {
          const importedDecks = [...s.importedDecks.filter((d) => d.id !== deck.id), deck];
          return { importedDecks, badges: unlockBadges({ ...s, importedDecks }) };
        }),
      recordAnswer: ({ deckId, questionId, ok, xp, mode }) =>
        set((s) => {
          const today = todayKey();
          const wk = weekKey();
          const progress = { ...s.progress };
          const deckProg: DeckProgress = progress[deckId]
            ? { ...progress[deckId], seen: { ...progress[deckId].seen } }
            : { seen: {}, completedLessons: [] };
          const prev = deckProg.seen[questionId] ?? emptyStats();
          deckProg.seen[questionId] = applyReview(prev, ok);
          progress[deckId] = deckProg;
          const daily =
            s.daily.key === today
              ? { ...s.daily, answered: s.daily.answered + 1, xp: s.daily.xp + xp }
              : { key: today, answered: 1, xp };
          const weeklyXp = s.weeklyKey === wk ? s.weeklyXp + xp : xp;
          const streak = bumpStreak(s.lastActiveDay, today, s.streak || 0);
          const reviewsSucceeded = mode === "revue" && ok ? s.reviewsSucceeded + 1 : s.reviewsSucceeded;
          const event: SyncEvent = {
            id: uid("evt"),
            type: mode === "revue" ? "REVIEW_COMPLETED" : "QUESTION_ANSWERED",
            payload: { deckId, questionId, ok, xp, mode },
            createdAt: Date.now(),
            synced: false,
          };
          const next: PersistShape = {
            profile: s.profile,
            xp: s.xp + xp,
            daily,
            weeklyXp,
            weeklyKey: wk,
            streak,
            lastActiveDay: today,
            reviewsSucceeded,
            progress,
            importedDecks: s.importedDecks,
            entitlements: s.entitlements,
            badges: s.badges,
            casesCompleted: s.casesCompleted,
            diagnosticsCompleted: s.diagnosticsCompleted,
            syncQueue: [...s.syncQueue, event],
            contacts: s.contacts,
          };
          const badges = unlockBadges(next);
          const extraEvents: SyncEvent[] = badges
            .filter((b) => !s.badges.includes(b))
            .map((id) => ({
              id: uid("evt"),
              type: "ACHIEVEMENT_UNLOCKED" as const,
              payload: { id },
              createdAt: Date.now(),
              synced: false,
            }));
          return { ...next, badges, syncQueue: [...next.syncQueue, ...extraEvents] };
        }),
      completeLesson: (deckId, lessonIndex) =>
        set((s) => {
          const progress = { ...s.progress };
          const deckProg: DeckProgress = progress[deckId]
            ? { ...progress[deckId], completedLessons: [...progress[deckId].completedLessons] }
            : { seen: {}, completedLessons: [] };
          if (!deckProg.completedLessons.includes(lessonIndex)) deckProg.completedLessons.push(lessonIndex);
          progress[deckId] = deckProg;
          return { progress };
        }),
      completeCase: (caseId, xp) =>
        set((s) => {
          if (s.casesCompleted.includes(caseId)) return { xp: s.xp + Math.round(xp * 0.25) };
          const event: SyncEvent = {
            id: uid("evt"),
            type: "CASE_COMPLETED",
            payload: { caseId, xp },
            createdAt: Date.now(),
            synced: false,
          };
          const next: PersistShape = {
            ...pickPersist(s),
            casesCompleted: [...s.casesCompleted, caseId],
            xp: s.xp + xp,
            syncQueue: [...s.syncQueue, event],
          };
          return { ...next, badges: unlockBadges(next) };
        }),
      completeDiagnostic: (id, xp) =>
        set((s) => {
          if (s.diagnosticsCompleted.includes(id)) return s;
          const next: PersistShape = {
            ...pickPersist(s),
            diagnosticsCompleted: [...s.diagnosticsCompleted, id],
            xp: s.xp + xp,
          };
          return { ...next, badges: unlockBadges(next) };
        }),
      enqueue: (type, payload) =>
        set((s) => ({
          syncQueue: [...s.syncQueue, { id: uid("evt"), type, payload, createdAt: Date.now(), synced: false }],
        })),
      markQueueSynced: () =>
        set((s) => ({
          syncQueue: s.syncQueue.map((e) => ({ ...e, synced: true })),
          contacts: s.contacts.map((c) => ({ ...c, sent: true })),
        })),
      addContact: (kind, body) =>
        set((s) => {
          const draft: ContactDraft = { id: uid("msg"), kind, body, createdAt: Date.now(), sent: false };
          return {
            contacts: [...s.contacts, draft],
            syncQueue: [
              ...s.syncQueue,
              {
                id: uid("evt"),
                type: "CONTACT_MESSAGE",
                payload: { kind, body },
                createdAt: Date.now(),
                synced: false,
              },
            ],
          };
        }),
      resetLocal: () => set({ ...persistDefaults, hydrated: true, profile: { ...defaultProfile(), onboarded: false } }),
    }),
    {
      name: "optimus-v2",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      partialize: (s): PersistShape => pickPersist(s),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

function pickPersist(s: PersistShape): PersistShape {
  return {
    profile: s.profile,
    xp: s.xp,
    streak: s.streak,
    lastActiveDay: s.lastActiveDay,
    weeklyXp: s.weeklyXp,
    weeklyKey: s.weeklyKey,
    daily: s.daily,
    progress: s.progress,
    importedDecks: s.importedDecks,
    entitlements: s.entitlements,
    badges: s.badges,
    casesCompleted: s.casesCompleted,
    diagnosticsCompleted: s.diagnosticsCompleted,
    reviewsSucceeded: s.reviewsSucceeded,
    syncQueue: s.syncQueue,
    contacts: s.contacts,
  };
}

export function useAllDecks(): Deck[] {
  const imported = useOptimus((s) => s.importedDecks);
  const ids = new Set(BUILTIN_DECKS.map((d) => d.id));
  return [...BUILTIN_DECKS, ...imported.filter((d) => !ids.has(d.id))];
}

export function hasAccess(deck: Deck, entitlements: Entitlement[], tier: AccountTier): boolean {
  if (deck.access_policy.tier === "free") return true;
  if (tier === "pro") return true;
  const product = deck.access_policy.entitlement;
  const now = Date.now();
  return entitlements.some(
    (e) => (e.product === product || e.product === "OPTIMUS_PRO") && (e.expiresAt === null || e.expiresAt > now),
  );
}

export function currentLeague(weeklyXp: number): { id: LeagueId; label: string } {
  const l = leagueFromWeeklyXp(weeklyXp);
  return { id: l.id, label: l.label };
}

export function deckStats(deck: Deck, progress: DeckProgress | undefined) {
  return {
    progress: deckProgressPct(deck, progress),
    mastery: deckMastery(deck, progress),
  };
}

export { BADGE_CATALOG };
export type { CoverId };
