import { createPrivateKey, sign } from "node:crypto";
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

const input = argument("input");
const output = argument("output");
const optimusId = String(argument("optimus-id") ?? "").trim().toUpperCase();
const product = String(argument("product") ?? "").trim().toUpperCase();
const days = Number(argument("days") ?? 365);

if (!input || !output) throw new Error("--input et --output sont requis.");
if (!/^OM-[A-F0-9]{8}$/.test(optimusId)) throw new Error("--optimus-id est invalide.");
if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(product)) throw new Error("--product est invalide.");
if (!Number.isInteger(days) || days < 1 || days > 730) throw new Error("--days doit être compris entre 1 et 730.");
if (!process.env.DECK_SIGNING_PRIVATE_KEY) throw new Error("DECK_SIGNING_PRIVATE_KEY est requis.");

const deck = JSON.parse(await readFile(input, "utf8"));
deck.access_policy = { tier: "pro", entitlement: product };
deck.license = {
  optimus_id: optimusId,
  product,
  expires_at: new Date(Date.now() + days * 86400000).toISOString(),
};
delete deck.signature;

const privateKey = createPrivateKey({
  key: Buffer.from(process.env.DECK_SIGNING_PRIVATE_KEY, "base64"),
  format: "der",
  type: "pkcs8",
});
const signature = sign(null, Buffer.from(canonicalize(deck)), privateKey).toString("base64url");
deck.signature = { algorithm: "Ed25519", key_id: "optimus-decks-v1", value: signature };

await writeFile(output, `${JSON.stringify(deck, null, 2)}\n`, { flag: "wx" });
console.log(`Deck signé pour ${optimusId} : ${output}`);
