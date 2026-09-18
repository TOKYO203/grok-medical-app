import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PERFORMANCE_BUDGET,
  findAssetDirectory,
  inspectPerformanceBudget,
  inspectPublicAssetBudget,
} from "./performance-budget.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "optimus-budget-"));
  const assets = join(root, ".vercel", "output", "static", "assets");
  mkdirSync(assets, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    writeFileSync(join(assets, name), Buffer.alloc(bytes));
  }
  return { root, assets };
}

function publicFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "optimus-public-budget-"));
  const publicDirectory = join(root, "public");
  for (const [name, bytes] of Object.entries(files)) {
    const target = join(publicDirectory, name);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, Buffer.alloc(bytes));
  }
  return { root, publicDirectory };
}

test("performance budget accepts the current V1 guard rails", () => {
  const { root, assets } = fixture({
    "index.js": 304 * 1024,
    "store.js": 202 * 1024,
    "styles.css": 53 * 1024,
  });
  assert.equal(findAssetDirectory(root), assets);
  const report = inspectPerformanceBudget(assets);
  assert.equal(report.ok, true);
  assert.equal(report.violations.length, 0);
});

test("one oversized client chunk fails the budget", () => {
  const { assets } = fixture({
    "too-large.js": PERFORMANCE_BUDGET.maxJavascriptChunkBytes + 1,
  });
  const report = inspectPerformanceBudget(assets);
  assert.equal(report.ok, false);
  assert.match(report.violations.join("\n"), /JS chunk/);
});

test("oversized CSS and aggregate JavaScript are independently rejected", () => {
  const { assets } = fixture({
    "styles.css": PERFORMANCE_BUDGET.maxStylesheetBytes + 1,
    "a.js": 390 * 1024,
    "b.js": 390 * 1024,
    "c.js": 390 * 1024,
    "d.js": 390 * 1024,
  });
  const report = inspectPerformanceBudget(assets);
  assert.equal(report.ok, false);
  assert.match(report.violations.join("\n"), /stylesheet/);
  assert.match(report.violations.join("\n"), /total client JS/);
});

test("public static assets stay within a mobile-friendly budget", () => {
  const { publicDirectory } = publicFixture({
    "favicon.svg": 8 * 1024,
    "profile-covers/baobabs.webp": 110 * 1024,
    "profile-covers/hautes-terres.webp": 90 * 1024,
    "__grok/install/phone.png": 120 * 1024,
  });
  const report = inspectPublicAssetBudget(publicDirectory);
  assert.equal(report.ok, true);
  assert.equal(report.violations.length, 0);
  assert.equal(report.publicAssetFiles, 4);
});

test("one oversized public asset fails the build budget", () => {
  const { publicDirectory } = publicFixture({
    "profile-covers/huge.svg": PERFORMANCE_BUDGET.maxPublicAssetBytes + 1,
  });
  const report = inspectPublicAssetBudget(publicDirectory);
  assert.equal(report.ok, false);
  assert.match(report.violations.join("\n"), /public asset/);
});

test("aggregate public assets are also bounded", () => {
  const half = Math.floor(PERFORMANCE_BUDGET.maxTotalPublicAssetBytes / 2);
  const { publicDirectory } = publicFixture({
    "a.bin": half,
    "b.bin": half,
    "c.bin": 2,
  });
  const report = inspectPublicAssetBudget(publicDirectory, {
    ...PERFORMANCE_BUDGET,
    maxPublicAssetBytes: PERFORMANCE_BUDGET.maxTotalPublicAssetBytes,
  });
  assert.equal(report.ok, false);
  assert.match(report.violations.join("\n"), /total public assets/);
});
