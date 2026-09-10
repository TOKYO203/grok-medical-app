import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { unsignedDeckPayload } from "./deck-signature.ts";
import { importDeckJson, revalidateImportedDeck } from "./validator.ts";

const OPTIMUS_ID = "OM-12AB34CD";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyValue = String(publicKey.export({ format: "jwk" }).x);

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
