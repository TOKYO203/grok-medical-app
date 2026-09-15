#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = 8081;
const BASE_URL = `http://${HOST}:${PORT}/`;
const START_TIMEOUT_MS = 30_000;

function spawnInherited(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    ...options,
  });
}

async function waitForPreview() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
      lastError = new Error(`preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`preview did not become ready: ${lastError?.message ?? "timeout"}`);
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
  const audit = spawnInherited(process.execPath, ["scripts/mobile-ui-smoke.mjs", BASE_URL]);
  const exitCode = await new Promise((resolve) => audit.once("exit", (code) => resolve(code ?? 1)));
  if (exitCode !== 0) process.exitCode = exitCode;
} catch (error) {
  console.error(`[qa:mobile:built] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopProcessGroup(preview);
}
