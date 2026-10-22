#!/usr/bin/env node
/**
 * QA mobile de la CI — deux cibles, parce qu'elles ne mesurent pas la même chose.
 *
 *   1. L'ARTEFACT DE PRODUCTION (preview, 8081) : audit de mise en page à
 *      320/360/390 px. C'est lui qui attrape les débordements et les cibles
 *      tactiles trop petites, sur ce qui est réellement publié.
 *
 *   2. Un SERVEUR DE DÉVELOPPEMENT dont la configuration cloud est neutralisée
 *      (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` vides, 8082) : les deux
 *      smokes de FONCTIONNALITÉ (import de Deck dans IndexedDB, parcours
 *      critique mobile).
 *
 * Pourquoi deux cibles ? Dans un artefact de production, la porte de connexion
 * est ACTIVE : un visiteur anonyme voit l'écran de connexion, pas l'application.
 * Mesuré en CI : `/import` n'avait aucun `textarea` et le parcours critique
 * n'atteignait même pas l'onboarding — les deux scripts échouaient sur « l'écran
 * d'accueil n'est pas là », alors que la fonctionnalité testée était intacte.
 * Or ces deux scripts décrivent explicitement le monde SANS COMPTE (identité
 * `OM-GUEST`, IndexedDB locale, onboarding) : c'est leur contrat. Les jouer
 * derrière une porte qui exige justement un compte ne teste plus la
 * fonctionnalité, mais la porte.
 *
 * Neutraliser la configuration cloud au lieu de retirer les contrôles est le
 * point important : `resolveCloudGate` rend la porte transparente quand Supabase
 * n'est pas configuré, et c'est un comportement PRODUIT (l'application reste
 * utilisable sans cloud), pas une exception de test. Aucun drapeau « mode QA »
 * n'est introduit, donc aucun chemin de contournement ne peut atteindre la
 * production. Vérifié en CDP : accueil rendu sans mur, `/import` affiche son
 * formulaire, un seul `<main>`, 0 erreur console.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = 8081;
const BASE_URL = `http://${HOST}:${PORT}/`;
const DEV_PORT = Number(process.env.QA_DEV_PORT || 8082);
const DEV_URL = `http://${HOST}:${DEV_PORT}/`;
const START_TIMEOUT_MS = Number(process.env.QA_START_TIMEOUT_MS || 30_000);
const DEV_START_TIMEOUT_MS = Number(process.env.QA_DEV_START_TIMEOUT_MS || 120_000);

// The QA preview is a direct loopback-only server that we control. Opting into
// x-forwarded-for here lets Better Auth exercise its per-client limiter without
// pretending that an arbitrary production proxy header is trustworthy.
const qaEnv = {
  ...process.env,
  TRUST_PROXY_HEADERS: "true",
  QA_CLIENT_IP: HOST,
};

/**
 * `/import` et le parcours critique supposent le monde sans compte. Vider les
 * deux variables rend la porte transparente (`configured: false`), comportement
 * produit documenté — aucun drapeau de test n'entre dans le bundle.
 */
const featureEnv = {
  ...qaEnv,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
};

function spawnInherited(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    env: qaEnv,
    ...options,
  });
}

async function waitForServer(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { "x-forwarded-for": HOST },
      });
      if (response.status > 0 && response.status < 500) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

async function runAudit(script, baseUrl) {
  const audit = spawn(process.execPath, [script, baseUrl], {
    stdio: "inherit",
    env: qaEnv,
  });
  return new Promise((resolve) => audit.once("exit", (code) => resolve(code ?? 1)));
}

async function stopProcessGroup(child) {
  if (!child?.pid) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch {
    // Process may already have exited.
  }
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3_000)]);
  try {
    if (child.exitCode === null) {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    }
  } catch {
    // Best-effort cleanup only.
  }
}

const preview = spawnInherited(
  process.execPath,
  ["scripts/with-app-env.mjs", "vite", "preview"],
  { detached: process.platform !== "win32" },
);

let dev = null;

try {
  await waitForServer(BASE_URL, START_TIMEOUT_MS, "preview");

  // Cible 1 — l'artefact publié : mise en page uniquement (la porte d'entrée est
  // un écran légitime à auditer, et l'audit publie désormais ce qu'il a mesuré).
  const mobileExitCode = await runAudit("scripts/mobile-ui-smoke.mjs", BASE_URL);
  if (mobileExitCode !== 0) {
    process.exitCode = mobileExitCode;
  } else {
    // Cible 2 — les fonctionnalités sans compte, sur un serveur de développement
    // dont le cloud est neutralisé. Lancé seulement maintenant : inutile de payer
    // la compilation à froid si l'audit de mise en page a déjà échoué.
    dev = spawn(process.execPath, ["scripts/with-app-env.mjs", "vite", "dev", "--host", HOST, "--port", String(DEV_PORT)], {
      stdio: "inherit",
      env: featureEnv,
      detached: process.platform !== "win32",
    });
    await waitForServer(DEV_URL, DEV_START_TIMEOUT_MS, "dev server");

    const persistenceExitCode = await runAudit("scripts/imported-deck-browser-smoke.mjs", DEV_URL);
    if (persistenceExitCode !== 0) {
      process.exitCode = persistenceExitCode;
    } else {
      const journeyExitCode = await runAudit("scripts/mobile-critical-journey-smoke.mjs", DEV_URL);
      if (journeyExitCode !== 0) process.exitCode = journeyExitCode;
    }
  }
} catch (error) {
  console.error(`[qa:mobile:built] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopProcessGroup(dev);
  await stopProcessGroup(preview);
}
