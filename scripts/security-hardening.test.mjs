import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headersSource = readFileSync(
  new URL("../server/middleware/security-headers.ts", import.meta.url),
  "utf8",
);

const cdnHeaders = readFileSync(
  new URL("../public/_headers", import.meta.url),
  "utf8",
);

/**
 * Politique CSP de référence — pentest 2026-11-09 §3 (docs/PENTEST-2026-11-09.md).
 * Le middleware Nitro et le bloc /* de public/_headers doivent poser la
 * MÊME politique : un écart créerait deux comportements selon que la réponse
 * vient du CDN (statique) ou du worker (dynamique). Ce test verrouille le
 * miroir directive par directive.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lemonsqueezy.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

test("baseline Nitro security headers avoid high-risk MIME/referrer/browser capabilities", () => {
  assert.match(headersSource, /x-content-type-options["']:\s*["']nosniff/);
  assert.match(headersSource, /referrer-policy["']:\s*["']strict-origin-when-cross-origin/);
  assert.match(headersSource, /permissions-policy["']:\s*["']camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(headersSource, /x-permitted-cross-domain-policies["']:\s*["']none/);
});

test("HSTS : HTTPS uniquement, 1 an, sous-domaines inclus (pentest §3)", () => {
  assert.match(headersSource, /event\.url\.protocol === "https:"/);
  assert.match(headersSource, /max-age=31536000; includeSubDomains/);
});

test("framing et CSP : décision de déploiement explicite, désormais posée (pentest §3)", () => {
  // Avant : le middleware s'interdisait XFO/CSP (« explicit deployment
  // decisions »). La décision est prise et documentée : DENY + frame-ancestors.
  assert.match(headersSource, /"x-frame-options": "DENY"/);
  assert.match(headersSource, /"content-security-policy": CONTENT_SECURITY_POLICY/);
  assert.match(headersSource, /docs\/PENTEST-2026-11-09\.md §3/);
});

test("CSP : le middleware et le _headers CDN posent exactement la même politique", () => {
  for (const directive of CSP_DIRECTIVES) {
    assert.ok(
      headersSource.includes(directive),
      `le middleware doit contenir « ${directive} »`,
    );
    assert.ok(
      cdnHeaders.includes(directive),
      `public/_headers doit contenir « ${directive} »`,
    );
  }
});

test("_headers CDN : baseline anti-clickjacking + HSTS sur /*, cache SW intact", () => {
  assert.match(cdnHeaders, /\/\*\n {2}Content-Security-Policy: default-src 'self'/);
  assert.match(cdnHeaders, /X-Frame-Options: DENY/);
  assert.match(cdnHeaders, /X-Content-Type-Options: nosniff/);
  assert.match(cdnHeaders, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  // S1 : le service worker n'est jamais figé dans un cache immuable.
  assert.match(cdnHeaders, /\/sw\.js\n {2}Cache-Control: public, max-age=0, must-revalidate/);
  // S1 : aucun Cache-Control public sur /content/* (fuites de cache CDN).
  assert.doesNotMatch(cdnHeaders, /\/content\/[^\n]*\n[^\n]*Cache-Control: public/);
});
