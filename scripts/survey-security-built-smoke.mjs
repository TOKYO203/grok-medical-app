#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SignJWT, exportJWK } from "jose";

process.env.NODE_ENV = "production";
process.env.VITE_AUTH_ENABLED ??= "true";
process.env.RATE_LIMIT_SALT ??= "ci-survey-rate-limit-salt-not-for-production";
process.env.RESPONSE_SALT ??= "ci-survey-response-salt-not-for-production";

const isNetlify = process.env.NETLIFY === "true";
const entry = resolve(
  isNetlify
    ? ".netlify/functions-internal/server/main.mjs"
    : ".vercel/output/functions/__server.func/index.mjs",
);
const builtApp = await import(pathToFileURL(entry).href);
const fetchBuiltApp = isNetlify ? builtApp.default : builtApp.default?.fetch;
assert.equal(typeof fetchBuiltApp, "function", "Nitro fetch handler is missing");

function cookieHeaderFrom(response) {
  assert.equal(
    typeof response.headers.getSetCookie,
    "function",
    "Node runtime must expose Headers.getSetCookie() for auth survey coverage",
  );
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.length > 0, "auth bootstrap should emit at least one Set-Cookie header");
  return setCookies
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function json(response) {
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function createSurvey(headers, input) {
  const response = await fetchBuiltApp(
    new Request("http://localhost/api/surveys", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    }),
  );
  assert.equal(response.status, 201, `editor survey creation should return 201, got ${response.status}`);
  const body = await json(response);
  assert.equal(typeof body?.id, "string", "created survey should expose an id");
  return body;
}

async function getSurveyResults(surveyId, headers, expectedStatus = 200) {
  const response = await fetchBuiltApp(
    new Request(`http://localhost/api/surveys/${encodeURIComponent(surveyId)}/results`, {
      headers,
    }),
  );
  assert.equal(
    response.status,
    expectedStatus,
    `survey results should return ${expectedStatus}, got ${response.status}`,
  );
  return { response, body: await json(response) };
}

