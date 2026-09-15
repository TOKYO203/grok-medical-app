import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headersSource = readFileSync(
  new URL("../server/middleware/security-headers.ts", import.meta.url),
  "utf8",
);

test("baseline Nitro security headers avoid high-risk MIME/referrer/browser capabilities", () => {
  assert.match(headersSource, /x-content-type-options["']:\s*["']nosniff/);
  assert.match(headersSource, /referrer-policy["']:\s*["']strict-origin-when-cross-origin/);
  assert.match(headersSource, /permissions-policy["']:\s*["']camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(headersSource, /x-permitted-cross-domain-policies["']:\s*["']none/);
});

test("HSTS is emitted only for HTTPS and does not claim subdomains prematurely", () => {
  assert.match(headersSource, /event\.url\.protocol === "https:"/);
  assert.match(headersSource, /max-age=31536000/);
  assert.doesNotMatch(headersSource, /includeSubDomains/i);
});

test("framing and strict CSP remain explicit deployment decisions rather than accidental breakage", () => {
  assert.doesNotMatch(headersSource, /headers\.set\(["']x-frame-options/i);
  assert.doesNotMatch(headersSource, /headers\.set\(["']content-security-policy/i);
  assert.match(headersSource, /framing policy needs a deployment-specific/);
});
