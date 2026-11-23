import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  buildErrorAlert,
  formatAlertText,
  resetAlertThrottle,
  sanitizePath,
  sendErrorAlert,
  shouldSendAlert,
} from "./error-alert.ts";

beforeEach(() => resetAlertThrottle());

const input = {
  requestId: "req-123",
  method: "post",
  path: "/api/quiz/answer?token=secret",
  status: 500,
  errorName: "TypeError",
  durationMs: 42.6,
};

test("la query string n'est jamais conservée (elle peut contenir un jeton)", () => {
  assert.equal(sanitizePath("/api/x?token=secret"), "/api/x");
  assert.equal(sanitizePath(""), "/");
  assert.equal(sanitizePath("   "), "/");
  assert.equal(sanitizePath(`/${"a".repeat(500)}`).length, 200);
});

test("l'alerte est normalisée et ne contient que des métadonnées", () => {
  const alert = buildErrorAlert(input, new Date("2026-11-12T10:00:00.000Z"));
  assert.deepEqual(alert, {
    type: "server_error",
    requestId: "req-123",
    method: "POST",
    path: "/api/quiz/answer",
    status: 500,
    errorName: "TypeError",
    durationMs: 43,
    at: "2026-11-12T10:00:00.000Z",
  });
  assert.ok(!JSON.stringify(alert).includes("secret"));
});

test("un statut ou un requestId absurde ne casse pas la construction", () => {
  const alert = buildErrorAlert({
    requestId: "",
    method: "",
    path: "/api/x",
    status: Number.NaN,
    errorName: "",
    durationMs: -5,
  });
  assert.equal(alert.requestId, "unknown");
  assert.equal(alert.method, "GET");
  assert.equal(alert.status, 0);
  assert.equal(alert.errorName, "UnknownError");
  assert.equal(alert.durationMs, 0);
});

test("sans webhook configuré, aucune alerte n'est envoyée", async () => {
  const alert = buildErrorAlert(input);
  let called = false;
  const sent = await sendErrorAlert(alert, {
    transport: async () => {
      called = true;
    },
  });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test("le transport reçoit un texte lisible et l'alerte structurée", async () => {
  const alert = buildErrorAlert(input, new Date("2026-11-12T10:00:00.000Z"));
  let payload: unknown;
  const sent = await sendErrorAlert(alert, {
    webhookUrl: "https://hooks.example.test/T000/B000",
    transport: async (_url, body) => {
      payload = JSON.parse(body);
    },
  });
  assert.equal(sent, true);
  const parsed = payload as { text: string; content: string; alert: { path: string } };
  assert.equal(parsed.text, formatAlertText(alert));
  assert.equal(parsed.content, parsed.text);
  assert.equal(parsed.alert.path, "/api/quiz/answer");
  assert.match(parsed.text, /HTTP 500/);
  assert.match(parsed.text, /requestId req-123/);
});

test("l'anti-bruit bloque la même signature dans la fenêtre, puis la libère", () => {
  const alert = buildErrorAlert(input);
  assert.equal(shouldSendAlert(alert, 1_000, 60_000), true);
  assert.equal(shouldSendAlert(alert, 30_000, 60_000), false);
  assert.equal(shouldSendAlert(alert, 61_001, 60_000), true);
});

test("deux chemins différents ne se bloquent pas entre eux", () => {
  const first = buildErrorAlert({ ...input, path: "/api/a" });
  const second = buildErrorAlert({ ...input, path: "/api/b" });
  assert.equal(shouldSendAlert(first, 1_000), true);
  assert.equal(shouldSendAlert(second, 1_000), true);
});

test("un transport qui échoue ne lève pas et renvoie false", async () => {
  const alert = buildErrorAlert(input);
  const sent = await sendErrorAlert(alert, {
    webhookUrl: "https://hooks.example.test/down",
    transport: async () => {
      throw new Error("réseau indisponible");
    },
  });
  assert.equal(sent, false);
});

test("le message distingue une exception d'une réponse 5xx", () => {
  const exception = buildErrorAlert({ ...input, status: 0 });
  assert.match(formatAlertText(exception), /^\[Optimus\] exception/);
  const serverError = buildErrorAlert({ ...input, status: 502 });
  assert.match(formatAlertText(serverError), /^\[Optimus\] HTTP 502/);
});
