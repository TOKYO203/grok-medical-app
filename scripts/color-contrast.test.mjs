import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function token(name) {
  const match = styles.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `missing --color-${name}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function assertNormalTextContrast(foregroundToken, backgroundToken) {
  const foreground = token(foregroundToken);
  const background = token(backgroundToken);
  const ratio = contrast(foreground, background);
  assert.ok(
    ratio >= 4.5,
    `${foregroundToken} on ${backgroundToken} contrast ${ratio.toFixed(2)} is below 4.5:1`,
  );
}

test("core small-text palette meets WCAG AA contrast on app surfaces", () => {
  for (const foreground of ["fg", "muted", "subtle", "primary", "danger"]) {
    assertNormalTextContrast(foreground, "bg");
    assertNormalTextContrast(foreground, "card");
  }
});

test("primary button foreground remains readable on primary", () => {
  assertNormalTextContrast("primary-fg", "primary");
});
