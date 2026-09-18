#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SignJWT, exportJWK } from "jose";

// Production-only protections must also be exercised by the built-server smoke.
process.env.VITE_AUTH_ENABLED ??= "true";
process.env.RATE_LIMIT_SALT ??= "ci-smoke-rate-limit-salt-not-for-production";
process.env.RESPONSE_SALT ??= "ci-smoke-response-salt-not-for-production";

const isNetlify = process.env.NETLIFY === "true";
const entry = resolve(
  isNetlify
    ? ".netlify/functions-internal/server/main.mjs"
    : ".vercel/output/functions/__server.func/index.mjs",
);
const builtApp = await import(pathToFileURL(entry).href);
const fetchBuiltApp = isNetlify ? builtApp.default : builtApp.default?.fetch;

assert.equal(typeof fetchBuiltApp, "function", "Nitro fetch handler is missing");

const routes = [
  "/",
  "/login",
  "/parcours",
  "/parcours/neuro",
  "/learn/neuro?lesson=0&preview=true&mode=preview",
  "/revue?mode=today",
  "/cas",
  "/cas/NEURO-AVC-001",
  "/demarche/DX-THORAX-001",
  "/examen",
  "/calculateurs",
  "/classement",
  "/import",
  "/pro",
  "/achats",
  "/profil",
  "/contact",
  "/soutenir",
  "/a-propos",
];

