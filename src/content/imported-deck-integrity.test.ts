import assert from "node:assert/strict";
import {
  constants,
  createCipheriv,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  sign,
} from "node:crypto";
import test from "node:test";
import type { DeviceEncryptionIdentity } from "./device-encryption.ts";
import { unsignedDeckPayload } from "./deck-signature.ts";
import { importDeckJson, revalidateImportedDeck } from "./validator.ts";

const OPTIMUS_ID = "OM-12AB34CD";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyValue = String(publicKey.export({ format: "jwk" }).x);
const DEVICE_ID = "device-test-12345678";

function signedDeck() {
  const unsigned: Record<string, unknown> = {
    schema_version: 2,
    deck_id: "NEURO-PREMIUM-01",
    version: "1.0.0",
    title: "Urgences neurologiques",
    subject: "Neurologie",
    specialty: "Neurologie",
    study_year: 6,
    difficulty: "advanced",
    competencies: ["management"],
    access_policy: { tier: "pro", entitlement: "NEURO_DECK_01" },
    license: { optimus_id: OPTIMUS_ID, product: "NEURO_DECK_01", expires_at: null },
    questions: [
      {
        id: "neuro-1",
        prompt: "Quelle est la première priorité devant un état de mal convulsif ?",
        choices: ["Attendre", "Stabiliser ABC et traiter sans délai"],
        correct: 1,
        explanation: "La stabilisation et le traitement urgent sont menés en parallèle.",
        sources: [{ title: "AES", citation: "Guideline for convulsive status epilepticus." }],
        difficulty: "avance",
        competency: "management",
      },
    ],
  };
  const value = sign(null, Buffer.from(unsignedDeckPayload(unsigned)), privateKey).toString(
    "base64url",
  );
  return {
    ...unsigned,
    signature: { algorithm: "Ed25519", key_id: "optimus-decks-v1", value },
  };
}

async function encryptedDeck(): Promise<{
  envelope: Record<string, unknown>;
  identity: DeviceEncryptionIdentity & { deviceId: string };
}> {
  const devicePair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicDer = devicePair.publicKey.export({ format: "der", type: "spki" });
  const privateDer = devicePair.privateKey.export({ format: "der", type: "pkcs8" });
  const keyId = `device-${createHash("sha256").update(publicDer).digest("base64url").slice(0, 22)}`;
  const devicePrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  const plaintext = JSON.stringify(signedDeck());
  const contentKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const wrappedKey = publicEncrypt(
    {
      key: devicePair.publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    contentKey,
  );
  const unsigned: Record<string, unknown> = {
    format: "optimus-encrypted-v1",
    schema_version: 1,
    deck: {
      deck_id: "NEURO-PREMIUM-01",
      title: "Urgences neurologiques",
      version: "1.0.0",
    },
    access_policy: { tier: "pro", entitlement: "NEURO_DECK_01" },
    license: {
      optimus_id: OPTIMUS_ID,
      device_id: DEVICE_ID,
      device_key_id: keyId,
      product: "NEURO_DECK_01",
      expires_at: null,
    },
    encryption: {
      algorithm: "AES-256-GCM",
      key_wrap: "RSA-OAEP-256",
      iv: iv.toString("base64url"),
      wrapped_key: wrappedKey.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    },
  };
  const value = sign(null, Buffer.from(unsignedDeckPayload(unsigned)), privateKey).toString(
    "base64url",
  );
  return {
    envelope: {
      ...unsigned,
      signature: { algorithm: "Ed25519", key_id: "optimus-decks-v1", value },
    },
    identity: {
      keyId,
      publicKey: publicDer.toString("base64url"),
      privateKey: devicePrivateKey,
      deviceId: DEVICE_ID,
    },
  };
}

test("a signed Premium Deck is rebuilt from its verified envelope after local tampering", async () => {
  const imported = await importDeckJson(
    JSON.stringify(signedDeck()),
    [],
    OPTIMUS_ID,
    publicKeyValue,
  );
  assert.equal(imported.ok, true);
  if (!imported.ok) return;

  const tampered = structuredClone(imported.deck);
  tampered.title = "Copie falsifiée";
  tampered.questions[0].correct = 0;
  tampered.access_policy.tier = "free";
  tampered.importVerified = true;

  const restored = await revalidateImportedDeck(tampered, OPTIMUS_ID, publicKeyValue);
  assert.equal(restored.importVerified, true);
  assert.equal(restored.access_policy.tier, "pro");
  assert.equal(restored.title, "Urgences neurologiques");
  assert.equal(restored.questions[0].correct, 1);
});

test("a modified envelope or unrelated key leaves a Premium Deck locked", async () => {
  const imported = await importDeckJson(
    JSON.stringify(signedDeck()),
    [],
    OPTIMUS_ID,
    publicKeyValue,
  );
  assert.equal(imported.ok, true);
  if (!imported.ok || !imported.deck.importProof) return;

  const envelope = JSON.parse(imported.deck.importProof.envelope) as Record<string, unknown>;
  envelope.title = "Contenu remplacé";
  const altered = {
    ...imported.deck,
    importProof: { ...imported.deck.importProof, envelope: JSON.stringify(envelope) },
  };
  const alteredResult = await revalidateImportedDeck(altered, OPTIMUS_ID, publicKeyValue);
  assert.equal(alteredResult.importVerified, false);

  const unrelated = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" });
  const unrelatedResult = await revalidateImportedDeck(
    imported.deck,
    OPTIMUS_ID,
    String(unrelated.x),
  );
  assert.equal(unrelatedResult.importVerified, false);
});

test("an encrypted Premium Deck opens only with its non-exportable device key", async () => {
  const encrypted = await encryptedDeck();
  const imported = await importDeckJson(
    JSON.stringify(encrypted.envelope),
    [],
    OPTIMUS_ID,
    publicKeyValue,
    encrypted.identity,
  );
  assert.equal(imported.ok, true);
  if (!imported.ok) return;
  assert.equal(imported.deck.importProof?.format, "optimus-encrypted-v1");
  assert.equal(imported.deck.questions[0]?.correct, 1);

  const persistedWithoutPlaintext = { ...imported.deck, questions: [] };
  const restored = await revalidateImportedDeck(
    persistedWithoutPlaintext,
    OPTIMUS_ID,
    publicKeyValue,
    encrypted.identity,
  );
  assert.equal(restored.importVerified, true);
  assert.equal(restored.questions[0]?.prompt.includes("état de mal"), true);

  const copiedDevicePair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const copiedPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    copiedDevicePair.privateKey.export({ format: "der", type: "pkcs8" }),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  const copiedDevice = { ...encrypted.identity, privateKey: copiedPrivateKey };
  const copiedResult = await importDeckJson(
    JSON.stringify(encrypted.envelope),
    [],
    OPTIMUS_ID,
    publicKeyValue,
    copiedDevice,
  );
  assert.equal(copiedResult.ok, false);

  const wrongDevice = { ...encrypted.identity, deviceId: "device-copied-elsewhere" };
  const rejected = await importDeckJson(
    JSON.stringify(encrypted.envelope),
    [],
    OPTIMUS_ID,
    publicKeyValue,
    wrongDevice,
  );
  assert.equal(rejected.ok, false);
});
