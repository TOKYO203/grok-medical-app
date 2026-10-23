import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BADGE_CATALOG, type BadgeId } from "@/content/badges";
import { getDeviceEncryptionIdentity } from "@/content/device-encryption";
import { isLicenseReceipt, verifyLicenseReceipt } from "@/content/license-receipt";
import {
  advancePurchase,
  ALL_SPECIALTIES,
  isPremiumOffer,
  orderAmount,
  orderLabel,
  orderProduct,
  PREMIUM_SPECIALTIES,
  PURCHASE_STATUSES,
  type OrderSpecialty,
  type PremiumOrder,
  type PremiumPurchase,
  type PurchaseStatus,
} from "@/content/purchase-order";
import { revalidateImportedDeck } from "@/content/validator";
import { startTrial, type PremiumTrial } from "@/lib/premium-trial";
import { deckMastery, deckProgressPct } from "@/core/mastery";
import { applyReview, emptyStats } from "@/core/spaced-repetition";
import { leagueFromWeeklyXp, type LeagueId } from "@/core/scoring";
import type {
  AccountTier,
  CaseHypothesis,
  CaseSession,
  ContactDraft,
  CoverId,
  Deck,
  DeckProgress,
  Entitlement,
  LicenseReceipt,
  Profile,
  SyncEvent,
  SyncEventType,
} from "@/core/types";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/core";
import {
  deleteImportedDeckStorage,
  loadImportedDecks,
  replaceImportedDecks,
} from "@/lib/imported-deck-storage";
import { todayKey, uid } from "@/lib/utils";
import { getBuiltinDecks } from "@/state/builtin-decks";
import {
  migrateOptimusPersistedState,
  OPTIMUS_PERSIST_VERSION,
} from "@/state/persist-migrations";

function makeOptimusId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `OM-${hex}`;
}

