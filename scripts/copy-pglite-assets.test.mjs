import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { copyPgliteAssets } from "./copy-pglite-assets.mjs";

function createFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), "pglite-assets-"));
  const source = join(root, "node_modules/@electric-sql/pglite/dist");
  const functionDir = join(root, ".vercel/output/functions/__server.func");
  const target = layout === "chunked" ? join(functionDir, "_libs") : functionDir;
  mkdirSync(source, { recursive: true });
  mkdirSync(target, { recursive: true });
  writeFileSync(join(functionDir, "index.mjs"), "export default {};");

  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    writeFileSync(join(source, asset), asset);
  }

  return { root, target };
}

for (const layout of ["chunked", "inlined"]) {
  test(`copies every PGLite runtime asset into the ${layout} Nitro bundle`, () => {
    const { root, target } = createFixture(layout);

    copyPgliteAssets(root);

    for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
      assert.equal(existsSync(join(target, asset)), true);
    }
  });
}
