#!/usr/bin/env node
import assert from "node:assert/strict";
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

for (const pathname of ["/", "/parcours/neuro", "/pro", "/achats"]) {
  const response = await fetchBuiltApp(new Request(`http://localhost${pathname}`));
  const body = await response.text();

  assert.equal(response.status, 200, `${pathname} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
  assert.match(body, /Optimus/);
}

console.log("[smoke] built server: /, /parcours/neuro, /pro and /achats returned HTTP 200");
