const DATABASE_NAME = "optimus-device-keys";
const STORE_NAME = "identities";
const IDENTITY_ID = "optimus-rsa-oaep-v1";

export type DeviceEncryptionIdentity = {
  keyId: string;
  publicKey: string;
  privateKey: CryptoKey;
};

export type EncryptedDeckCipher = {
  algorithm: "AES-256-GCM";
  key_wrap: "RSA-OAEP-256";
  iv: string;
  wrapped_key: string;
  ciphertext: string;
};

type StoredIdentity = DeviceEncryptionIdentity & {
  id: typeof IDENTITY_ID;
};

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB indisponible"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB indisponible"));
  });
}

async function readIdentity(): Promise<StoredIdentity | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    return (await requestResult(transaction.objectStore(STORE_NAME).get(IDENTITY_ID))) ?? null;
  } finally {
    database.close();
  }
}

async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).put(identity));
  } finally {
    database.close();
  }
}

async function createIdentity(): Promise<StoredIdentity> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false,
    ["encrypt", "decrypt"],
  )) as CryptoKeyPair;
  const exported = await crypto.subtle.exportKey("spki", pair.publicKey);
  const fingerprint = await crypto.subtle.digest("SHA-256", exported);
  return {
    id: IDENTITY_ID,
    keyId: `device-${toBase64Url(fingerprint).slice(0, 22)}`,
    publicKey: toBase64Url(exported),
    privateKey: pair.privateKey,
  };
}

export async function getDeviceEncryptionIdentity(
  createIfMissing = true,
): Promise<DeviceEncryptionIdentity | null> {
  if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) return null;
  try {
    const stored = await readIdentity();
    if (stored) return stored;
    if (!createIfMissing) return null;
    const identity = await createIdentity();
    await saveIdentity(identity);
    return identity;
  } catch {
    return null;
  }
}

export async function decryptDeckCipher(
  encryption: EncryptedDeckCipher,
  privateKey: CryptoKey,
): Promise<string> {
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64Url(encryption.wrapped_key),
  );
  const contentKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(encryption.iv) },
    contentKey,
    fromBase64Url(encryption.ciphertext),
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}
