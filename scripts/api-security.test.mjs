import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  routeAuth,
  clientIp,
  rateLimit,
  publications,
  publicationDetail,
  upload,
  surveys,
  responses,
  results,
  activation,
  migrationIdentity,
  migrationRateLimit,
  workflow,
] = await Promise.all([
  read("../server/lib/route-auth.ts"),
  read("../server/lib/client-ip.ts"),
  read("../server/lib/rate-limit.ts"),
  read("../server/api/publications.ts"),
  read("../server/api/publications/[slug].ts"),
  read("../server/api/publications/upload.ts"),
  read("../server/api/surveys.ts"),
  read("../server/api/surveys/[id]/responses.ts"),
  read("../server/api/surveys/[id]/results.ts"),
  read("../server/api/licenses/activate.ts"),
  read("../migrations/0006_user_identity_text.sql"),
  read("../migrations/0007_api_rate_limits.sql"),
  read("../.github/workflows/ci.yml"),
]);

test("editor privileges are fail-closed and configured server-side", () => {
  assert.match(routeAuth, /CONTENT_EDITOR_USER_IDS/);
  assert.match(routeAuth, /if \(!configuredEditors\(\)\.has\(user\.id\)\)/);
  assert.match(routeAuth, /throw new ApiAuthError\(403, "Forbidden"\)/);
});

test("client IP resolution trusts platform-owned headers and keeps generic forwarding opt-in", () => {
  assert.match(clientIp, /process\.env\.VERCEL === "1"/);
  assert.match(clientIp, /x-vercel-forwarded-for/);
  assert.match(clientIp, /process\.env\.NETLIFY === "true"/);
  assert.match(clientIp, /x-nf-client-connection-ip/);
  assert.match(clientIp, /TRUST_PROXY_HEADERS === "true"/);
  assert.match(clientIp, /getRequestIP\(event, \{ xForwardedFor: trustForwarded \}\)/);
  assert.match(clientIp, /value\.includes\(","\)/);
  assert.match(clientIp, /isIP\(value\) === 0/);
});

test("persistent rate limiter pseudonymizes subjects and fails closed without a production salt", () => {
  assert.match(rateLimit, /RATE_LIMIT_SALT/);
  assert.match(rateLimit, /NODE_ENV === "production"/);
  assert.match(rateLimit, /createHash\("sha256"\)/);
  assert.match(rateLimit, /on conflict \(bucket_key, window_start\)/);
  assert.match(rateLimit, /Retry-After/);
  assert.match(migrationRateLimit, /CREATE TABLE IF NOT EXISTS api_rate_limits/i);
  assert.doesNotMatch(migrationRateLimit, /ip_address|user_id/i);
});

test("publication mutations never trust a client-supplied creator and are throttled", () => {
  assert.match(publications, /requireContentEditor\(event\)/);
  assert.match(publications, /editor\.id/);
  assert.match(publications, /scope: "publication-create"/);
  assert.doesNotMatch(publications, /body\.created_by|data\.created_by/);
  assert.match(publications, /status = 'published'/);
  assert.match(publications, /visibility = 'public'/);
  assert.match(publicationDetail, /requireContentEditor\(event\)/);
  assert.match(publicationDetail, /scope: "publication-update"/);
});

test("publication uploads are authenticated, throttled, fixed-bucket, typed and size-limited", () => {
  assert.match(upload, /requireContentEditor\(event\)/);
  assert.match(upload, /scope: "publication-upload"/);
  assert.match(upload, /MAX_UPLOAD_BYTES = 8 \* 1024 \* 1024/);
  assert.match(upload, /signatureMatches/);
  assert.match(upload, /DEFAULT_BUCKET/);
  assert.doesNotMatch(upload, /body\.bucket/);
  assert.doesNotMatch(upload, /detail:\s*text|message:\s*err/);
});

test("survey administration and results require editor authorization", () => {
  assert.match(surveys, /requireContentEditor\(event\)/);
  assert.match(surveys, /editor\.id/);
  assert.match(surveys, /scope: "survey-create"/);
  assert.doesNotMatch(surveys, /body\.created_by|data\.created_by/);
  assert.match(results, /requireContentEditor\(event\)/);
  assert.doesNotMatch(results, /select[^\n]*respondent_id/i);
  assert.doesNotMatch(results, /select[^\n]*metadata/i);
});

test("survey submissions enforce opening, consent, throttling and server-derived identity", () => {
  assert.match(responses, /survey_not_open/);
  assert.match(responses, /consent_required/);
  assert.match(responses, /requireApiUser\(event\)/);
  assert.match(responses, /scope: `survey-submit:\$\{surveyId\}`/);
  assert.doesNotMatch(responses, /respondentId\s*\}|body\.respondentId|data\.respondentId/);
  assert.match(responses, /process\.env\.NODE_ENV === "production"/);
  assert.match(responses, /survey_protection_unavailable/);
});

test("license activation is throttled before expensive lookup/signing", () => {
  const rateLimitAt = activation.indexOf('scope: "license-activate"');
  const signingKeyAt = activation.indexOf("LICENSE_SIGNING_PRIVATE_KEY");
  assert.ok(rateLimitAt >= 0);
  assert.ok(signingKeyAt > rateLimitAt);
  assert.match(activation, /setResponseStatus\(event, 429\)/);
});

test("application identity columns migrate to Better Auth text ids", () => {
  assert.match(migrationIdentity, /publications[\s\S]*created_by TYPE text/);
  assert.match(migrationIdentity, /surveys[\s\S]*created_by TYPE text/);
  assert.match(migrationIdentity, /survey_responses[\s\S]*respondent_id TYPE text/);
});

test("GitHub CI runs the complete release readiness gate", () => {
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run release:check/);
});
