/**
 * B1 — garde-fou du budget IA global.
 *
 * `/api/ai-stream` est un proxy facturé au propriétaire et non authentifié :
 * le quota par IP ne suffit pas (rotation d'IP). Le handler doit donc consommer
 * un budget GLOBAL journalier avant tout appel provider.
 */
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("consumeGlobalBudget est exporté par le limiteur", () => {
  const src = readFileSync("src/lib/security/rate-limit.server.ts", "utf8");
  assert.match(src, /export async function consumeGlobalBudget\(/);
  assert.match(src, /optimus:budget:\$\{scope\}:\$\{windowIndex\}/);
  assert.match(src, /DAY_MS = 24 \* 60 \* 60 \* 1000/);
});

test("ai-stream consomme le budget global AVANT le quota par IP", () => {
  const src = readFileSync("src/routes/api.ai-stream.ts", "utf8");
  const budgetAt = src.indexOf("consumeGlobalBudget(");
  const ipAt = src.indexOf('rateLimitRequest(request, "ai-stream"');
  assert.ok(budgetAt > 0, "le handler doit appeler consumeGlobalBudget");
  assert.ok(ipAt > 0, "le handler doit conserver le quota par IP");
  assert.ok(budgetAt < ipAt, "le budget global doit être vérifié en premier");
  assert.match(src, /AI_DAILY_REQUEST_BUDGET/);
  assert.match(src, /status: 503/);
});

test("le plafond par défaut est borné et strictement positif", () => {
  const src = readFileSync("src/routes/api.ai-stream.ts", "utf8");
  const m = src.match(/process\.env\.AI_DAILY_REQUEST_BUDGET \?\? (\d+)/);
  assert.ok(m, "un défaut littéral doit être présent");
  const value = Number(m[1]);
  assert.ok(value > 0 && value <= 100_000, `défaut hors bornes : ${value}`);
});
