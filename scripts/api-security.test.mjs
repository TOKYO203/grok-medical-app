import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  routeAuth,
  publications,
  publicationDetail,
  upload,
  surveys,
  responses,
  results,
  migration,
  workflow,
] = await Promise.all([
  read("../server/lib/route-auth.ts"),
  read("../server/api/publications.ts"),
  read("../server/api/publications/[slug].ts"),
  read("../server/api/publications/upload.ts"),
  read("../server/api/surveys.ts"),
  read("../server/api/surveys/[id]/responses.ts"),
  read("../server/api/surveys/[id]/results.ts"),
  read("../migrations/0006_user_identity_text.sql"),
  read("../.github/workflows/ci.yml"),
]);

test("editor privileges are fail-closed and configured server-side", () => {
  assert.match(routeAuth, /CONTENT_EDITOR_USER_IDS/);
  assert.match(routeAuth, /if \(!configuredEditors\(\)\.has\(user\.id\)\)/);
  assert.match(routeAuth, /throw new ApiAuthError\(403, "Forbidden"\)/);
});

test("publication mutations never trust a client-supplied creator", () => {
  assert.match(publications, /requireContentEditor\(event\)/);
  assert.match(publications, /editor\.id/);
  assert.doesNotMatch(publications, /body\.created_by|data\.created_by/);
  assert.match(publications, /status = 'published'/);
  assert.match(publications, /visibility = 'public'/);
  assert.match(publicationDetail, /requireContentEditor\(event\)/);
});

test("publication uploads are authenticated, fixed-bucket, typed and size-limited", () => {
  assert.match(upload, /requireContentEditor\(event\)/);
  assert.match(upload, /MAX_UPLOAD_BYTES = 8 \* 1024 \* 1024/);
  assert.match(upload, /signatureMatches/);
  assert.match(upload, /DEFAULT_BUCKET/);
  assert.doesNotMatch(upload, /body\.bucket/);
  assert.doesNotMatch(upload, /detail:\s*text|message:\s*err/);
});

test("survey administration and results require editor authorization", () => {
  assert.match(surveys, /requireContentEditor\(event\)/);
  assert.match(surveys, /editor\.id/);
  assert.doesNotMatch(surveys, /body\.created_by|data\.created_by/);
  assert.match(results, /requireContentEditor\(event\)/);
  assert.doesNotMatch(results, /select[^\n]*respondent_id/i);
  assert.doesNotMatch(results, /select[^\n]*metadata/i);
});

test("survey submissions enforce opening, consent and server-derived identity", () => {
  assert.match(responses, /survey_not_open/);
  assert.match(responses, /consent_required/);
  assert.match(responses, /requireApiUser\(event\)/);
  assert.doesNotMatch(responses, /respondentId\s*\}|body\.respondentId|data\.respondentId/);
  assert.match(responses, /process\.env\.NODE_ENV === "production"/);
  assert.match(responses, /survey_protection_unavailable/);
});

test("application identity columns migrate to Better Auth text ids", () => {
  assert.match(migration, /publications[\s\S]*created_by TYPE text/);
  assert.match(migration, /surveys[\s\S]*created_by TYPE text/);
  assert.match(migration, /survey_responses[\s\S]*respondent_id TYPE text/);
});

test("GitHub CI runs the complete release readiness gate", () => {
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run release:check/);
});
