#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = 8081;
const BASE_URL = `http://${HOST}:${PORT}/`;
const START_TIMEOUT_MS = 30_000;

// The QA preview is a direct loopback-only server that we control. Opting into
// x-forwarded-for here lets Better Auth exercise its per-client limiter without
// pretending that an arbitrary production proxy header is trustworthy.
const qaEnv = {
  ...process.env,
  TRUST_PROXY_HEADERS: "true",
  QA_CLIENT_IP: HOST,
};

function spawnInherited(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    env: qaEnv,
    ...options,
  });
}

async function waitForPreview() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL, {
        redirect: "manual",
        headers: { "x-forwarded-for": HOST },
      });
      if (response.status > 0 && response.status < 500) return;
      lastError = new Error(`preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`preview did not become ready: ${lastError?.message ?? "timeout"}`);
}

async function runAudit(script) {
  const audit = spawnInherited(process.execPath, [script, BASE_URL]);
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

try {
  await waitForPreview();

  const mobileExitCode = await runAudit("scripts/mobile-ui-smoke.mjs");
  if (mobileExitCode !== 0) {
    process.exitCode = mobileExitCode;
  } else {
    const persistenceExitCode = await runAudit("scripts/imported-deck-browser-smoke.mjs");
    if (persistenceExitCode !== 0) {
      process.exitCode = persistenceExitCode;
    } else {
      const journeyExitCode = await runAudit("scripts/mobile-critical-journey-smoke.mjs");
      if (journeyExitCode !== 0) process.exitCode = journeyExitCode;
    }
  }
} catch (error) {
  console.error(`[qa:mobile:built] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopProcessGroup(preview);
}