function makeDeviceId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const defaultProfile = (): Profile => ({
  displayName: "Nouveau",
  optimusId: "OM-GUEST",
  deviceId: "device-local",
  tier: "guest",
  studyYear: 5,
  studyLevel: 5,
  country: "Madagascar",
  faculty: "",
  goal: "edn",
  prioritySubjects: ["Cardiologie"],
  avatar: "stethoscope",
  avatarDataUrl: null,
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
  licenseReceipts: LicenseReceipt[];
  badges: BadgeId[];
  casesCompleted: string[];
  diagnosticsCompleted: string[];
  caseSessions: Record<string, CaseSession>;
  caseHypotheses: CaseHypothesis[];
  reviewsSucceeded: number;
  studyMs: number;
  syncQueue: SyncEvent[];
  contacts: ContactDraft[];
  purchases: PremiumPurchase[];
  premiumTrial: PremiumTrial | null;
  locale: Locale;
};

export type OptimusState = PersistShape & {
  hydrated: boolean;
  importedDeckStorageReady: boolean;
  finishHydration: () => void;
  restoreLicenses: () => Promise<void>;
  /**
   * Provisionne l'identité Optimus NATIVE (Optimus ID + identifiant d'appareil)
   * dès qu'un compte cloud est connu.
   *
   * POURQUOI : l'appareil démarre avec `OM-GUEST` / `device-local`, et le tunnel
   * de commande exige une identité stable (`profile.optimusId !== "OM-GUEST"`).
   * Sans ce provisionnement, un utilisateur fraîchement connecté voyait
   * « Finalisation du compte Optimus » — l'achat restait bloqué un cran APRÈS la
   * réparation de l'authentification.
   *
   * N'écrase jamais une valeur existante et ne renomme l'utilisateur que s'il
   * porte encore le nom par défaut.
   */
  ensureOptimusIdentity: (opts?: { displayName?: string | null }) => void;
  completeOnboarding: (p: Partial<Profile>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  createFreeAccount: (name: string) => void;
  activateLicense: (receipt: unknown) => Promise<boolean>;
  importDeck: (deck: Deck) => Promise<boolean>;
  recordAnswer: (opts: {
    deckId: string;
    questionId: string;
    ok: boolean;
    xp: number;
    mode: string;
  }) => void;
  completeLesson: (deckId: string, lessonIndex: number) => void;
  completeCase: (caseId: string, xp: number) => void;
  saveCaseSession: (session: CaseSession) => void;
  recordCaseHypothesis: (entry: {
    caseId: string;
    hypothesis: string;
    confidence: CaseSession["confidence"];
  }) => void;
  completeDiagnostic: (id: string, xp: number) => void;
  enqueue: (type: SyncEventType, payload: Record<string, unknown>) => void;
  addContact: (kind: ContactDraft["kind"], body: string) => void;
  upsertPurchase: (order: PremiumOrder, status: PurchaseStatus, proofAttached?: boolean) => void;
  startPremiumTrial: () => void;
  resetLocal: () => void;
  setLocale: (locale: Locale) => void;
  logStudyTime: (ms: number) => void;
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
  const cardio = getBuiltinDecks().find((d) => d.id === "cardio");
  if (cardio) {
    const seen = state.progress.cardio?.seen ?? {};
    const qs = cardio.questions.filter((q) => seen[q.id]);
    if (qs.length >= 6) {
      const acc =
        qs.reduce((a, q) => a + (seen[q.id]?.correct ?? 0), 0) /
        Math.max(
          1,
          qs.reduce((a, q) => a + (seen[q.id]?.correct ?? 0) + (seen[q.id]?.wrong ?? 0), 0),
        );
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

function freeEntitlement(): Entitlement {
  return { id: "ent-free", product: "OPTIMUS_FREE", issuedAt: 0, expiresAt: null };
}

function isStoredDeck(value: unknown): value is Deck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<Deck>;
  return (
    typeof deck.id === "string" &&
    typeof deck.title === "string" &&
    Array.isArray(deck.questions) &&
    Boolean(deck.access_policy) &&
    (deck.access_policy?.tier === "free" || deck.access_policy?.tier === "pro")
  );
}

function restoreStoredDecks(value: unknown): Deck[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isStoredDeck)
    .map((deck) =>
      deck.imported && (deck.importProof || deck.access_policy.tier === "pro")
        ? { ...deck, importVerified: false }
        : deck,
    );
}

function restorePurchases(value: unknown): PremiumPurchase[] {
  if (!Array.isArray(value)) return [];
  const specialtyIds = new Set<string>(PREMIUM_SPECIALTIES.map((specialty) => specialty.id));
  const statuses = new Set<string>(PURCHASE_STATUSES);

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const purchase = candidate as Partial<PremiumPurchase>;
    const deckNumber = Number(purchase.deckNumber);
    if (
      typeof purchase.reference !== "string" ||
      purchase.reference.length < 6 ||
      !isPremiumOffer(purchase.offer) ||
      !(specialtyIds.has(purchase.specialty ?? "") || purchase.specialty === ALL_SPECIALTIES) ||
      !Number.isInteger(deckNumber) ||
      deckNumber < 1 ||
      deckNumber > 10 ||
      typeof purchase.status !== "string" ||
      !statuses.has(purchase.status) ||
      typeof purchase.createdAt !== "number" ||
      !Number.isFinite(purchase.createdAt) ||
      typeof purchase.updatedAt !== "number" ||
      !Number.isFinite(purchase.updatedAt)
    ) {
      return [];
    }
    const order: PremiumOrder = {
      reference: purchase.reference,
      offer: purchase.offer,
      specialty: purchase.specialty as OrderSpecialty,
      deckNumber,
    };
    return [
      {
        ...order,
        product: orderProduct(order),
        label: orderLabel(order),
        amount: orderAmount(order),
        status: purchase.status as PurchaseStatus,
        proofAttached: purchase.proofAttached === true,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      },
    ];
  });
}

/** Essai Premium local (A03) — un seul par profil, jamais réémis par le persist. */
function restoreTrial(value: unknown): PremiumTrial | null {
  if (!value || typeof value !== "object") return null;
  const trial = value as Partial<PremiumTrial>;
  if (
    typeof trial.startedAt !== "number" ||
    !Number.isFinite(trial.startedAt) ||
    typeof trial.expiresAt !== "number" ||
    !Number.isFinite(trial.expiresAt)
  ) {
    return null;
  }
  return { startedAt: trial.startedAt, expiresAt: trial.expiresAt };
}

const CASE_CONFIDENCE_VALUES = new Set<string>(["hesitant", "sure", "certain"]);

/**
 * Phase 2 UX — sessions de reprise. La forme persistée n'est JAMAIS crue sur
 * parole : chaque session est revalidée champ par champ, comme les achats.
 */
function restoreCaseSessions(value: unknown): Record<string, CaseSession> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sessions: Record<string, CaseSession> = {};
  for (const [caseId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const session = raw as Partial<CaseSession>;
    if (session.caseId !== caseId) continue;
    if (typeof session.cursor !== "number" || !Number.isFinite(session.cursor) || session.cursor < 0) {
      continue;
    }
    sessions[caseId] = {
      caseId,
      cursor: Math.floor(session.cursor),
      correct:
        typeof session.correct === "number" && Number.isFinite(session.correct)
          ? Math.max(0, Math.floor(session.correct))
          : 0,
      asked:
        typeof session.asked === "number" && Number.isFinite(session.asked)
          ? Math.max(0, Math.floor(session.asked))
          : 0,
      hypothesis: typeof session.hypothesis === "string" ? session.hypothesis.slice(0, 2000) : "",
      confidence:
        session.confidence != null && CASE_CONFIDENCE_VALUES.has(session.confidence)
          ? session.confidence
          : null,
      committed: session.committed === true,
      updatedAt:
        typeof session.updatedAt === "number" && Number.isFinite(session.updatedAt)
          ? session.updatedAt
          : 0,
    };
  }
  return sessions;
}

/** Phase 2 UX — historique des hypothèses engagées, revalidé après hydration. */
function restoreCaseHypotheses(value: unknown): CaseHypothesis[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const entry = candidate as Partial<CaseHypothesis>;
    if (typeof entry.caseId !== "string" || !entry.caseId) return [];
    if (typeof entry.hypothesis !== "string" || !entry.hypothesis.trim()) return [];
    return [
      {
        caseId: entry.caseId,
        hypothesis: entry.hypothesis.slice(0, 2000),
        confidence:
          entry.confidence != null && CASE_CONFIDENCE_VALUES.has(entry.confidence)
            ? entry.confidence
            : null,
        createdAt:
          typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
            ? entry.createdAt
            : 0,
      },
    ];
  });
}

