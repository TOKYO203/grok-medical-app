/**
 * Regression tests for the security fixes applied after the audit.
 *
 * Two layers:
 *   - BEHAVIOURAL: the pure security helpers are imported and exercised for real
 *     (Node 24 strips the types, so the `.ts` modules load directly).
 *   - SOURCE CONTRACT: handlers, server functions and route components cannot be
 *     invoked from a unit test, so their invariants are asserted against the
 *     source text — the convention already used by `api-security.test.mjs`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clientIpFromHeaders,
  clientIpSubject,
} from "../src/lib/security/client-ip.server.ts";
import { rateLimit } from "../src/lib/security/rate-limit.server.ts";
import { adminSecretMatches } from "../src/lib/security/admin-auth.server.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with comments removed. Negative assertions must run against code only —
 * the explanatory comments in these files quote the very anti-patterns the tests
 * forbid, so matching raw source would assert on the documentation.
 */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const [
  adminVerifyRoute,
  adminDecks,
  adminLogin,
  aiStreamRoute,
  aiSchemas,
  serverAi,
  activationAdmin,
  reportsAdmin,
  contentReports,
  setAdminPassword,
  rateLimitSource,
] = [
  "../src/routes/api.admin-verify.ts",
  "../src/routes/admin-decks.tsx",
  "../src/routes/admin-login.tsx",
  "../src/routes/api.ai-stream.ts",
  "../src/lib/ai/schemas.ts",
  "../src/lib/ai/server-ai.server.ts",
  "../src/lib/activation-keys-admin.ts",
  "../src/lib/content-reports-admin.ts",
  "../src/lib/content-reports.ts",
  "../scripts/set-admin-password.mjs",
  "../src/lib/security/rate-limit.server.ts",
].map(read);

/** Run `fn` with a temporary process.env, restoring every touched key. */
function withEnv(values, fn) {
  const saved = new Map();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const headers = (init) => new Headers(init);
const noPlatform = { VERCEL: undefined, NETLIFY: undefined, TRUST_PROXY_HEADERS: undefined };

// ───────────────────────────── client IP trust ─────────────────────────────

test("a forged x-forwarded-for cannot widen a rate-limit budget", () => {
  withEnv(noPlatform, () => {
    const forged = headers({ "x-forwarded-for": "203.0.113.9" });
    assert.equal(clientIpFromHeaders(forged), null);
    assert.equal(clientIpSubject(forged), "shared");
    // Every forged value collapses onto the SAME bucket, so rotating the header
    // buys nothing — that was the whole exploit.
    assert.equal(
      clientIpSubject(headers({ "x-forwarded-for": "198.51.100.2" })),
      "shared",
    );
  });
});

test("platform-owned single-IP headers are believed only under their own marker", () => {
  withEnv({ ...noPlatform, VERCEL: "1" }, () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-vercel-forwarded-for": "198.51.100.7" })),
      "198.51.100.7",
    );
    // A generic chain is still ignored on Vercel, and a multi-hop or malformed
    // value is rejected outright rather than trusted as one client.
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4" })), null);
    assert.equal(
      clientIpFromHeaders(headers({ "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8" })),
      null,
    );
    assert.equal(
      clientIpFromHeaders(headers({ "x-vercel-forwarded-for": "not-an-ip" })),
      null,
    );
  });

  withEnv({ ...noPlatform, NETLIFY: "true" }, () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-nf-client-connection-ip": "198.51.100.8" })),
      "198.51.100.8",
    );
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4" })), null);
  });
});

test("generic forwarding stays an explicit opt-in for a controlled proxy", () => {
  withEnv({ ...noPlatform, TRUST_PROXY_HEADERS: "true" }, () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })),
      "203.0.113.5",
    );
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "junk" })), null);
  });
});

// ───────────────────────────── in-process limiter ──────────────────────────

test("the in-process limiter blocks past its budget within one window", () => {
  const key = "test-budget-" + Math.random();
  assert.equal(rateLimit(key, 3, 60_000).ok, true);
  assert.equal(rateLimit(key, 3, 60_000).ok, true);
  assert.equal(rateLimit(key, 3, 60_000).ok, true);
  assert.equal(rateLimit(key, 3, 60_000).ok, false);
});

test("the bucket map is bounded so forged subjects cannot exhaust memory", () => {
  // 30k distinct subjects is well past the cap; the limiter must evict rather
  // than grow without bound. A regression here is a memory-exhaustion vector.
  assert.match(rateLimitSource, /MAX_BUCKETS\s*=\s*\d+/);
  assert.match(rateLimitSource, /buckets\.delete\(oldest\)/);
  for (let i = 0; i < 30_000; i += 1) rateLimit("bounded-" + i, 5, 60_000);
  assert.ok(process.memoryUsage().heapUsed < 512 * 1024 * 1024);
});

// ─────────────────────────── admin password check ──────────────────────────

