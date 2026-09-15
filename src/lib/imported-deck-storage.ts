import type { Deck } from "@/core/types";

const DB_PREFIX = "optimus-imported-decks";
const DB_VERSION = 1;
const STORE_NAME = "decks";
const GUEST_OWNER = "OM-GUEST";

export const MAX_IMPORTED_DECK_BYTES = 4 * 1024 * 1024;
export const MAX_IMPORTED_DECK_TOTAL_BYTES = 32 * 1024 * 1024;

function available(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function normalizeOwner(ownerId: string): string {
  const trimmed = ownerId.trim().toUpperCase();
  return trimmed || GUEST_OWNER;
}

function dbName(ownerId: string): string {
  return `${DB_PREFIX}:${normalizeOwner(ownerId)}`;
}

function openDb(ownerId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!available()) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(dbName(ownerId), DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
    request.onblocked = () => reject(new Error("indexeddb_blocked"));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("indexeddb_transaction_failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
  });
}

function isDeckRecord(value: unknown): value is Deck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<Deck>;
  return (
    typeof deck.id === "string" &&
    deck.id.length > 0 &&
    typeof deck.title === "string" &&
    Array.isArray(deck.questions) &&
    Array.isArray(deck.sources) &&
    Array.isArray(deck.chapters) &&
    Boolean(deck.access_policy) &&
    (deck.access_policy?.tier === "free" || deck.access_policy?.tier === "pro")
  );
}

export function importedDeckByteSize(deck: Deck): number {
  return new TextEncoder().encode(JSON.stringify(deck)).byteLength;
}

export function assertImportedDeckStorageBudget(decks: Deck[]): void {
  let total = 0;
  for (const deck of decks) {
    const bytes = importedDeckByteSize(deck);
    if (bytes <= 0 || bytes > MAX_IMPORTED_DECK_BYTES) {
      throw new Error("imported_deck_invalid_size");
    }
    total += bytes;
  }
  if (total > MAX_IMPORTED_DECK_TOTAL_BYTES) {
    throw new Error("imported_decks_total_too_large");
  }
}

export async function replaceImportedDecks(ownerId: string, decks: Deck[]): Promise<void> {
  const normalized = decks.filter((deck) => deck.imported === true);
  assertImportedDeckStorageBudget(normalized);

  const db = await openDb(ownerId);
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const completed = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    for (const deck of normalized) store.put(deck);
    await completed;
  } finally {
    db.close();
  }
}

async function readImportedDecks(ownerId: string): Promise<Deck[]> {
  const db = await openDb(ownerId);
  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const completed = waitForTransaction(transaction);
    const request = transaction.objectStore(STORE_NAME).getAll();
    const values = await new Promise<unknown[]>((resolve, reject) => {
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error ?? new Error("indexeddb_read_failed"));
    });
    await completed;
    return values.filter(isDeckRecord);
  } finally {
    db.close();
  }
}

export async function loadImportedDecks(ownerId: string): Promise<Deck[]> {
  // IndexedDB is intentionally client-only. During SSR there is no durable
  // browser storage to restore, so render with the persisted runtime state and
  // let the browser hydration pass perform the actual IndexedDB migration.
  if (typeof window === "undefined") return [];

  const owner = normalizeOwner(ownerId);
  const owned = await readImportedDecks(owner);
  if (owner === GUEST_OWNER) return owned;

  // Compatibility bridge for a device that imported a Deck before creating an account.
  // The guest database is consumed once, then deleted after a successful owner write.
  const guest = await readImportedDecks(GUEST_OWNER);
  if (guest.length === 0) return owned;

  const merged = new Map<string, Deck>();
  for (const deck of guest) merged.set(deck.id, deck);
  for (const deck of owned) merged.set(deck.id, deck);
  const decks = [...merged.values()];
  await replaceImportedDecks(owner, decks);
  await deleteImportedDeckStorage(GUEST_OWNER);
  return decks;
}

export async function deleteImportedDeckStorage(ownerId: string): Promise<void> {
  if (!available()) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName(ownerId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("indexeddb_delete_failed"));
    request.onblocked = () => reject(new Error("indexeddb_delete_blocked"));
  });
}
