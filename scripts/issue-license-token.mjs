#!/usr/bin/env node
/**
 * Émet un JETON DE LICENCE signé (`OPT1.<charge>.<signature>`) — à exécuter
 * UNIQUEMENT sur la machine du propriétaire.
 *
 * ⚠️ La clé PRIVÉE Ed25519 ne doit jamais entrer dans le dépôt ni dans une
 * variable d'environnement de la plateforme d'hébergement : elle ne sert qu'à
 * cette commande. Le serveur ne connaît que la clé PUBLIQUE
 * (`LICENSE_PUBLIC_KEY`) et vérifie la signature avec elle
 * (`src/server/license-verify.ts`).
 *
 * La clé est lue dans cet ordre :
 *   1. `--key-file <chemin>` ;
 *   2. `$LICENSE_SIGNING_PRIVATE_KEY` (base64url PKCS#8) ;
 *   3. `~/.optimus-keys/license.txt` (fichier hors dépôt, ligne
 *      `LICENSE_SIGNING_PRIVATE_KEY=…`).
 *
 * Usages :
 *   node scripts/issue-license-token.mjs --license-id OM-1A2B3C4D
 *   node scripts/issue-license-token.mjs --license-id ecole-2026 --expires 2027-06-30
 *   node scripts/issue-license-token.mjs --license-id qa --json
 *
 * Le jeton produit est un secret d'accès : ne le publier que dans un canal
 * privé (il ouvre le contenu Premium jusqu'à sa date d'expiration).
 */

import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TOKEN_SIGNING_CONTEXT = "OPTIMUS-LICENSE-TOKEN-V1";

/** Charge utile minimale — doit rester alignée sur `src/server/license-verify.ts`. */
export function buildLicenseToken(payload, privateKeyBase64Url) {
  const payloadJson = JSON.stringify(payload);
  const payloadSegment = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signingInput = `OPT1.${payloadSegment}`;
  const key = createPrivateKey({
    key: Buffer.from(privateKeyBase64Url, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const signature = sign(
    null,
    Buffer.from(`${TOKEN_SIGNING_CONTEXT}\n${signingInput}`, "utf8"),
    key,
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readPrivateKey() {
  const keyFile = argument("key-file");
  if (keyFile) {
    const content = readFileSync(keyFile, "utf8");
    const match = content.match(/LICENSE_SIGNING_PRIVATE_KEY\s*=\s*([A-Za-z0-9_+/=-]+)/);
    return (match?.[1] ?? content.trim()).trim();
  }

  const fromEnv = (process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "").trim();
  if (fromEnv) return fromEnv;

  try {
    const content = readFileSync(join(homedir(), ".optimus-keys", "license.txt"), "utf8");
    const match = content.match(/LICENSE_SIGNING_PRIVATE_KEY\s*=\s*([A-Za-z0-9_+/=-]+)/);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const licenseId = (argument("license-id") ?? "").trim();
  if (!licenseId) {
    console.error("Usage : node scripts/issue-license-token.mjs --license-id <identifiant> [--expires AAAA-MM-JJ] [--json]");
    process.exit(2);
  }

  const privateKey = readPrivateKey();
  if (!privateKey) {
    console.error(
      "Clé privée introuvable. Renseignez --key-file, LICENSE_SIGNING_PRIVATE_KEY, ou ~/.optimus-keys/license.txt.",
    );
    process.exit(2);
  }

  const payload = { v: 1, licenseId, tier: "premium", product: argument("product") ?? "OPTIMUS_PRO" };

  const expires = argument("expires");
  if (expires) {
    const timestamp = Date.parse(expires.length === 10 ? `${expires}T23:59:59Z` : expires);
    if (!Number.isFinite(timestamp)) {
      console.error(`Date d'expiration invalide : ${expires}`);
      process.exit(2);
    }
    payload.exp = Math.floor(timestamp / 1000);
  }

  const token = buildLicenseToken(payload, privateKey);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ token, payload }, null, 2));
  } else {
    console.log(token);
  }
}
