import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PERFORMANCE_BUDGET,
  findAssetDirectory,
  inspectPerformanceBudget,
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
