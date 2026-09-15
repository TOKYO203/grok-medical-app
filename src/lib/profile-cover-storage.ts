const DB_NAME = "optimus-device-assets";
const DB_VERSION = 1;
const STORE_NAME = "profile-covers";

export const MAX_PROFILE_COVER_BYTES = 2 * 1024 * 1024;

function available(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function normalizeOwner(ownerId: string): string {
  const trimmed = ownerId.trim();
  return trimmed || "OM-GUEST";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!available()) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
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

export async function saveProfileCover(ownerId: string, blob: Blob): Promise<void> {
  if (!blob.type.startsWith("image/")) throw new Error("profile_cover_invalid_type");
  if (blob.size <= 0 || blob.size > MAX_PROFILE_COVER_BYTES) {
    throw new Error("profile_cover_invalid_size");
  }

  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, normalizeOwner(ownerId));
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function loadProfileCover(ownerId: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(normalizeOwner(ownerId));
    const value = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("indexeddb_read_failed"));
    });
    await waitForTransaction(transaction);
    return value instanceof Blob && value.type.startsWith("image/") ? value : null;
  } finally {
    db.close();
  }
}

export async function deleteProfileCover(ownerId: string): Promise<void> {
  if (!available()) return;
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(normalizeOwner(ownerId));
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export function dataUrlToImageBlob(dataUrl: string): Blob {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("profile_cover_invalid_data_url");

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1] });
}
