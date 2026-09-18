#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./with-app-env.mjs";

const ASSETS = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function copyPgliteAssets(
  root,
  { provider = process.env.NETLIFY === "true" ? "netlify" : "vercel" } = {},
) {
  const sourceDir = join(root, "node_modules/@electric-sql/pglite/dist");
  const functionDir =
    provider === "netlify"
      ? join(root, ".netlify/functions-internal/server")
      : join(root, ".vercel/output/functions/__server.func");
  const entryFile = provider === "netlify" ? "main.mjs" : "index.mjs";
  const chunkedLibDir = join(functionDir, "_libs");
  const targetDir = existsSync(chunkedLibDir) ? chunkedLibDir : functionDir;

  if (!existsSync(join(functionDir, entryFile))) {
    throw new Error(`Nitro function bundle is missing: ${functionDir}`);
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
