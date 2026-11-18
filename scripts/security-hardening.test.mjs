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
 * Politique CSP de référence — pentest 2026-11-09 §3 (docs/PENTEST-2026-11-09.md),
 * amendée le 2026-11-18 (audit sécurité) : la comparaison precedente testait la
 * PRÉSENCE de sous-chaînes, donc « script-src 'self' » passait meme si la
 * politique déployée avait gagne 'unsafe-inline' ou de nouvelles origines.
 * On verrouille maintenant la chaîne CSP EXACTE des deux côtés.
 */
const CSP_ALLOWED_ORIGIN_EXCEPTIONS = ["https://grok.com"];

function extractMiddlewareCsp(source) {
  const body = source.match(
    /const CONTENT_SECURITY_POLICY = \[([\s\S]*?)\]\.join\("; "\)/,
  )?.[1];
  assert.ok(body, "CONTENT_SECURITY_POLICY introuvable dans le middleware");
  return body
    .split(",")
    .map((line) => line.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function extractCdnCsp(source) {
  const line = source.match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1];
  return line;
}

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

test("audit 2026-11-18 : CSP middleware = CSP CDN, caractere par caractere", () => {
  const cdnCsp = extractCdnCsp(cdnHeaders);
  assert.ok(cdnCsp, "public/_headers doit poser Content-Security-Policy sur /*");
  const middlewareDirectives = extractMiddlewareCsp(headersSource);
  assert.equal(
    middlewareDirectives.join("; "),
    cdnCsp,
    "la CSP du middleware et celle du CDN doivent etre STRICTEMENT identiques",
  );
});

test("audit 2026-11-18 : script-src ne senlargit pas silencieusement", () => {
  const scriptSrc = extractMiddlewareCsp(headersSource).find((d) => d.startsWith("script-src"));
  assert.ok(scriptSrc, "directive script-src manquante");
  const origins = scriptSrc.split(/\s+/).slice(1);
  for (const origin of origins) {
    if (/^https?:\/\//.test(origin)) {
      assert.ok(
        CSP_ALLOWED_ORIGIN_EXCEPTIONS.includes(origin),
        `origine tiers inattendue dans script-src : ${origin} (ajouter une justification + le cadre aux exceptions du test)`,
      );
    }
    assert.ok(
      origin !== "'unsafe-eval'" && origin !== "'strict-dynamic'",
      `script-src ne doit pas contenir ${origin}`,
    );
  }
  // 'unsafe-inline' est un risque résiduel documenté (PR #460 : les scripts
  // inline d'hydratation TanStack Start n'acceptent pas de nonce fiable dans
  // cette version) — on l'accepte mais on l'interdit de réintroduire
  // 'unsafe-eval' ou une nouvelle origine tiers sans decision explicite.
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
