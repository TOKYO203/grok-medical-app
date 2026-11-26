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

/** Source sans commentaires : les assertions négatives ne doivent pas viser la prose. */
const headersCode = headersSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** Valeur de la CSP posée par le bloc /* de public/_headers (CDN). */
const cdnCsp = (() => {
  const line = cdnHeaders
    .split("\n")
    .find((candidate) => candidate.trimStart().startsWith("Content-Security-Policy:"));
  assert.ok(line, "public/_headers doit poser une Content-Security-Policy");
  return line.slice(line.indexOf(":") + 1).trim();
})();

/** Directive `script-src` du CDN, sans le reste de la politique. */
const cdnScriptSrc = (() => {
  const match = cdnCsp.match(/(?:^|;\s*)script-src ([^;]+)/);
  assert.ok(match, "la CSP du CDN doit définir script-src");
  return match[1].trim();
})();

/**
 * Politique CSP de référence — pentest 2026-11-09 §3, durcie par l'audit #467
 * F1 (2026-11-19) puis rétablie en fonctionnement par la décision CSP du
 * 2026-11-23 (nonce par réponse pour le HTML du worker, `'self'` pour les
 * actifs statiques du CDN). Les directives hors `script-src` doivent rester
 * identiques des deux côtés ; `script-src` diffère volontairement :
 *  - worker : `script-src 'self' 'nonce-…'` (HTML SSR avec scripts inline) ;
 *  - CDN : `script-src 'self'` (aucun HTML inline dans ce dossier).
 */
const SHARED_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
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
  assert.match(headersSource, /"x-frame-options": "DENY"/);
  assert.ok(
    headersSource.includes('headers.set("content-security-policy", contentSecurityPolicy(nonce))'),
    "le middleware doit poser la CSP construite pour le nonce de la réponse",
  );
  assert.match(headersSource, /docs\/PENTEST-2026-11-09\.md §3/);
});

test("CSP : directives partagées identiques entre le middleware et le _headers CDN", () => {
  for (const directive of SHARED_DIRECTIVES) {
    assert.ok(
      headersSource.includes(directive),
      `le middleware doit contenir « ${directive} »`,
    );
    assert.ok(
      cdnCsp.includes(directive),
      `public/_headers doit contenir « ${directive} »`,
    );
  }
});

test("CSP script-src worker : nonce par réponse, ni 'unsafe-inline' ni hash ni domaine tiers", () => {
  // Décision 2026-11-23 : les scripts inline de TanStack changent à chaque
  // réponse, un hash statique est donc inapplicable ; et un hash présent fait
  // ignorer 'unsafe-inline' par les navigateurs (incident 2026-11-20/21).
  assert.ok(
    headersSource.includes("script-src 'self' 'nonce-${nonce}'"),
    "script-src doit être construit à partir du nonce de la réponse",
  );
  assert.match(headersSource, /randomBytes\(16\)/, "le nonce doit venir d'un CSPRNG (128 bits)");
  assert.doesNotMatch(headersCode, /script-src[^;\n]*unsafe-inline/);
  assert.doesNotMatch(headersCode, /script-src[^;\n]*https:\/\//);
  assert.doesNotMatch(headersCode, /THEME_BOOT_HASH|createHash/);
});

test("CSP script-src worker : chaque script inline du HTML reçoit le nonce", () => {
  assert.ok(
    headersSource.includes("(?![^>]*\\bsrc=)"),
    "seuls les scripts sans attribut src doivent être étiquetés",
  );
  assert.ok(
    headersSource.includes('<script nonce="${nonce}"'),
    "le rewrite doit injecter l'attribut nonce",
  );
  assert.match(headersSource, /await response\.text\(\)/);
});

test("CSP CDN : script-src 'self' seul, aucun script inline dans les actifs statiques", () => {
  assert.equal(cdnScriptSrc, "'self'");
  assert.doesNotMatch(cdnScriptSrc, /unsafe-inline|sha(256|384|512)-|\*/);
});

test("CSP : aucun domaine tiers exécutable (grok.com notamment)", () => {
  assert.doesNotMatch(headersCode, /script-src[^;\n]*https:\/\/grok\.com/);
  assert.doesNotMatch(cdnCsp, /script-src[^;]*https:\/\/grok\.com/);
  assert.doesNotMatch(headersCode, /^\s*"script-src 'self' https:\/\//m);
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