function deliverPurchases(purchases: PremiumPurchase[], products: Iterable<string>) {
  const delivered = new Set(products);
  if (delivered.size === 0) return purchases;
  return purchases.map((purchase) =>
    delivered.has(purchase.product) && purchase.status !== "delivered"
      ? advancePurchase(purchase, "delivered", purchase, purchase.proofAttached)
      : purchase,
  );
}

function deckForPersistence(deck: Deck): Deck {
  const { importVerified: _importVerified, ...persisted } = deck;
  return deck.importProof?.format === "optimus-encrypted-v1"
    ? { ...persisted, questions: [], sources: [], chapters: [] }
    : persisted;
}

function receiptEntitlement(receipt: LicenseReceipt): Entitlement {
  return {
    id: `lic-${receipt.signature.value.slice(0, 16)}`,
    product: receipt.payload.product,
    issuedAt: Date.parse(receipt.payload.issuedAt),
    expiresAt: receipt.payload.expiresAt === null ? null : Date.parse(receipt.payload.expiresAt),
  };
}

export function hasEntitlement(product: string, entitlements: Entitlement[]): boolean {
  const now = Date.now();
  return entitlements.some(
    (entitlement) =>
      entitlement.product === product &&
      (entitlement.expiresAt === null || entitlement.expiresAt > now),
  );
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
  entitlements: [freeEntitlement()],
  licenseReceipts: [],
  badges: [],
  casesCompleted: [],
  diagnosticsCompleted: [],
  caseSessions: {},
  caseHypotheses: [],
  reviewsSucceeded: 0,
  studyMs: 0,
  syncQueue: [],
  contacts: [],
  purchases: [],
  premiumTrial: null,
  locale: DEFAULT_LOCALE,
};

