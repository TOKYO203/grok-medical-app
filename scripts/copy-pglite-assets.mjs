#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./with-app-env.mjs";

const ASSETS = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function copyPgliteAssets(root) {
  const sourceDir = join(root, "node_modules/@electric-sql/pglite/dist");
  const targetDir = join(root, ".vercel/output/functions/__server.func/_libs");

  if (!existsSync(targetDir)) {
    throw new Error(`Nitro output directory is missing: ${targetDir}`);
  }

  mkdirSync(targetDir, { recursive: true });
  for (const asset of ASSETS) {
    const source = join(sourceDir, asset);
    if (!existsSync(source)) {
      throw new Error(`PGLite runtime asset is missing: ${source}`);
    }
    copyFileSync(source, join(targetDir, asset));
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (isMainModule(import.meta.url)) copyPgliteAssets(root);
