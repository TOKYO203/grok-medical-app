import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/** Renvoie le contenu d'un bloc CSS `selector { … }` (non imbriqué). */
function block(selector, label) {
  const match = styles.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing CSS block: ${label}`);
  return match[1];
}

/** Associe chaque `--app-*` hexadécimal d'un bloc à sa valeur. */
function appPalette(source) {
  const map = new Map();
  for (const match of source.matchAll(/(--app-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

/**
 * Le thème clair est le défaut (`:root`), le thème sombre surcharge via
 * `html[data-theme="dark"]`. On teste les deux palettes.
 */
const THEMES = {
  light: appPalette(block(":root", ":root")),
  dark: appPalette(block('html\\[data-theme="dark"\\]', 'html[data-theme="dark"]')),
};

/** Table `--color-x -> var(--app-y)` déclarée dans le bloc `@theme`. */
const SEMANTIC_TO_APP = (() => {
  const map = new Map();
  for (const match of block("@theme", "@theme").matchAll(
    /--color-([a-z0-9-]+):\s*var\((--app-[a-z0-9-]+)\)/g,
  )) {
    map.set(match[1], match[2]);
  }
  return map;
})();

function token(theme, name) {
  const appToken = SEMANTIC_TO_APP.get(name);
  assert.ok(appToken, `missing --color-${name} mapping in @theme`);
  const value = THEMES[theme].get(appToken);
  assert.ok(value, `missing ${appToken} in ${theme} palette`);
  return value;
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

function assertNormalTextContrast(theme, foregroundToken, backgroundToken) {
  const foreground = token(theme, foregroundToken);
  const background = token(theme, backgroundToken);
  const ratio = contrast(foreground, background);
  assert.ok(
    ratio >= 4.5,
    `[${theme}] ${foregroundToken} on ${backgroundToken} contrast ${ratio.toFixed(2)} is below 4.5:1`,
  );
}

for (const theme of ["light", "dark"]) {
  test(`[${theme}] core small-text palette meets WCAG AA contrast on app surfaces`, () => {
    for (const foreground of ["fg", "muted", "subtle", "primary", "danger"]) {
      assertNormalTextContrast(theme, foreground, "bg");
      assertNormalTextContrast(theme, foreground, "card");
    }
  });

  test(`[${theme}] primary button foreground remains readable on primary`, () => {
    assertNormalTextContrast(theme, "primary-fg", "primary");
  });
}
