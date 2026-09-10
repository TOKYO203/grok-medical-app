#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const entry = resolve(".vercel/output/functions/__server.func/index.mjs");
const builtApp = await import(pathToFileURL(entry).href);

assert.equal(typeof builtApp.default?.fetch, "function", "Nitro fetch handler is missing");

for (const pathname of ["/", "/parcours/neuro"]) {
  const response = await builtApp.default.fetch(new Request(`http://localhost${pathname}`));
  const body = await response.text();

  assert.equal(response.status, 200, `${pathname} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
  assert.match(body, /Optimus/);
}

console.log("[smoke] built server: / and /parcours/neuro returned HTTP 200");