function mergePersistedState(persistedState: unknown, currentState: OptimusState): OptimusState {
  const saved =
    persistedState && typeof persistedState === "object"
      ? (persistedState as Partial<OptimusState>)
      : {};
  const runtimeActions = Object.fromEntries(
    Object.entries(currentState).filter(([, value]) => typeof value === "function"),
  );
  const savedProfile =
    saved.profile && typeof saved.profile === "object" ? saved.profile : currentState.profile;
  const profile = { ...currentState.profile, ...savedProfile };
  profile.tier = profile.optimusId === "OM-GUEST" ? "guest" : "free";

  return {
    ...currentState,
    ...saved,
    ...runtimeActions,
    profile,
    importedDecks: restoreStoredDecks(saved.importedDecks),
    entitlements: [freeEntitlement()],
    licenseReceipts: Array.isArray(saved.licenseReceipts) ? saved.licenseReceipts : [],
    purchases: restorePurchases(saved.purchases),
    premiumTrial: restoreTrial(saved.premiumTrial),
    caseSessions: restoreCaseSessions(saved.caseSessions),
    caseHypotheses: restoreCaseHypotheses(saved.caseHypotheses),
    locale: isLocale(saved.locale) ? saved.locale : DEFAULT_LOCALE,
    hydrated: false,
    importedDeckStorageReady: false,
  } as OptimusState;
}

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useOptimus = create<OptimusState>()(
  persist(
    (set, get) => ({
      ...persistDefaults,
      hydrated: false,
      importedDeckStorageReady: false,
      finishHydration: () => set({ hydrated: true }),
      restoreLicenses: async () => {
        const state = get();
        const licensePublicKey = import.meta.env.VITE_LICENSE_SIGNING_PUBLIC_KEY;
        const candidateReceipts = state.licenseReceipts.filter(isLicenseReceipt);
        const verified: LicenseReceipt[] = [];
        if (licensePublicKey) {
          for (const receipt of candidateReceipts) {
            if (
              await verifyLicenseReceipt(
                receipt,
                licensePublicKey,
                state.profile.optimusId,
                state.profile.deviceId,
              )
            ) {
              verified.push(receipt);
            }
          }
        }
        const licenseReceipts = licensePublicKey ? verified : candidateReceipts;
        const entitlements = [
          freeEntitlement(),
          ...(licensePublicKey ? verified.map(receiptEntitlement) : []),
        ];

        let storedDecks = state.importedDecks;
        let importedDeckStorageReady = false;
        try {
          const indexedDecks = await loadImportedDecks(state.profile.optimusId);
          if (state.importedDecks.length > 0) {
            const merged = new Map<string, Deck>();
            for (const deck of indexedDecks) merged.set(deck.id, deck);
            for (const deck of state.importedDecks) merged.set(deck.id, deck);
            storedDecks = [...merged.values()];
            await replaceImportedDecks(
              state.profile.optimusId,
              storedDecks.map(deckForPersistence),
            );
          } else {
            storedDecks = indexedDecks;
          }
          importedDeckStorageReady = true;
        } catch (error) {
          console.warn("[imported-decks] IndexedDB restore deferred", error);
        }

        const needsDeviceKey = storedDecks.some(
          (deck) => deck.importProof?.format === "optimus-encrypted-v1",
        );
        const encryptionIdentity = needsDeviceKey ? await getDeviceEncryptionIdentity(false) : null;
        const deckDevice = encryptionIdentity
          ? { ...encryptionIdentity, deviceId: state.profile.deviceId }
          : undefined;
        const importedDecks = await Promise.all(
          storedDecks.map((deck) =>
            revalidateImportedDeck(
              deck,
              state.profile.optimusId,
              import.meta.env.VITE_DECK_SIGNING_PUBLIC_KEY,
              deckDevice,
            ),
          ),
        );
        const pro = hasEntitlement("OPTIMUS_PRO", entitlements);
        const deliveredProducts = [
          ...verified.map((receipt) => receipt.payload.product),
          ...importedDecks
            .filter((deck) => deck.importVerified === true)
            .map((deck) => deck.access_policy.entitlement),
        ];
        set((current) => ({
          licenseReceipts,
          entitlements,
          importedDecks,
          importedDeckStorageReady,
          profile: {
            ...current.profile,
            tier: pro ? "pro" : current.profile.optimusId === "OM-GUEST" ? "guest" : "free",
          },
          purchases: deliverPurchases(current.purchases, deliveredProducts),
          hydrated: true,
        }));
      },
      ensureOptimusIdentity: (opts) =>
        set((s) => {
          const needsOptimusId = !s.profile.optimusId || s.profile.optimusId === "OM-GUEST";
          const needsDeviceId = !s.profile.deviceId || s.profile.deviceId === "device-local";
          const suggested = opts?.displayName?.trim() ?? "";
          const defaultName = !s.profile.displayName || s.profile.displayName === "Nouveau";
          const shouldRename = Boolean(suggested) && defaultName;
          if (!needsOptimusId && !needsDeviceId && !shouldRename) return {};
          return {
            profile: {
              ...s.profile,
              optimusId: needsOptimusId ? makeOptimusId() : s.profile.optimusId,
              deviceId: needsDeviceId ? makeDeviceId() : s.profile.deviceId,
              displayName: shouldRename ? suggested : s.profile.displayName,
              // `guest` n'a plus de sens dès qu'une identité réelle existe.
              tier: s.profile.tier === "guest" ? "free" : s.profile.tier,
            },
          };
        }),
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
      setLocale: (locale) => set({ locale }),
      logStudyTime: (ms) =>
        set((s) => ({ studyMs: s.studyMs + Math.max(0, Math.round(ms)) })),
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
      activateLicense: async (receiptValue) => {
        const state = get();
        if (
          !(await verifyLicenseReceipt(
            receiptValue,
            import.meta.env.VITE_LICENSE_SIGNING_PUBLIC_KEY,
            state.profile.optimusId,
            state.profile.deviceId,
          ))
        ) {
          return false;
        }
        if (!isLicenseReceipt(receiptValue)) return false;
        const receipt = receiptValue;
        const licenseReceipts = [
          ...state.licenseReceipts.filter(
            (saved) => saved.payload.product !== receipt.payload.product,
          ),
          receipt,
        ];
        const entitlements = [freeEntitlement(), ...licenseReceipts.map(receiptEntitlement)];
        set((current) => ({
          licenseReceipts,
          entitlements,
          profile: {
            ...current.profile,
            tier: hasEntitlement("OPTIMUS_PRO", entitlements) ? "pro" : "free",
          },
          purchases: deliverPurchases(current.purchases, [receipt.payload.product]),
        }));
        return true;
      },
      importDeck: async (deck) => {
        const state = get();
        const importedDecks = [...state.importedDecks.filter((d) => d.id !== deck.id), deck];
        try {
          await replaceImportedDecks(
            state.profile.optimusId,
            importedDecks.map(deckForPersistence),
          );
        } catch (error) {
          console.warn("[imported-decks] save rejected", error);
          return false;
        }
        set((s) => ({
          importedDecks,
          importedDeckStorageReady: true,
          badges: unlockBadges({ ...s, importedDecks }),
          purchases:
            deck.importVerified === true
              ? deliverPurchases(s.purchases, [deck.access_policy.entitlement])
              : s.purchases,
        }));
        return true;
      },
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
          const reviewsSucceeded =
            mode === "revue" && ok ? s.reviewsSucceeded + 1 : s.reviewsSucceeded;
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
            studyMs: s.studyMs,
            progress,
            importedDecks: s.importedDecks,
            entitlements: s.entitlements,
            licenseReceipts: s.licenseReceipts,
            badges: s.badges,
            casesCompleted: s.casesCompleted,
            diagnosticsCompleted: s.diagnosticsCompleted,
            caseSessions: s.caseSessions,
            caseHypotheses: s.caseHypotheses,
            syncQueue: [...s.syncQueue, event],
            contacts: s.contacts,
            purchases: s.purchases,
            premiumTrial: s.premiumTrial,
            locale: s.locale,
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
          if (!deckProg.completedLessons.includes(lessonIndex))
            deckProg.completedLessons.push(lessonIndex);
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
          // Le dossier est terminé : sa session de reprise devient inutile.
          const caseSessions = { ...s.caseSessions };
          delete caseSessions[caseId];
          const next: PersistShape = {
            ...pickPersist(s),
            casesCompleted: [...s.casesCompleted, caseId],
            caseSessions,
            xp: s.xp + xp,
            syncQueue: [...s.syncQueue, event],
          };
          return { ...next, badges: unlockBadges(next) };
        }),
      /**
       * Phase 2 UX — persistance de la session de dossier : chaque étape,
       * décision, hypothèse et engagement est sauvegardé pour reprendre le cas
       * après un refresh ou une interruption.
       */
      saveCaseSession: (session) =>
        set((s) => ({
          caseSessions: { ...s.caseSessions, [session.caseId]: session },
        })),
      /**
       * Phase 2 UX — historique de calibration : l'hypothèse engagée avant la
       * révélation du diagnostic est archivée, une par révélation.
       */
      recordCaseHypothesis: (entry) =>
        set((s) => ({
          caseHypotheses: [...s.caseHypotheses, { ...entry, createdAt: Date.now() }],
        })),
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
          syncQueue: [
            ...s.syncQueue,
            { id: uid("evt"), type, payload, createdAt: Date.now(), synced: false },
          ],
        })),
      addContact: (kind, body) =>
        set((s) => {
          const draft: ContactDraft = {
            id: uid("msg"),
            kind,
            body,
            createdAt: Date.now(),
            sent: false,
          };
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
      upsertPurchase: (order, status, proofAttached = false) =>
        set((s) => {
          const previous = s.purchases.find((purchase) => purchase.reference === order.reference);
          const purchase = advancePurchase(order, status, previous, proofAttached);
          return {
            purchases: [
              purchase,
              ...s.purchases.filter((saved) => saved.reference !== order.reference),
            ],
          };
        }),
      startPremiumTrial: () =>
        set((s) => {
          if (s.premiumTrial) return {};
          return { premiumTrial: startTrial() };
        }),
      resetLocal: () => {
        const ownerId = get().profile.optimusId;
        void deleteImportedDeckStorage(ownerId).catch((error) => {
          console.warn("[imported-decks] cleanup deferred", error);
        });
        set({
          ...persistDefaults,
          hydrated: true,
          importedDeckStorageReady: false,
          profile: { ...defaultProfile(), onboarded: false },
        });
      },
    }),
    {
      name: "optimus-v2",
      version: OPTIMUS_PERSIST_VERSION,
      migrate: (persistedState, version) =>
        migrateOptimusPersistedState(persistedState, version) as PersistShape,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : localStorage,
      ),
      partialize: (s): PersistShape => ({
        ...pickPersist(s),
        importedDecks: s.importedDeckStorageReady
          ? []
          : s.importedDecks.map(deckForPersistence),
        entitlements: [freeEntitlement()],
      }),
      onRehydrateStorage: () => (state) => {
        void state?.restoreLicenses();
      },
      merge: mergePersistedState,
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
    licenseReceipts: s.licenseReceipts,
    badges: s.badges,
    casesCompleted: s.casesCompleted,
    diagnosticsCompleted: s.diagnosticsCompleted,
    caseSessions: s.caseSessions,
    caseHypotheses: s.caseHypotheses,
    reviewsSucceeded: s.reviewsSucceeded,
    studyMs: s.studyMs,
    syncQueue: s.syncQueue,
    contacts: s.contacts,
    purchases: s.purchases,
    premiumTrial: s.premiumTrial,
    locale: s.locale,
  };
}

export function useAllDecks(): Deck[] {
  const imported = useOptimus((s) => s.importedDecks);
  const builtin = getBuiltinDecks();
  const ids = new Set(builtin.map((d) => d.id));
  return [...builtin, ...imported.filter((d) => !ids.has(d.id))];
}

export function hasAccess(deck: Deck, entitlements: Entitlement[], _tier: AccountTier): boolean {
  // Sécurité : les brouillons ne sont JAMAIS accessibles aux utilisateurs
  if (deck.status === "draft" || deck.status === "deprecated") return false;
  if (deck.imported) {
    if (!deck.importProof && deck.access_policy.tier === "free") return true;
    return (
      deck.importVerified === true &&
      (deck.importLicenseExpiresAt === null ||
        (typeof deck.importLicenseExpiresAt === "number" &&
          deck.importLicenseExpiresAt > Date.now()))
    );
  }
  if (deck.access_policy.tier === "free") return true;
  const product = deck.access_policy.entitlement;
  return hasEntitlement(product, entitlements) || hasEntitlement("OPTIMUS_PRO", entitlements);
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
