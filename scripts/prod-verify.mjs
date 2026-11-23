#!/usr/bin/env node
/**
 * Vérification de production après déploiement.
 *
 * CONTEXTE (2026-11-12)
 * La production renvoyait `{"status":500,"unhandled":true}` sur des routes d'API
 * et un handler de diagnostic absent du dépôt : le Worker déployé ne
 * correspondait pas à `main`. Aucun contrôle automatique ne l'avait vu. Ce
 * script rejoue, après chaque déploiement, les sondes qui distinguent un
 * déploiement sain d'un déploiement cassé.
 *
 * TROIS NIVEAUX
 *   • ok    — comportement attendu ;
 *   • warn  — état dégradé mais **attendu sans configuration** (contenu Premium
 *             fermé tant que `LICENSE_JWT_SECRET` est absent) : visible, non
 *             bloquant ;
 *   • fail  — régression réelle (5xx, handler de diagnostic exposé, sonde de
 *             santé absente, garde admin désactivé) : code de sortie 1.
 *
 * Usage :
 *   node scripts/prod-verify.mjs
 *   node scripts/prod-verify.mjs --base https://optimus.carabin.workers.dev
 *   node scripts/prod-verify.mjs --attempts 6 --delay 10
 */
import { pathToFileURL } from "node:url";

export const DEFAULT_BASE_URL = "https://optimus.carabin.workers.dev";

/** Une réponse contenant ce marqueur vient d'un handler de diagnostic laissé en prod. */
const UNHANDLED_MARKER = "unhandled";

/**
 * @typedef {{ level: "ok" | "warn" | "fail", detail: string }} Verdict
 */

/**
 * Juge une réponse HTTP contre l'attente d'une sonde.
 * Pure : aucun réseau, directement testable.
 *
 * @param {{ id: string, kind: "health" | "json-api" | "premium-content" | "admin" | "headers" }} probe
 * @param {{ status: number, body?: string, headers?: Record<string, string> }} response
 * @returns {Verdict}
 */
export function judgeProbe(probe, response) {
  const { status } = response;
  const body = response.body ?? "";
  const headers = response.headers ?? {};
  const exposesDiagnostics = body.toLowerCase().includes(UNHANDLED_MARKER);

  // Le contenu Premium passe AVANT la règle générale des 5xx : un 503 y est un
  // état attendu (garde non configuré), pas une régression de déploiement.
  if (probe.kind === "premium-content") {
    if (status === 503) {
      return {
        level: "warn",
        detail: "HTTP 503 — garde de contenu non configuré (LICENSE_JWT_SECRET absent) : aucun abonné ne peut lire le contenu",
      };
    }
    if (status >= 500) return { level: "fail", detail: `HTTP ${status}` };
  }

  if (status >= 500) {
    return {
      level: "fail",
      detail: exposesDiagnostics
        ? `HTTP ${status} avec handler de diagnostic exposé (« ${UNHANDLED_MARKER} »)`
        : `HTTP ${status}`,
    };
  }

  switch (probe.kind) {
    case "health": {
      if (status !== 200) return { level: "fail", detail: `sonde absente ou en erreur (HTTP ${status})` };
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return { level: "fail", detail: "réponse non JSON" };
      }
      if (payload?.status !== "ok") return { level: "fail", detail: `status inattendu : ${payload?.status}` };
      return { level: "ok", detail: "HTTP 200 · status ok" };
    }

    case "json-api": {
      if (status >= 400 && status < 500) {
        return { level: "ok", detail: `HTTP ${status} attendu sans corps valide` };
      }
      if (status === 200) return { level: "ok", detail: "HTTP 200" };
      return { level: "warn", detail: `HTTP ${status} inattendu` };
    }

    case "premium-content": {
      if (status === 401 || status === 403) {
        return { level: "ok", detail: `HTTP ${status} — garde de contenu actif` };
      }
      if (status === 200) {
        return { level: "warn", detail: "HTTP 200 — contenu servi sans jeton, vérifier le garde" };
      }
      return { level: "warn", detail: `HTTP ${status}` };
    }

    case "admin": {
      if (status === 200) {
        return { level: "fail", detail: "HTTP 200 en anonyme — le garde /admin ne protège plus rien" };
      }
      return { level: "ok", detail: `HTTP ${status} en anonyme` };
    }

    case "headers": {
      if (status !== 200) {
        return { level: "fail", detail: `page d'accueil indisponible (HTTP ${status})` };
      }
      const missing = [];
      const csp = headers["content-security-policy"] ?? "";
      if (!csp) missing.push("Content-Security-Policy");
      else if (!csp.includes("frame-ancestors")) missing.push("frame-ancestors");
      if (!headers["x-frame-options"]) missing.push("X-Frame-Options");
      if (!headers["strict-transport-security"]) missing.push("Strict-Transport-Security");
      if (missing.length) return { level: "fail", detail: `en-têtes absents : ${missing.join(", ")}` };
      return { level: "ok", detail: "CSP + frame-ancestors + X-Frame-Options + HSTS" };
    }

    default:
      return { level: "warn", detail: `sonde inconnue (${probe.id})` };
  }
}

