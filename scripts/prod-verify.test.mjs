import assert from "node:assert/strict";
import { test } from "node:test";

import { formatReport, judgeProbe, PROBES, summarize } from "./prod-verify.mjs";

const health = { id: "sante", kind: "health" };
const jsonApi = { id: "quiz-answer", kind: "json-api" };
const content = { id: "contenu-premium", kind: "premium-content" };
const admin = { id: "garde-admin", kind: "admin" };
const headers = { id: "en-tetes", kind: "headers" };

test("le handler de diagnostic laissé en production est bloquant", () => {
  const verdict = judgeProbe(jsonApi, {
    status: 500,
    body: JSON.stringify({ status: 500, unhandled: true, message: "HTTPError" }),
  });
  assert.equal(verdict.level, "fail");
  assert.match(verdict.detail, /diagnostic/);
});

test("un 500 sans marqueur de diagnostic reste bloquant", () => {
  const verdict = judgeProbe(jsonApi, { status: 500, body: '{"error":"boom"}' });
  assert.equal(verdict.level, "fail");
  assert.match(verdict.detail, /HTTP 500/);
});

test("une sonde de santé absente (404) est bloquante", () => {
  assert.equal(judgeProbe(health, { status: 404, body: "not found" }).level, "fail");
});

test("la santé doit être 200 avec status ok", () => {
  assert.equal(judgeProbe(health, { status: 200, body: '{"status":"ok"}' }).level, "ok");
  assert.equal(judgeProbe(health, { status: 200, body: '{"status":"degraded"}' }).level, "fail");
  assert.equal(judgeProbe(health, { status: 200, body: "<html>" }).level, "fail");
});

test("une API qui refuse un corps invalide en 4xx est saine", () => {
  assert.equal(judgeProbe(jsonApi, { status: 400, body: '{"error":"invalid"}' }).level, "ok");
  assert.equal(judgeProbe(jsonApi, { status: 401, body: "" }).level, "ok");
});

test("le contenu Premium fermé faute de secret est une alerte, pas un blocage", () => {
  const verdict = judgeProbe(content, { status: 503, body: "" });
  assert.equal(verdict.level, "warn");
  assert.match(verdict.detail, /LICENSE_JWT_SECRET/);
  assert.equal(judgeProbe(content, { status: 401, body: "" }).level, "ok");
  assert.equal(judgeProbe(content, { status: 500, body: "" }).level, "fail");
});

test("un /admin ouvert en anonyme est bloquant", () => {
  assert.equal(judgeProbe(admin, { status: 200, body: "" }).level, "fail");
  assert.equal(judgeProbe(admin, { status: 403, body: "" }).level, "ok");
});

test("les en-têtes de sécurité manquants sont bloquants", () => {
  assert.equal(judgeProbe(headers, { status: 200, headers: {} }).level, "fail");
  const incomplete = judgeProbe(headers, {
    status: 200,
    headers: {
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
      "strict-transport-security": "max-age=31536000",
    },
  });
  assert.equal(incomplete.level, "fail");
  assert.match(incomplete.detail, /frame-ancestors/);
  assert.equal(judgeProbe(headers, { status: 500, headers: {} }).level, "fail");
  const complete = judgeProbe(headers, {
    status: 200,
    headers: {
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      "x-frame-options": "DENY",
      "strict-transport-security": "max-age=31536000",
    },
  });
  assert.equal(complete.level, "ok");
});

test("les sondes couvrent les routes qui renvoyaient 500 en production", () => {
  const paths = PROBES.map((probe) => probe.path);
  for (const path of [
    "/api/health",
    "/api/health/checkout",
    "/api/quiz/answer",
    "/api/licenses/verify",
    "/api/licenses/trial-token",
  ]) {
    assert.ok(paths.includes(path), `${path} doit être surveillé`);
  }
});

test("le résumé ne passe au vert qu'avec zéro bloquant", () => {
  assert.equal(summarize([{ level: "ok" }, { level: "warn" }]).exitCode, 0);
  assert.equal(summarize([{ level: "ok" }, { level: "fail" }]).exitCode, 1);
  const report = formatReport([
    { id: "sante", status: 200, level: "ok", detail: "HTTP 200" },
    { id: "contenu-premium", status: 503, level: "warn", detail: "garde non configuré" },
  ]);
  assert.match(report, /1 OK · 1 alerte\(s\) · 0 bloquant\(s\)/);
});
