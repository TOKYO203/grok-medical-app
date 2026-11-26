#!/usr/bin/env node
/**
 * Sonde uptime — vérifie que la production répond, et prévient un webhook.
 *
 * Usage :
 *   node scripts/uptime-check.mjs                        # production par défaut
 *   UPTIME_URL=https://… node scripts/uptime-check.mjs   # cible explicite
 *   UPTIME_ALERT_WEBHOOK=https://… node scripts/uptime-check.mjs
 *
 * Sortie : 0 si la sonde répond correctement, 1 sinon (le job GitHub devient
 * rouge, ce qui est déjà une alerte visible).
 *
 * Ce que la sonde exige : HTTP 200, `content-type: application/json`,
 * `status: "ok"`. Un 200 avec un HTML de page d'erreur (proxy mal configuré)
 * est donc refusé.
 */
import { pathToFileURL } from "node:url";

export const DEFAULT_HEALTH_URL = "https://optimus.carabin.workers.dev/api/health";
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Juge une réponse de santé.
 * @param {{ status: number, contentType?: string | null }} response
 * @param {unknown} payload
 * @returns {{ ok: boolean, reason: string }}
 */
export function evaluateHealth(response, payload) {
  if (response.status !== 200) {
    return { ok: false, reason: `HTTP ${response.status}` };
  }
  const contentType = (response.contentType ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return { ok: false, reason: `content-type inattendu: ${contentType || "absent"}` };
  }
  if (!payload || typeof payload !== "object" || payload.status !== "ok") {
    return { ok: false, reason: "payload sans status « ok »" };
  }
  return { ok: true, reason: "ok" };
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, reason: string, status?: number, durationMs: number }>}
 */
export async function checkHealth(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: controller.signal,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const verdict = evaluateHealth(
      { status: response.status, contentType: response.headers.get("content-type") },
      payload,
    );
    return { ...verdict, status: response.status, durationMs: Date.now() - startedAt };
  } catch (error) {
    const reason =
      error?.name === "AbortError" ? `timeout après ${timeoutMs} ms` : "réseau injoignable";
    return { ok: false, reason, durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/** Message d'alerte (Slack `text` + Discord `content`). */
export function alertText(url, result) {
  return `[Optimus] sonde uptime EN ÉCHEC · ${url} · ${result.reason} · ${result.durationMs} ms`;
}

async function notify(url, result, webhookUrl) {
  if (!webhookUrl) return;
  const text = alertText(url, result);
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // La sonde doit se terminer proprement même si l'alerte échoue.
  }
}

async function main() {
  const url = (process.env.UPTIME_URL ?? "").trim() || DEFAULT_HEALTH_URL;
  const webhookUrl = (process.env.UPTIME_ALERT_WEBHOOK ?? "").trim();
  const result = await checkHealth(url);
  if (result.ok) {
    console.log(`[uptime] OK — ${url} (HTTP 200, ${result.durationMs} ms)`);
    return;
  }
  console.error(`[uptime] ÉCHEC — ${url} — ${result.reason} (${result.durationMs} ms)`);
  await notify(url, result, webhookUrl);
  process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[uptime] erreur inattendue: ${error?.message ?? error}`);
    process.exit(1);
  });
}
