import {
  constants,
  createCipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  sign,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function base64UrlToBuffer(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function assertRequest(value) {
  if (!value || typeof value !== "object") throw new Error("La demande appareil est invalide.");
  if (!/^OM-[A-F0-9]{8}$/.test(String(value.optimus_id))) {
    throw new Error("L'Optimus ID de la demande est invalide.");
  }
  for (const field of ["device_id", "device_key_id", "public_key"]) {
    if (typeof value[field] !== "string" || value[field].length < 8) {
      throw new Error(`Le champ ${field} de la demande appareil est invalide.`);
    }
  }
}

const input = argument("input");
const output = argument("output");
const requestPath = argument("request");
const product = String(argument("product") ?? "")
  .trim()
  .toUpperCase();
const days = Number(argument("days") ?? 365);

if (!input || !output || !requestPath) {
  throw new Error("--input, --output et --request sont requis.");
}
if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(product)) throw new Error("--product est invalide.");
if (!Number.isInteger(days) || days < 1 || days > 730) {
  throw new Error("--days doit être compris entre 1 et 730.");
}
if (!process.env.DECK_SIGNING_PRIVATE_KEY) {
  throw new Error("DECK_SIGNING_PRIVATE_KEY est requis.");
}

const request = JSON.parse(await readFile(requestPath, "utf8"));
assertRequest(request);
const requestPublicKey = base64UrlToBuffer(request.public_key);
const expectedKeyId = `device-${createHash("sha256").update(requestPublicKey).digest("base64url").slice(0, 22)}`;
if (request.device_key_id !== expectedKeyId) {
  throw new Error("La clé publique ne correspond pas à l'identifiant de l'appareil.");
}
const deck = JSON.parse(await readFile(input, "utf8"));
if (!deck || typeof deck !== "object" || Array.isArray(deck)) {
  throw new Error("Le Deck source est invalide.");
}
const deckId = String(deck.deck_id ?? deck.id ?? "").trim();
const title = String(deck.title ?? deck.metadata?.title ?? "").trim();
const version = String(deck.version ?? "1.0.0").trim();
if (!deckId || title.length < 2) throw new Error("Le Deck doit avoir un identifiant et un titre.");

const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
deck.access_policy = { tier: "pro", entitlement: product };
deck.license = {
  optimus_id: request.optimus_id,
  device_id: request.device_id,
  device_key_id: request.device_key_id,
  product,
  expires_at: expiresAt,
};
delete deck.signature;

const signingKey = createPrivateKey({
  key: Buffer.from(process.env.DECK_SIGNING_PRIVATE_KEY, "base64"),
  format: "der",
  type: "pkcs8",
});
deck.signature = {
  algorithm: "Ed25519",
  key_id: "optimus-decks-v1",
  value: sign(null, Buffer.from(canonicalize(deck)), signingKey).toString("base64url"),
};

const contentKey = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
const ciphertext = Buffer.concat([
  cipher.update(JSON.stringify(deck), "utf8"),
  cipher.final(),
  cipher.getAuthTag(),
]);
const deviceKey = createPublicKey({
  key: requestPublicKey,
  format: "der",
  type: "spki",
});
const wrappedKey = publicEncrypt(
  {
    key: deviceKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  },
  contentKey,
);

const envelope = {
  format: "optimus-encrypted-v1",
  schema_version: 1,
  deck: { deck_id: deckId, title, version },
  access_policy: { tier: "pro", entitlement: product },
  license: {
    optimus_id: request.optimus_id,
    device_id: request.device_id,
    device_key_id: request.device_key_id,
    product,
    expires_at: expiresAt,
  },
  encryption: {
    algorithm: "AES-256-GCM",
    key_wrap: "RSA-OAEP-256",
    iv: iv.toString("base64url"),
    wrapped_key: wrappedKey.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  },
};
envelope.signature = {
  algorithm: "Ed25519",
  key_id: "optimus-decks-v1",
  value: sign(null, Buffer.from(canonicalize(envelope)), signingKey).toString("base64url"),
};

await writeFile(output, `${JSON.stringify(envelope, null, 2)}\n`, { flag: "wx" });
console.log(`Deck chiffré pour ${request.optimus_id} / ${request.device_key_id} : ${output}`);