for (const pathname of routes) {
  const response = await fetchBuiltApp(new Request(`http://localhost${pathname}`));
  const body = await response.text();

  assert.equal(response.status, 200, `${pathname} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
  assert.match(body, /Optimus/);
}

// Real HTTP security checks against the built Nitro handler.
const unauthorizedPublication = await fetchBuiltApp(
  new Request("http://localhost/api/publications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Unauthorized publication" }),
  }),
);
assert.equal(
  unauthorizedPublication.status,
  401,
  `anonymous publication mutation should return 401, got ${unauthorizedPublication.status}`,
);

const unauthorizedPublicationPatch = await fetchBuiltApp(
  new Request("http://localhost/api/publications/missing-publication", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Unauthorized update" }),
  }),
);
assert.equal(
  unauthorizedPublicationPatch.status,
  401,
  `anonymous publication update should return 401, got ${unauthorizedPublicationPatch.status}`,
);

const unauthorizedUpload = await fetchBuiltApp(
  new Request("http://localhost/api/publications/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }),
);
assert.equal(
  unauthorizedUpload.status,
  401,
  `anonymous publication upload should return 401, got ${unauthorizedUpload.status}`,
);

function cookieHeaderFrom(response) {
  assert.equal(
    typeof response.headers.getSetCookie,
    "function",
    "Node runtime must expose Headers.getSetCookie() for auth smoke coverage",
  );
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.length > 0, "auth bootstrap should emit at least one Set-Cookie header");
  return setCookies
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function editorialSecurityChecks() {
  const projectId = "ci-smoke-project";
  const kid = "ci-smoke-gate-key";
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = {
    ...(await exportJWK(publicKey)),
    alg: "EdDSA",
    use: "sig",
    kid,
  };
  const jwksServer = createServer((request, response) => {
    if (request.url === "/__gate/identity-key") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  await new Promise((resolvePromise, rejectPromise) => {
    jwksServer.once("error", rejectPromise);
    jwksServer.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = jwksServer.address();
  assert.ok(address && typeof address === "object", "temporary JWKS server did not bind");
  const issuer = `http://127.0.0.1:${address.port}`;

  const previousProjectId = process.env.GROK_PROJECT_ID;
  const previousGateOrigin = process.env.GROK_GATE_ORIGIN;
  const previousEditors = process.env.CONTENT_EDITOR_USER_IDS;
  process.env.GROK_PROJECT_ID = projectId;
  process.env.GROK_GATE_ORIGIN = issuer;
  delete process.env.CONTENT_EDITOR_USER_IDS;

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email: "ci-viewer@example.invalid",
      name: "CI Viewer",
      jti: "ci-smoke-editorial-security",
    })
      .setProtectedHeader({ alg: "EdDSA", kid })
      .setSubject("ci-smoke-viewer")
      .setIssuer(issuer)
      .setAudience(`app:${projectId}`)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);

    // A server-side auth guard must never mint a browser session as a side effect.
    // Gate bootstrap belongs to the actual Better Auth HTTP endpoint.
    const headerOnly = await fetchBuiltApp(
      new Request("http://localhost/api/publications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-grok-identity": token,
        },
        body: JSON.stringify({ title: "Header only must stay unauthorized" }),
      }),
    );
    assert.equal(
      headerOnly.status,
      401,
      `Gate header without a Better Auth session should return 401, got ${headerOnly.status}`,
    );

    const bootstrap = await fetchBuiltApp(
      new Request("http://localhost/api/auth/get-session", {
        headers: { "x-grok-identity": token },
      }),
    );
    assert.equal(
      bootstrap.status,
      200,
      `Gate session bootstrap should return 200, got ${bootstrap.status}`,
    );
    const bootstrapBody = await bootstrap.json();
    assert.equal(
      bootstrapBody?.user?.email,
      "ci-viewer@example.invalid",
      "Gate session bootstrap should resolve the authenticated viewer",
    );
    assert.equal(typeof bootstrapBody?.user?.id, "string", "Gate user must expose a server identity");
    const userId = bootstrapBody.user.id;
    const cookie = cookieHeaderFrom(bootstrap);
    const authenticatedHeaders = {
      "content-type": "application/json",
      cookie,
      "x-grok-identity": token,
    };

    const forbiddenCreate = await fetchBuiltApp(
      new Request("http://localhost/api/publications", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({ title: "Authenticated but forbidden publication" }),
      }),
    );
    assert.equal(
      forbiddenCreate.status,
      403,
      `authenticated non-editor publication mutation should return 403, got ${forbiddenCreate.status}`,
    );

    const forbiddenPatch = await fetchBuiltApp(
      new Request("http://localhost/api/publications/missing-publication", {
        method: "PATCH",
        headers: authenticatedHeaders,
        body: JSON.stringify({ title: "Authenticated but forbidden update" }),
      }),
    );
    assert.equal(
      forbiddenPatch.status,
      403,
      `authenticated non-editor publication update should return 403, got ${forbiddenPatch.status}`,
    );

    const forbiddenUpload = await fetchBuiltApp(
      new Request("http://localhost/api/publications/upload", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({}),
      }),
    );
    assert.equal(
      forbiddenUpload.status,
      403,
      `authenticated non-editor upload should return 403, got ${forbiddenUpload.status}`,
    );

    // Promote only this server-verified user to editor. Client-provided identity fields
    // remain forbidden and can never influence created_by.
    process.env.CONTENT_EDITOR_USER_IDS = userId;

    const injectedIdentity = await fetchBuiltApp(
      new Request("http://localhost/api/publications", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          title: "Identity injection must fail",
          created_by: "client-controlled-identity",
        }),
      }),
    );
    assert.equal(
      injectedIdentity.status,
      400,
      `client-supplied created_by should be rejected, got ${injectedIdentity.status}`,
    );

    const created = await fetchBuiltApp(
      new Request("http://localhost/api/publications", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({ title: "CI editorial ownership proof", status: "draft" }),
      }),
    );
    assert.equal(created.status, 201, `editor publication should return 201, got ${created.status}`);
    const createdBody = await created.json();
    assert.equal(
      createdBody?.created_by,
      userId,
      "publication created_by must come from the verified Better Auth session",
    );
    assert.equal(typeof createdBody?.slug, "string", "created publication should expose a slug");

    const updated = await fetchBuiltApp(
      new Request(`http://localhost/api/publications/${encodeURIComponent(createdBody.slug)}`, {
        method: "PATCH",
        headers: authenticatedHeaders,
        body: JSON.stringify({ summary: "Updated by verified editor" }),
      }),
    );
    assert.equal(updated.status, 200, `editor publication update should return 200, got ${updated.status}`);

    const bucketInjection = await fetchBuiltApp(
      new Request("http://localhost/api/publications/upload", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          filename: "proof.pdf",
          contentType: "application/pdf",
          contentBase64: Buffer.from("%PDF-1.7\n").toString("base64"),
          bucket: "client-controlled-bucket",
        }),
      }),
    );
    assert.equal(
      bucketInjection.status,
      400,
      `client-supplied upload bucket should be rejected, got ${bucketInjection.status}`,
    );

    const executableUpload = await fetchBuiltApp(
      new Request("http://localhost/api/publications/upload", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          filename: "payload.exe",
          contentType: "application/x-msdownload",
          contentBase64: "AA==",
        }),
      }),
    );
    assert.equal(
      executableUpload.status,
      400,
      `forbidden executable MIME should be rejected, got ${executableUpload.status}`,
    );

    const extensionMismatch = await fetchBuiltApp(
      new Request("http://localhost/api/publications/upload", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          filename: "payload.exe",
          contentType: "image/png",
          contentBase64: "AA==",
        }),
      }),
    );
    assert.equal(
      extensionMismatch.status,
      415,
      `forbidden upload extension should return 415, got ${extensionMismatch.status}`,
    );

    const maxUploadBytes = 8 * 1024 * 1024;
    const oversizedBase64 = "A".repeat(Math.ceil((maxUploadBytes * 4) / 3) + 9);
    const oversizedUpload = await fetchBuiltApp(
      new Request("http://localhost/api/publications/upload", {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          filename: "oversized.pdf",
          contentType: "application/pdf",
          contentBase64: oversizedBase64,
        }),
      }),
    );
    assert.equal(
      oversizedUpload.status,
      413,
      `upload above 8 MiB should return 413, got ${oversizedUpload.status}`,
    );
  } finally {
    if (previousProjectId === undefined) delete process.env.GROK_PROJECT_ID;
    else process.env.GROK_PROJECT_ID = previousProjectId;
    if (previousGateOrigin === undefined) delete process.env.GROK_GATE_ORIGIN;
    else process.env.GROK_GATE_ORIGIN = previousGateOrigin;
    if (previousEditors === undefined) delete process.env.CONTENT_EDITOR_USER_IDS;
    else process.env.CONTENT_EDITOR_USER_IDS = previousEditors;
    await new Promise((resolvePromise) => jwksServer.close(resolvePromise));
  }
}

