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
const purchaseReference = String(argument("purchase-ref") ?? "").trim().toUpperCase() || null;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis.");
if (!/^OM-[A-F0-9]{8}$/.test(optimusId)) throw new Error("--optimus-id doit ressembler à OM-A1B2C3D4.");
if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(product)) throw new Error("--product est invalide.");
if (!Number.isInteger(days) || days < 1 || days > 730) throw new Error("--days doit être compris entre 1 et 730.");
if (purchaseReference && !/^CMD-[A-Z0-9]+-[A-F0-9]{8}$/.test(purchaseReference)) {
  throw new Error("--purchase-ref est invalide.");
}

const raw = randomBytes(12).toString("hex").toUpperCase().match(/.{1,4}/g);
if (!raw) throw new Error("Impossible de générer la clé.");
const key = `OPT-${raw.join("-")}`;
const hash = createHash("sha256").update(key, "utf8").digest("hex");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (purchaseReference) {
    const purchase = await client.query(
      `select optimus_id, product, status
         from purchase_orders
        where reference = $1
        limit 1`,
      [purchaseReference],
    );
    const row = purchase.rows[0];
    if (!row) throw new Error("Commande introuvable.");
    if (row.optimus_id !== optimusId) throw new Error("L'Optimus ID ne correspond pas à la commande.");
    if (row.product !== product) throw new Error("Le produit ne correspond pas à la commande.");
    if (row.status !== "payment_verified" && row.status !== "delivered") {
      throw new Error("Le paiement doit être validé avant d'émettre une clé liée à la commande.");
    }
  }

  await client.query(
    `insert into activation_keys (key_hash, optimus_id, product, expires_at, purchase_reference)
     values ($1, $2, $3, now() + ($4::text || ' days')::interval, $5)`,
    [hash, optimusId, product, days, purchaseReference],
  );
} finally {
  await client.end();
}

console.log(`Clé : ${key}`);
console.log(`Optimus ID : ${optimusId}`);
console.log(`Produit : ${product}`);
console.log(`Durée : ${days} jours`);
if (purchaseReference) console.log(`Commande : ${purchaseReference}`);
