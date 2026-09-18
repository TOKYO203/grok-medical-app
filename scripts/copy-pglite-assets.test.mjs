import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { copyPgliteAssets } from "./copy-pglite-assets.mjs";

function createFixture(layout, provider = "vercel") {
  const root = mkdtempSync(join(tmpdir(), "pglite-assets-"));
  const source = join(root, "node_modules/@electric-sql/pglite/dist");
  const functionDir =
    provider === "netlify"
      ? join(root, ".netlify/functions-internal/server")
      : join(root, ".vercel/output/functions/__server.func");
  const target = layout === "chunked" ? join(functionDir, "_libs") : functionDir;
  mkdirSync(source, { recursive: true });
  mkdirSync(target, { recursive: true });
  const entryFile = provider === "netlify" ? "main.mjs" : "index.mjs";
  writeFileSync(join(functionDir, entryFile), "export default {};");

  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    writeFileSync(join(source, asset), asset);
  }

  return { root, target };
}

test("copies PGLite runtime assets into the Netlify function", () => {
  const { root, target } = createFixture("inlined", "netlify");

  copyPgliteAssets(root, { provider: "netlify" });

  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    assert.equal(existsSync(join(target, asset)), true);
  }
});

for (const layout of ["chunked", "inlined"]) {
  test(`copies every PGLite runtime asset into the ${layout} Nitro bundle`, () => {
    const { root, target } = createFixture(layout);

    copyPgliteAssets(root);

    for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
      assert.equal(existsSync(join(target, asset)), true);
    }
  });
}
