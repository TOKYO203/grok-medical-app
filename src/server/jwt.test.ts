import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_TOKEN_TTL_SECONDS,
  contentJwtSecret,
  signContentToken,
  verifyContentToken,
} from "./jwt.ts";

/**
 * Le JWT de contenu est le SEUL justificatif accepté par `/content/**`.
 * Ces tests couvrent les quatre façons de le rendre inopérant : secret absent,
 * secret trop court, jeton expiré, jeton altéré.
 */

const SECRET = "s3cret-de-test-suffisamment-long-pour-hmac-256";
const OTHER_SECRET = "autre-secret-de-test-lui-aussi-assez-long-0000";

function useSecret(value: string | undefined) {
  if (value === undefined) delete process.env.LICENSE_JWT_SECRET;
  else process.env.LICENSE_JWT_SECRET = value;
}

test("sans secret configuré, rien n'est signé ni vérifié (fail closed)", async () => {
  useSecret(undefined);
  assert.equal(contentJwtSecret(), null);
  assert.equal(await signContentToken("lic-1"), null);
  assert.equal(await verifyContentToken("a.b.c"), null);
});

test("un secret de moins de 32 caractères est refusé", async () => {
  useSecret("trop-court");
  assert.equal(contentJwtSecret(), null);
  assert.equal(await signContentToken("lic-1"), null);
});

test("signe et vérifie un jeton de contenu valide", async () => {
  useSecret(SECRET);
  const signed = await signContentToken("lic-42");
  assert.ok(signed, "le jeton doit être produit");
  assert.equal(signed.expiresAt, Date.now() + CONTENT_TOKEN_TTL_SECONDS * 1000 - (Date.now() % 1000));

  const claims = await verifyContentToken(signed.token);
  assert.ok(claims);
  assert.equal(claims.licenseId, "lic-42");
  assert.equal(claims.tier, "premium");
  assert.ok(claims.expiresAt > Date.now());
});

test("rejette un jeton expiré", async () => {
  useSecret(SECRET);
  const past = Date.now() - (CONTENT_TOKEN_TTL_SECONDS + 60) * 1000;
  const signed = await signContentToken("lic-expired", past);
  assert.ok(signed);
  assert.equal(await verifyContentToken(signed.token), null);
});

test("rejette un jeton signé avec un autre secret", async () => {
  useSecret(SECRET);
  const signed = await signContentToken("lic-1");
  assert.ok(signed);

  useSecret(OTHER_SECRET);
  assert.equal(await verifyContentToken(signed.token), null);
});

test("rejette une charge altérée (signature conservée)", async () => {
  useSecret(SECRET);
  const signed = await signContentToken("lic-1");
  assert.ok(signed);

  const [header, , signature] = signed.token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({
      tier: "premium",
      licenseId: "lic-volee",
      iss: "optimus-medical",
      aud: "optimus-content",
    }),
    "utf8",
  ).toString("base64url");

  assert.equal(await verifyContentToken(`${header}.${forgedPayload}.${signature}`), null);
});

test("rejette un jeton non signé (alg: none)", async () => {
  useSecret(SECRET);
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      tier: "premium",
      licenseId: "lic-1",
      iss: "optimus-medical",
      aud: "optimus-content",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");

  assert.equal(await verifyContentToken(`${header}.${payload}.`), null);
});

test("rejette un jeton dont la charge n'est pas premium", async () => {
  useSecret(SECRET);
  // Signé correctement, mais `tier` n'ouvre pas le contenu.
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({ tier: "free", licenseId: "lic-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("lic-1")
    .setIssuer("optimus-medical")
    .setAudience("optimus-content")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));

  assert.equal(await verifyContentToken(token), null);
});
