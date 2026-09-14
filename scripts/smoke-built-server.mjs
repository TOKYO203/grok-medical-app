#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const isNetlify = process.env.NETLIFY === "true";
const entry = resolve(
  isNetlify
    ? ".netlify/functions-internal/server/main.mjs"
    : ".vercel/output/functions/__server.func/index.mjs",
);
const builtApp = await import(pathToFileURL(entry).href);
const fetchBuiltApp = isNetlify ? builtApp.default : builtApp.default?.fetch;

assert.equal(typeof fetchBuiltApp, "function", "Nitro fetch handler is missing");

const routes = [
  "/",
  "/parcours",
  "/parcours/neuro",
  "/learn/neuro?lesson=0&preview=true&mode=preview",
  "/revue?mode=today",
  "/cas",
  "/cas/NEURO-AVC-001",
  "/demarche/DX-THORAX-001",
  "/examen",
  "/calculateurs",
  "/classement",
  "/import",
  "/pro",
  "/achats",
  "/profil",
  "/contact",
  "/soutenir",
  "/a-propos",
];

for (const pathname of routes) {
  const response = await fetchBuiltApp(new Request(`http://localhost${pathname}`));
  const body = await response.text();

  assert.equal(response.status, 200, `${pathname} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
  assert.match(body, /Optimus/);
}

const modelBody = await readFile(
  resolve(isNetlify ? "dist/decks/cardio-ic-v2.json" : ".vercel/output/static/decks/cardio-ic-v2.json"),
  "utf8",
);
assert.doesNotThrow(() => JSON.parse(modelBody));

console.log(`[smoke] built server: ${routes.length} routes and the Deck model returned HTTP 200`);
