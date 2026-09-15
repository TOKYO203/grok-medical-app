import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [runtimeStatus, loginPage, authServer] = await Promise.all([
  read("../src/lib/auth/runtime-status.ts"),
  read("../src/routes/login.tsx"),
  read("../src/lib/auth/server.ts"),
]);

test("auth readiness only enables broker sign-in with credentials plus a public origin or sandbox preview", () => {
  assert.match(runtimeStatus, /GROK_AUTH_CLIENT_ID/);
  assert.match(runtimeStatus, /GROK_AUTH_CLIENT_SECRET/);
  assert.match(runtimeStatus, /\.grok-sandbox\.com/);
  assert.match(runtimeStatus, /BETTER_AUTH_URL/);
  assert.match(runtimeStatus, /VERCEL_BRANCH_URL/);
  assert.match(runtimeStatus, /VERCEL_URL/);
  assert.match(runtimeStatus, /missing-public-origin/);
  assert.match(runtimeStatus, /missing-deployment-config/);
  assert.match(runtimeStatus, /providers:\s*\[\]/);
});

test("Vercel deployments derive a HTTPS Better Auth origin only when a deployed broker client exists", () => {
  assert.match(authServer, /deployedBrokerClientConfigured/);
  assert.match(authServer, /VERCEL_BRANCH_URL/);
  assert.match(authServer, /VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(authServer, /vercelAutoBaseURL/);
  assert.match(authServer, /BETTER_AUTH_URL.*vercelAutoBaseURL/s);
  assert.match(authServer, /platformTrustedOrigins/);
});

test("public auth readiness never returns OAuth credentials", () => {
  assert.doesNotMatch(runtimeStatus, /clientId:\s*env|clientSecret:\s*env/);
  assert.doesNotMatch(runtimeStatus, /PREVIEW_CLIENT_SECRET|PREVIEW_CLIENT_ID/);
});

test("login UI gates providers on server readiness and keeps a local fallback", () => {
  assert.match(loginPage, /getAuthRuntimeStatus/);
  assert.match(loginPage, /ready \?/);
  assert.match(loginPage, /Connexion cloud indisponible ici/);
  assert.match(loginPage, /Continuer sans compte/);
  assert.match(loginPage, /pb-32/);
  assert.doesNotMatch(loginPage, /Better Auth vérifié/);
  assert.doesNotMatch(loginPage, />Sign-in failed</);
});
