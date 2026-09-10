import assert from "node:assert/strict";
import {
  constants,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  verify,
} from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

test("deck:encrypt produces a signed payload that only the requested device can read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "optimus-encrypted-deck-"));
  try {
    const input = join(directory, "source.json");
    const requestPath = join(directory, "request.json");
    const output = join(directory, "premium.json");
    const signingPair = generateKeyPairSync("ed25519");
    const devicePair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicDer = devicePair.publicKey.export({ format: "der", type: "spki" });
    const keyId = `device-${createHash("sha256").update(publicDer).digest("base64url").slice(0, 22)}`;
    const secretPrompt = "QUESTION PREMIUM QUI NE DOIT PAS APPARAITRE EN CLAIR";

    await writeFile(
      input,
      JSON.stringify({
        schema_version: 2,
        deck_id: "NEURO-SECRET-01",
        version: "1.0.0",
        title: "Neurologie Premium",
        questions: [{ prompt: secretPrompt }],
      }),
    );
    await writeFile(
      requestPath,
      JSON.stringify({
        format: "optimus-device-request-v1",
        optimus_id: "OM-12AB34CD",
        device_id: "device-test-12345678",
        device_key_id: keyId,
        public_key: publicDer.toString("base64url"),
      }),
    );

    const privateDer = signingPair.privateKey.export({ format: "der", type: "pkcs8" });
    const run = spawnSync(
      process.execPath,
      [
        "scripts/encrypt-deck.mjs",
        "--input",
        input,
        "--output",
        output,
        "--request",
        requestPath,
        "--product",
        "NEURO_DECK_01",
      ],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
        env: { ...process.env, DECK_SIGNING_PRIVATE_KEY: privateDer.toString("base64") },
      },
    );
    assert.equal(run.status, 0, run.stderr);

    const rawEnvelope = await readFile(output, "utf8");
    assert.equal(rawEnvelope.includes(secretPrompt), false);
    const envelope = JSON.parse(rawEnvelope);
    const { signature, ...unsigned } = envelope;
    assert.equal(
      verify(
        null,
        Buffer.from(canonicalize(unsigned)),
        signingPair.publicKey,
        Buffer.from(signature.value, "base64url"),
      ),
      true,
    );

    const contentKey = privateDecrypt(
      {
        key: devicePair.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(envelope.encryption.wrapped_key, "base64url"),
    );
    const encrypted = Buffer.from(envelope.encryption.ciphertext, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      contentKey,
      Buffer.from(envelope.encryption.iv, "base64url"),
    );
    decipher.setAuthTag(encrypted.subarray(-16));
    const plaintext = Buffer.concat([
      decipher.update(encrypted.subarray(0, -16)),
      decipher.final(),
    ]).toString("utf8");
    assert.equal(JSON.parse(plaintext).questions[0].prompt, secretPrompt);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