async function submitSurvey(surveyId, payload, headers = { "content-type": "application/json" }) {
  return fetchBuiltApp(
    new Request(`http://localhost/api/surveys/${encodeURIComponent(surveyId)}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  );
}

const projectId = "ci-survey-project";
const kid = "ci-survey-gate-key";
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
const originalResponseSalt = process.env.RESPONSE_SALT;

process.env.GROK_PROJECT_ID = projectId;
process.env.GROK_GATE_ORIGIN = issuer;
delete process.env.CONTENT_EDITOR_USER_IDS;

try {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    email: "ci-survey-viewer@example.invalid",
    name: "CI Survey Viewer",
    jti: "ci-survey-security",
  })
    .setProtectedHeader({ alg: "EdDSA", kid })
    .setSubject("ci-survey-viewer")
    .setIssuer(issuer)
    .setAudience(`app:${projectId}`)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);

  const anonymousResults = await fetchBuiltApp(
    new Request("http://localhost/api/surveys/11111111-1111-4111-8111-111111111111/results"),
  );
  assert.equal(anonymousResults.status, 401, "anonymous survey results access must return 401");

  const bootstrap = await fetchBuiltApp(
    new Request("http://localhost/api/auth/get-session", {
      headers: { "x-grok-identity": token },
    }),
  );
  assert.equal(bootstrap.status, 200, `Gate session bootstrap should return 200, got ${bootstrap.status}`);
  const bootstrapBody = await json(bootstrap);
  assert.equal(typeof bootstrapBody?.user?.id, "string", "Gate user must expose a server identity");
  const userId = bootstrapBody.user.id;
  const cookie = cookieHeaderFrom(bootstrap);
  const authenticatedHeaders = {
    "content-type": "application/json",
    cookie,
    "x-grok-identity": token,
  };

  const forbiddenResults = await fetchBuiltApp(
    new Request("http://localhost/api/surveys/11111111-1111-4111-8111-111111111111/results", {
      headers: authenticatedHeaders,
    }),
  );
  assert.equal(forbiddenResults.status, 403, "authenticated non-editor survey results access must return 403");

  const forbiddenCreate = await fetchBuiltApp(
    new Request("http://localhost/api/surveys", {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ title: "Forbidden survey" }),
    }),
  );
  assert.equal(forbiddenCreate.status, 403, "authenticated non-editor survey creation must return 403");

  process.env.CONTENT_EDITOR_USER_IDS = userId;

  const pastOpen = new Date(Date.now() - 120_000).toISOString();
  const futureClose = new Date(Date.now() + 600_000).toISOString();
  const pastClose = new Date(Date.now() - 60_000).toISOString();

  const unpublished = await createSurvey(authenticatedHeaders, {
    title: "CI unpublished survey",
    published: false,
    anonymized: true,
    questions: [{ type: "text", prompt: "Hidden feedback", required: true }],
  });
  const unpublishedResults = await getSurveyResults(unpublished.id, authenticatedHeaders);
  const unpublishedQuestionId = unpublishedResults.body?.questions?.[0]?.id;
  assert.equal(typeof unpublishedQuestionId, "string", "unpublished survey question id is missing");
  const unpublishedSubmission = await submitSurvey(unpublished.id, {
    answers: [{ questionId: unpublishedQuestionId, value: "must not be accepted" }],
  });
  assert.equal(unpublishedSubmission.status, 409, "unpublished survey must reject submissions");

  const closed = await createSurvey(authenticatedHeaders, {
    title: "CI closed survey",
    published: true,
    anonymized: true,
    open_at: new Date(Date.now() - 300_000).toISOString(),
    close_at: pastClose,
    questions: [{ type: "text", prompt: "Closed feedback", required: true }],
  });
  const closedResults = await getSurveyResults(closed.id, authenticatedHeaders);
  const closedQuestionId = closedResults.body?.questions?.[0]?.id;
  assert.equal(typeof closedQuestionId, "string", "closed survey question id is missing");
  const closedSubmission = await submitSurvey(closed.id, {
    answers: [{ questionId: closedQuestionId, value: "must not be accepted" }],
  });
  assert.equal(closedSubmission.status, 409, "closed survey must reject submissions");

  const privateSurvey = await createSurvey(authenticatedHeaders, {
    title: "CI private survey identity proof",
    published: true,
    anonymized: false,
    consent_text: "I consent to this CI survey.",
    open_at: pastOpen,
    close_at: futureClose,
    questions: [{ type: "text", prompt: "Private feedback", required: true }],
  });
  const privateResultsBefore = await getSurveyResults(privateSurvey.id, authenticatedHeaders);
  assert.equal(privateResultsBefore.response.headers.get("cache-control"), "no-store");
  const privateQuestionId = privateResultsBefore.body?.questions?.[0]?.id;
  assert.equal(typeof privateQuestionId, "string", "private survey question id is missing");

  const injectedIdentity = await submitSurvey(
    privateSurvey.id,
    {
      consent: true,
      respondentId: "client-controlled-id",
      respondent_id: "client-controlled-id",
      answers: [{ questionId: privateQuestionId, value: "identity injection" }],
    },
    authenticatedHeaders,
  );
  assert.equal(injectedIdentity.status, 400, "client respondent identity fields must be rejected");

  const missingConsent = await submitSurvey(
    privateSurvey.id,
    {
      answers: [{ questionId: privateQuestionId, value: "no consent" }],
    },
    authenticatedHeaders,
  );
  assert.equal(missingConsent.status, 400, "survey requiring consent must reject missing consent");

  const anonymousPrivateSubmission = await submitSurvey(privateSurvey.id, {
    consent: true,
    answers: [{ questionId: privateQuestionId, value: "anonymous identity attempt" }],
  });
  assert.equal(anonymousPrivateSubmission.status, 401, "non-anonymous survey must require authentication");

  const accepted = await submitSurvey(
    privateSurvey.id,
    {
      consent: true,
      answers: [{ questionId: privateQuestionId, value: "private verbatim visible only to editors" }],
    },
    authenticatedHeaders,
  );
  assert.equal(accepted.status, 201, `authenticated survey submission should return 201, got ${accepted.status}`);

  const duplicate = await submitSurvey(
    privateSurvey.id,
    {
      consent: true,
      answers: [{ questionId: privateQuestionId, value: "duplicate" }],
    },
    authenticatedHeaders,
  );
  assert.equal(duplicate.status, 409, "same authenticated respondent must not submit twice");

  const privateResultsAfter = await getSurveyResults(privateSurvey.id, authenticatedHeaders);
  assert.equal(privateResultsAfter.body?.responseCount, 1, "editor result aggregate should count one response");
  const serializedPrivateResults = JSON.stringify(privateResultsAfter.body);
  assert.doesNotMatch(serializedPrivateResults, /respondent_id|metadata|client-controlled-id/);
  assert.doesNotMatch(serializedPrivateResults, new RegExp(userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const publicAttemptAfterSubmission = await fetchBuiltApp(
    new Request(`http://localhost/api/surveys/${encodeURIComponent(privateSurvey.id)}/results`),
  );
  assert.equal(publicAttemptAfterSubmission.status, 401, "survey aggregates must never become public after responses exist");

  const visibleSurveysResponse = await fetchBuiltApp(new Request("http://localhost/api/surveys"));
  assert.equal(visibleSurveysResponse.status, 200);
  const visibleSurveys = await json(visibleSurveysResponse);
  assert.ok(Array.isArray(visibleSurveys), "public survey listing should be an array");
  assert.ok(visibleSurveys.some((survey) => survey.id === privateSurvey.id), "open published survey should be listed");
  assert.ok(!visibleSurveys.some((survey) => survey.id === unpublished.id), "unpublished survey must stay hidden");
  assert.ok(!visibleSurveys.some((survey) => survey.id === closed.id), "closed survey must stay hidden");

  const saltSurvey = await createSurvey(authenticatedHeaders, {
    title: "CI production salt proof",
    published: true,
    anonymized: true,
    open_at: pastOpen,
    close_at: futureClose,
    questions: [{ type: "text", prompt: "Salt proof", required: true }],
  });
  const saltResults = await getSurveyResults(saltSurvey.id, authenticatedHeaders);
  const saltQuestionId = saltResults.body?.questions?.[0]?.id;
  assert.equal(typeof saltQuestionId, "string", "salt survey question id is missing");

  delete process.env.RESPONSE_SALT;
  const unprotectedProductionSubmission = await submitSurvey(saltSurvey.id, {
    answers: [{ questionId: saltQuestionId, value: "must fail closed" }],
  });
  assert.equal(
    unprotectedProductionSubmission.status,
    503,
    "production survey submission without RESPONSE_SALT must fail closed",
  );
  process.env.RESPONSE_SALT = originalResponseSalt;

  console.log(
    "[survey-security] built HTTP API: 401/403 + open/published + consent + server identity + private results + production salt passed",
  );
} finally {
  if (originalResponseSalt === undefined) delete process.env.RESPONSE_SALT;
  else process.env.RESPONSE_SALT = originalResponseSalt;
  if (previousProjectId === undefined) delete process.env.GROK_PROJECT_ID;
  else process.env.GROK_PROJECT_ID = previousProjectId;
  if (previousGateOrigin === undefined) delete process.env.GROK_GATE_ORIGIN;
  else process.env.GROK_GATE_ORIGIN = previousGateOrigin;
  if (previousEditors === undefined) delete process.env.CONTENT_EDITOR_USER_IDS;
  else process.env.CONTENT_EDITOR_USER_IDS = previousEditors;
  await new Promise((resolvePromise) => jwksServer.close(resolvePromise));
}
