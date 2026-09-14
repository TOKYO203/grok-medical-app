import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import pg from "pg";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const optimusId = String(argument("optimus-id") ?? "").trim().toUpperCase();
const product = String(argument("product") ?? "OPTIMUS_PRO").trim().toUpperCase();
const days = Number(argument("days") ?? 365);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis.");
if (!/^OM-[A-F0-9]{8}$/.test(optimusId)) throw new Error("--optimus-id doit ressembler à OM-A1B2C3D4.");
if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(product)) throw new Error("--product est invalide.");
if (!Number.isInteger(days) || days < 1 || days > 730) throw new Error("--days doit être compris entre 1 et 730.");

const raw = randomBytes(12).toString("hex").toUpperCase().match(/.{1,4}/g);
if (!raw) throw new Error("Impossible de générer la clé.");
const key = `OPT-${raw.join("-")}`;
const hash = createHash("sha256").update(key, "utf8").digest("hex");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `insert into activation_keys (key_hash, optimus_id, product, expires_at)
     values ($1, $2, $3, now() + ($4::text || ' days')::interval)`,
    [hash, optimusId, product, days],
  );
} finally {
  await client.end();
}

console.log(`Clé : ${key}`);
console.log(`Optimus ID : ${optimusId}`);
console.log(`Produit : ${product}`);
console.log(`Durée : ${days} jours`);