/**
 * Sondes exécutées après déploiement. `path` + `method` + `expect`.
 */
export const PROBES = [
  { id: "sante", kind: "health", method: "GET", path: "/api/health" },
  { id: "diagnostic-paiement", kind: "json-api", method: "GET", path: "/api/health/checkout" },
  { id: "quiz-answer", kind: "json-api", method: "POST", path: "/api/quiz/answer" },
  { id: "licence-verify", kind: "json-api", method: "POST", path: "/api/licenses/verify" },
  { id: "licence-trial", kind: "json-api", method: "POST", path: "/api/licenses/trial-token" },
  { id: "contenu-premium", kind: "premium-content", method: "GET", path: "/content/pathologies/paludisme.json" },
  { id: "garde-admin", kind: "admin", method: "GET", path: "/admin" },
  { id: "en-tetes", kind: "headers", method: "GET", path: "/" },
];

/** Compte les verdicts et décide du code de sortie. */
export function summarize(results) {
  const counts = { ok: 0, warn: 0, fail: 0 };
  for (const result of results) counts[result.level] += 1;
  return { counts, exitCode: counts.fail > 0 ? 1 : 0 };
}

/** Rendu lisible (aucun secret, seulement des codes et des chemins). */
export function formatReport(results) {
  const icon = { ok: "✓", warn: "!", fail: "✗" };
  const lines = results.map(
    (r) => `${icon[r.level]} ${r.id.padEnd(20)} ${String(r.status ?? "—").padEnd(4)} ${r.detail}`,
  );
  const { counts } = summarize(results);
  lines.push("", `${counts.ok} OK · ${counts.warn} alerte(s) · ${counts.fail} bloquant(s)`);
  return lines.join("\n");
}

async function fetchProbe(baseUrl, probe, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${probe.path}`, {
      method: probe.method,
      headers:
        probe.method === "POST"
          ? { "content-type": "application/json", accept: "application/json" }
          : probe.kind === "headers"
            ? // La page d'accueil est du HTML : demander du JSON la fait répondre 406.
              { accept: "text/html" }
            : { accept: "application/json" },
      body: probe.method === "POST" ? "{}" : undefined,
      signal: controller.signal,
    });
    const body = await response.text();
    const headers = {};
    for (const key of ["content-security-policy", "x-frame-options", "strict-transport-security"]) {
      const value = response.headers.get(key);
      if (value) headers[key] = value;
    }
    return { status: response.status, body: body.slice(0, 2_000), headers };
  } catch (error) {
    return { status: 0, body: "", headers: {}, error: error?.name === "AbortError" ? "timeout" : "réseau" };
  } finally {
    clearTimeout(timer);
  }
}

/** Attend que la santé réponde, le temps que le déploiement se propage. */
async function waitForHealth(baseUrl, attempts, delaySeconds) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchProbe(
      baseUrl,
      { id: "sante", kind: "health", method: "GET", path: "/api/health" },
      10_000,
    );
    const verdict = judgeProbe({ id: "sante", kind: "health" }, response);
    if (verdict.level === "ok") return true;
    if (attempt < attempts) {
      console.log(`[prod-verify] tentative ${attempt}/${attempts} — ${verdict.detail} ; nouvelle tentative dans ${delaySeconds} s`);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1_000));
    }
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const valueAfter = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const baseUrl = (valueAfter("--base") ?? process.env.PROD_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const attempts = Number(valueAfter("--attempts") ?? 1) || 1;
  const delaySeconds = Number(valueAfter("--delay") ?? 5) || 5;

  console.log(`[prod-verify] cible ${baseUrl}`);
  if (!(await waitForHealth(baseUrl, attempts, delaySeconds))) {
    // On continue : une santé absente peut n'être qu'une route oubliée alors
    // que le reste de l'API est cassé (ou l'inverse). Le rapport complet situe
    // la panne ; s'arrêter au premier échec la masquerait.
    console.error(
      "[prod-verify] la sonde de santé ne répond pas — les autres contrôles sont exécutés pour situer la panne.",
    );
  }

  const results = [];
  for (const probe of PROBES) {
    const response = await fetchProbe(baseUrl, probe, 10_000);
    if (response.error) {
      results.push({ id: probe.id, level: "fail", status: 0, detail: response.error });
      continue;
    }
    const verdict = judgeProbe(probe, response);
    results.push({ id: probe.id, status: response.status, ...verdict });
  }

  console.log("");
  console.log(formatReport(results));
  process.exitCode = summarize(results).exitCode;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[prod-verify] erreur inattendue: ${error?.message ?? error}`);
    process.exit(1);
  });
}
