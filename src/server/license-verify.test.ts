import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { verifyLicenseKey } from "./license-verify.ts";

/**
 * Vérification de licence — le point d'entrée du module Premium.
 *
 * Ce qui doit être vrai, et que ces tests verrouillent :
 *   1. seule la clé PUBLIQUE est utilisée (aucune clé privée dans le serveur) ;
 *   2. un jeton expiré, altéré ou destiné à un autre usage est refusé ;
 *   3. sans clé publique configurée, le service se ferme (jamais d'ouverture) ;
 *   4. une clé d'activation ne produit JAMAIS de jeton sans appareil lié.
 */

const SIGNING_CONTEXT = "OPTIMUS-LICENSE-TOKEN-V1";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const rawPublicKey = String(publicKey.export({ format: "jwk" }).x);

function signLicenseToken(payload: Record<string, unknown>, key = privateKey): string {
  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `OPT1.${payloadSegment}`;
  const signature = sign(
    null,
    Buffer.from(`${SIGNING_CONTEXT}\n${signingInput}`, "utf8"),
    key,
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

function usePublicKey(value: string | undefined) {
  delete process.env.VITE_LICENSE_SIGNING_PUBLIC_KEY;
  if (value === undefined) delete process.env.LICENSE_PUBLIC_KEY;
  else process.env.LICENSE_PUBLIC_KEY = value;
}

test("accepte un jeton signé valide et rend l'identifiant de licence", async () => {
  usePublicKey(rawPublicKey);

  const token = signLicenseToken({
    v: 1,
    licenseId: "lic-abc",
    tier: "premium",
    product: "OPTIMUS_PRO",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const result = await verifyLicenseKey(token);
  assert.equal(result.ok, true);
  assert.equal(result.ok === true ? result.licenseId : null, "lic-abc");
  assert.equal(result.ok === true ? result.source : null, "signed");
});

test("accepte un jeton sans expiration (licence perpétuelle)", async () => {
  usePublicKey(rawPublicKey);
  const result = await verifyLicenseKey(
    signLicenseToken({ v: 1, licenseId: "lic-perpetuelle", tier: "premium" }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok === true ? result.expiresAt : "?", null);
});

test("rejette un jeton dont la charge a été modifiée", async () => {
  usePublicKey(rawPublicKey);

  const genuine = signLicenseToken({ v: 1, licenseId: "lic-abc", tier: "premium" });
  const signature = genuine.split(".")[2];
  const forgedPayload = Buffer.from(
    JSON.stringify({ v: 1, licenseId: "lic-volee", tier: "premium" }),
    "utf8",
  ).toString("base64url");

  const result = await verifyLicenseKey(`OPT1.${forgedPayload}.${signature}`);
  assert.deepEqual(result, { ok: false, reason: "invalid" });
});

test("rejette un jeton signé par une autre clé privée", async () => {
  usePublicKey(rawPublicKey);

  const other = generateKeyPairSync("ed25519").privateKey;
  const token = signLicenseToken({ v: 1, licenseId: "lic-abc", tier: "premium" }, other);

  assert.deepEqual(await verifyLicenseKey(token), { ok: false, reason: "invalid" });
});

test("rejette un jeton expiré", async () => {
  usePublicKey(rawPublicKey);
  const token = signLicenseToken({
    v: 1,
    licenseId: "lic-abc",
    tier: "premium",
    exp: Math.floor(Date.now() / 1000) - 60,
  });

  assert.deepEqual(await verifyLicenseKey(token), { ok: false, reason: "invalid" });
});

test("rejette un jeton dont le palier n'est pas premium", async () => {
  usePublicKey(rawPublicKey);
  const token = signLicenseToken({ v: 1, licenseId: "lic-abc", tier: "free" });
  assert.deepEqual(await verifyLicenseKey(token), { ok: false, reason: "invalid" });
});

test("rejette une version de charge inconnue", async () => {
  usePublicKey(rawPublicKey);
  const token = signLicenseToken({ v: 2, licenseId: "lic-abc", tier: "premium" });
  assert.deepEqual(await verifyLicenseKey(token), { ok: false, reason: "invalid" });
});

test("sans clé publique configurée, le service se ferme (unavailable)", async () => {
  usePublicKey(undefined);
  const token = signLicenseToken({ v: 1, licenseId: "lic-abc", tier: "premium" });
  assert.deepEqual(await verifyLicenseKey(token), { ok: false, reason: "unavailable" });
});

test("rejette une clé d'activation non liée à un appareil", async () => {
  usePublicKey(rawPublicKey);
  const key = "OPT-1111-2222-3333-4444-5555-6666";
  // Sans `deviceId`, aucune lecture base n'est tentée : la clé ne prouve rien.
  assert.deepEqual(await verifyLicenseKey(key), { ok: false, reason: "invalid" });
});

test("une clé d'activation avec appareil mais sans base échoue fermée", async () => {
  usePublicKey(rawPublicKey);
  const result = await verifyLicenseKey("OPT-1111-2222-3333-4444-5555-6666", {
    deviceId: "a1b2c3d4e5f6",
  });
  // Base injoignable (ou absente du runtime de test) → 503 côté route, jamais 200.
  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.reason : "?", "unavailable");
});

test("rejette toute chaîne qui n'est ni un jeton ni une clé d'activation", async () => {
  usePublicKey(rawPublicKey);
  for (const value of ["", "   ", "OPT-1234", "bonjour", "OPT1.trop-court"]) {
    const result = await verifyLicenseKey(value);
    assert.equal(result.ok, false, `« ${value} » ne doit rien ouvrir`);
    assert.equal(result.ok === false ? result.reason : "?", "invalid");
  }
});