await editorialSecurityChecks();

const oversizedSurvey = await fetchBuiltApp(
  new Request("http://localhost/api/surveys/11111111-1111-4111-8111-111111111111/responses", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "optimus-ci-smoke" },
    body: JSON.stringify({
      consent: true,
      answers: [
        {
          questionId: "22222222-2222-4222-8222-222222222222",
          value: "x".repeat(70 * 1024),
        },
      ],
    }),
  }),
);
assert.equal(
  oversizedSurvey.status,
  413,
  `oversized survey payload should return 413, got ${oversizedSurvey.status}`,
);

const activationBody = JSON.stringify({
  key: "OPT-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA",
  optimusId: "OM-1234ABCD",
  deviceId: "abcdef123456",
});
let activationStatus = 0;
let retryAfter = null;
for (let attempt = 0; attempt < 9; attempt += 1) {
  const response = await fetchBuiltApp(
    new Request("http://localhost/api/licenses/activate", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "optimus-ci-smoke" },
      body: activationBody,
    }),
  );
  activationStatus = response.status;
  retryAfter = response.headers.get("retry-after");
}
assert.equal(activationStatus, 429, `ninth activation attempt should be rate-limited, got ${activationStatus}`);
assert.ok(Number(retryAfter) >= 1, "rate-limited response should include Retry-After");

const modelBody = await readFile(
  resolve(isNetlify ? "dist/decks/cardio-ic-v2.json" : ".vercel/output/static/decks/cardio-ic-v2.json"),
  "utf8",
);
assert.doesNotThrow(() => JSON.parse(modelBody));

console.log(
  `[smoke] built server: ${routes.length} UI routes + editorial auth/ownership/upload 401/403/413/415 + survey 413 + activation 429 + Deck model passed`,
);