test("admin password comparison is correct and fails closed when unset", () => {
  withEnv({ ADMIN_PASSWORD: "correct-horse-battery-staple" }, () => {
    assert.equal(adminSecretMatches("correct-horse-battery-staple"), true);
    assert.equal(adminSecretMatches("correct-horse-battery-stapl"), false);
    assert.equal(adminSecretMatches("x"), false);
    assert.equal(adminSecretMatches(""), false);
  });
  withEnv({ ADMIN_PASSWORD: undefined }, () => {
    assert.equal(adminSecretMatches(""), false);
    assert.equal(adminSecretMatches("anything"), false);
  });
  withEnv({ ADMIN_PASSWORD: "   " }, () => {
    assert.equal(adminSecretMatches("   "), false);
  });
});

test("the admin comparison hashes both sides to remove the length oracle", () => {
  const source = read("../src/lib/security/admin-auth.server.ts");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /timingSafeEqual/);
  // A raw `a === b` / unhashed timingSafeEqual short-circuits on length.
  assert.doesNotMatch(code(source), /candidate === expected/);
});

// ───────────────────────── /api/admin-verify endpoint ──────────────────────

test("admin-verify never echoes anything about the configured secret", () => {
  assert.doesNotMatch(code(adminVerifyRoute), /envLength|envDefined|debug\s*:/);
  assert.doesNotMatch(code(adminVerifyRoute), /source:\s*"(db|env-fallback)"/);
  assert.match(adminVerifyRoute, /JSON\.stringify\(\{ valid \}\)/);
});

test("admin-verify throttles before doing any work", () => {
  assert.match(adminVerifyRoute, /rateLimitRequest\(request, "admin-verify", 10, 5 \* 60_000\)/);
  assert.match(adminVerifyRoute, /status: 429/);
  assert.match(adminVerifyRoute, /Retry-After/);
  assert.match(adminVerifyRoute, /MAX_BODY_BYTES/);
});

// ───────────────────────── admin server functions ──────────────────────────

test("licence administration routes through the shared constant-time guard", () => {
  assert.match(activationAdmin, /requireAdminKey\(adminKey, "admin-licences"/);
  assert.doesNotMatch(code(activationAdmin), /adminKey !== expected/);
  assert.doesNotMatch(code(activationAdmin), /ADMIN_ENV/);
  assert.equal((activationAdmin.match(/await assertAdmin\(data\.adminKey\);/g) ?? []).length, 3);
});

test("report moderation routes through the shared constant-time guard", () => {
  assert.match(reportsAdmin, /requireAdminKey\(adminKey, "admin-reports"/);
  assert.match(reportsAdmin, /enforceAdminAttempt\("admin-verify-key", 10, 5 \* 60_000\)/);
  assert.doesNotMatch(code(reportsAdmin), /adminKey === expected/);
  assert.doesNotMatch(code(reportsAdmin), /isAdmin\(/);
});

// ───────────────────────── admin UI access control ─────────────────────────

test("admin-decks no longer grants access on a vacuously-true condition", () => {
  assert.doesNotMatch(code(adminDecks), /purchases\.length >= 0/);
  assert.doesNotMatch(code(adminDecks), /const isAdmin = userId !== null/);
  // Access must come from a server-verified admin session, and fail closed.
  assert.match(adminDecks, /verifyAdminKey\(\{ data: \{ adminKey \} \}\)/);
  assert.match(adminDecks, /setGate\("denied"\)/);
  assert.match(adminDecks, /gate !== "allowed"/);
});

test("admin login never adopts an unverified stored session", () => {
  assert.doesNotMatch(code(adminLogin), /setAdminKey\(legacy\)/);
  assert.match(adminLogin, /window\.localStorage\.removeItem\(LEGACY_KEY\)/);
  assert.doesNotMatch(code(adminLogin), /console\.log\("\[admin-login\]/);
  assert.match(adminLogin, /data\.valid !== true/);
  assert.match(adminLogin, /res\.status === 429/);
});

// ────────────────────────────── AI proxy ───────────────────────────────────

test("the AI proxy throttles on the trusted IP and cannot be metered away", () => {
  assert.match(aiStreamRoute, /rateLimitRequest\(request, "ai-stream", 20, 60_000\)/);
  assert.match(aiStreamRoute, /retryAfterSeconds\(rl\)/);
  assert.doesNotMatch(code(aiStreamRoute), /getClientIp\(request\)/);
});

test("the provider model is a server decision, not a caller parameter", () => {
  assert.doesNotMatch(code(aiSchemas), /model:\s*z\.string\(\)/);
  assert.doesNotMatch(code(aiStreamRoute), /model: raw\.model/);
  assert.doesNotMatch(code(serverAi), /req\.model/);
  assert.match(serverAi, /Always the server-selected model/);
});

// ─────────────────────── reporter rate-limit identity ──────────────────────

test("report throttling cannot be reset by changing a client-supplied id", () => {
  assert.doesNotMatch(code(contentReports), /resolveReporterIdentifier\(optimusId: string\)/);
  assert.doesNotMatch(code(contentReports), /"user:" \+ optimusId/);
  assert.doesNotMatch(code(contentReports), /h\.get\("x-forwarded-for"\)/);
  assert.match(contentReports, /clientIpSubject\(req\.headers\)/);
});

// ───────────────────────────── TLS validation ──────────────────────────────

test("the admin password is written over a validated TLS connection", () => {
  assert.doesNotMatch(code(setAdminPassword), /rejectUnauthorized:\s*false/);
  assert.match(setAdminPassword, /PSQL_INSECURE_TLS/);
});
