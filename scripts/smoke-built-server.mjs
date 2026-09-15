#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  `[smoke] built server: ${routes.length} UI routes + HTTP security 401/413/429 + Deck model passed`,
);
