import assert from "node:assert/strict";
import { test } from "node:test";

import { alertText, checkHealth, evaluateHealth } from "./uptime-check.mjs";

const jsonResponse = (status, payload) => ({
  status,
  headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
  json: async () => payload,
});

test("une réponse 200 JSON avec status ok est acceptée", () => {
  assert.deepEqual(evaluateHealth({ status: 200, contentType: "application/json" }, { status: "ok" }), {
    ok: true,
    reason: "ok",
  });
});

test("un 200 qui renvoie du HTML est refusé (proxy mal configuré)", () => {
  const verdict = evaluateHealth(
    { status: 200, contentType: "text/html; charset=utf-8" },
    { status: "ok" },
  );
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /content-type/);
});

test("un payload sans status ok est refusé", () => {
  assert.equal(evaluateHealth({ status: 200, contentType: "application/json" }, {}).ok, false);
  assert.equal(
    evaluateHealth({ status: 200, contentType: "application/json" }, { status: "degraded" }).ok,
    false,
  );
});

test("checkHealth remonte le code HTTP réel", async () => {
  const result = await checkHealth("https://example.test/api/health", {
    fetchImpl: async () => jsonResponse(503, { status: "down" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.match(result.reason, /503/);
});

test("checkHealth gère une panne réseau sans lever", async () => {
  const result = await checkHealth("https://example.test/api/health", {
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /réseau/);
});

test("checkHealth accepte une production saine", async () => {
  const result = await checkHealth("https://example.test/api/health", {
    fetchImpl: async () => jsonResponse(200, { status: "ok", service: "optimus" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("le message d'alerte contient l'URL et la raison", () => {
  const text = alertText("https://example.test/api/health", { reason: "HTTP 502", durationMs: 12 });
  assert.match(text, /EN ÉCHEC/);
  assert.match(text, /https:\/\/example\.test\/api\/health/);
  assert.match(text, /HTTP 502/);
});
