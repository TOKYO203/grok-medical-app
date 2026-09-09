import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { copyPgliteAssets } from "./copy-pglite-assets.mjs";

test("copies every PGLite runtime asset into the Nitro function bundle", () => {
  const root = mkdtempSync(join(tmpdir(), "pglite-assets-"));
  const source = join(root, "node_modules/@electric-sql/pglite/dist");
  const target = join(root, ".vercel/output/functions/__server.func/_libs");
  mkdirSync(source, { recursive: true });
  mkdirSync(target, { recursive: true });

  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    writeFileSync(join(source, asset), asset);
  }

  copyPgliteAssets(root);

  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    assert.equal(existsSync(join(target, asset)), true);
  }
});
