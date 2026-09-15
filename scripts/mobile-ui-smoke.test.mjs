import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exitCodeFor } from "./browser-smoke-verdict.mjs";

const source = readFileSync(new URL("./mobile-ui-smoke.mjs", import.meta.url), "utf8");

test("small-screen smoke covers 320 360 and 390 pixel widths", () => {
  assert.match(source, /width:\s*320/);
  assert.match(source, /width:\s*360/);
  assert.match(source, /width:\s*390/);
});

test("small-screen smoke covers the primary Optimus routes", () => {
  for (const route of ["/", "/parcours", "/cas", "/profil", "/pro"]) {
    assert.ok(source.includes(JSON.stringify(route)), `missing route ${route}`);
  }
});

test("horizontal overflow is a failing browser-smoke condition", () => {
  assert.equal(
    exitCodeFor({
      mobile320: {
        status: 200,
        horizontalOverflow: true,
        consoleErrors: [],
        pageErrors: [],
      },
    }),
    1,
  );
});

test("mobile navigation targets are audited at 44 CSS pixels", () => {
  assert.match(source, /target\.width < 44 \|\| target\.height < 44/);
  assert.match(source, /Navigation principale/);
});
