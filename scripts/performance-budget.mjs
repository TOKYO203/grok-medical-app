#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PERFORMANCE_BUDGET = Object.freeze({
  maxJavascriptChunkBytes: 400 * 1024,
  maxStylesheetBytes: 100 * 1024,
  maxTotalJavascriptBytes: 1536 * 1024,
  maxPublicAssetBytes: 512 * 1024,
  maxTotalPublicAssetBytes: 2 * 1024 * 1024,
});

const ASSET_DIR_CANDIDATES = [
  ".vercel/output/static/assets",
  ".netlify/static/assets",
  ".output/public/assets",
  "dist/assets",
];

export function findAssetDirectory(root = process.cwd()) {
  for (const relativePath of ASSET_DIR_CANDIDATES) {
    const absolute = resolve(root, relativePath);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) return absolute;
  }
  return null;
}

export function inspectPublicAssetBudget(publicDirectory, budget = PERFORMANCE_BUDGET) {
  if (!existsSync(publicDirectory) || !statSync(publicDirectory).isDirectory()) {
    return {
      ok: true,
      totalPublicAssetBytes: 0,
      publicAssetFiles: 0,
      largestPublicAssets: [],
      violations: [],
    };
  }

  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push({
          name: relative(publicDirectory, absolute),
          bytes: statSync(absolute).size,
        });
      }
    }
  };
  walk(publicDirectory);

  const totalPublicAssetBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const violations = [];

  for (const file of files) {
    if (file.bytes > budget.maxPublicAssetBytes) {
      violations.push(
        `${file.name}: public asset ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxPublicAssetBytes)}`,
      );
    }
  }

  if (totalPublicAssetBytes > budget.maxTotalPublicAssetBytes) {
    violations.push(
      `total public assets ${formatBytes(totalPublicAssetBytes)} exceeds ${formatBytes(budget.maxTotalPublicAssetBytes)}`,
    );
  }

  return {
    ok: violations.length === 0,
    totalPublicAssetBytes,
    publicAssetFiles: files.length,
    largestPublicAssets: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    violations,
  };
}

export function inspectPerformanceBudget(assetDirectory, budget = PERFORMANCE_BUDGET) {
  const files = readdirSync(assetDirectory)
    .map((name) => ({ name, bytes: statSync(resolve(assetDirectory, name)).size }))
    .filter((file) => /\.(?:js|css)$/i.test(file.name));

  const javascript = files.filter((file) => /\.js$/i.test(file.name));
  const stylesheets = files.filter((file) => /\.css$/i.test(file.name));
  const totalJavascriptBytes = javascript.reduce((sum, file) => sum + file.bytes, 0);

  const violations = [];
  for (const file of javascript) {
    if (file.bytes > budget.maxJavascriptChunkBytes) {
      violations.push(
        `${file.name}: JS chunk ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxJavascriptChunkBytes)}`,
      );
    }
  }
  for (const file of stylesheets) {
    if (file.bytes > budget.maxStylesheetBytes) {
      violations.push(
        `${file.name}: stylesheet ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxStylesheetBytes)}`,
      );
    }
  }
  if (totalJavascriptBytes > budget.maxTotalJavascriptBytes) {
    violations.push(
      `total client JS ${formatBytes(totalJavascriptBytes)} exceeds ${formatBytes(budget.maxTotalJavascriptBytes)}`,
    );
  }

  const largestJavascript = [...javascript].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  const largestStylesheets = [...stylesheets].sort((a, b) => b.bytes - a.bytes).slice(0, 3);

  return {
    ok: violations.length === 0,
    budget,
    totalJavascriptBytes,
    javascriptFiles: javascript.length,
    stylesheetFiles: stylesheets.length,
    largestJavascript,
    largestStylesheets,
    violations,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function main() {
  const root = process.cwd();
  const assetDirectory = findAssetDirectory(root);
  if (!assetDirectory) {
    console.error(
      "[performance-budget] client asset directory not found after build; refusing to skip the budget gate.",
    );
    process.exitCode = 1;
    return;
  }

  const clientReport = inspectPerformanceBudget(assetDirectory);
  const publicReport = inspectPublicAssetBudget(resolve(root, "public"));
  const violations = [...clientReport.violations, ...publicReport.violations];
  const report = {
    ...clientReport,
    ok: violations.length === 0,
    violations,
    publicAssets: publicReport,
  };

  console.log(
    JSON.stringify(
      {
        ...report,
        assetDirectory,
        totalJavascript: formatBytes(report.totalJavascriptBytes),
        totalPublicAssets: formatBytes(publicReport.totalPublicAssetBytes),
      },
      null,
      2,
    ),
  );

  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
