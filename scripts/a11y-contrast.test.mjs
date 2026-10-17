/* Garde-fou accessibilité (Session 14 — F46/F47, WCAG AA) :
   lit src/styles.css, extrait les blocs :root (clair) et html[data-theme="dark"],
   et verrouille le contraste des jetons de texte sur les deux surfaces de
   lecture (--app-bg et --app-card, dans chaque thème) :
   - texte (fg, muted, subtle, gold, warn, danger, success, info) ≥ 4,5:1 (WCAG 1.4.3)
   - indicateur de focus (--app-ring, non-texte) ≥ 3:1 (WCAG 1.4.11)
   Ne suit que les valeurs hexadécimales pures (#rrggbb) ; les jetons composés
   (color-mix, dégradés) restent hors périmètre — décoratifs ou documentés dans
   les commentaires de styles.css. Même contrat que les garde-fous de catalogue
   (demarches-catalog-integrity) : une palette qui dérive du AA fait échouer la CI. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STYLES_URL = new URL("../src/styles.css", import.meta.url);

function themeBlock(css, selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `Sélecteur introuvable dans styles.css : ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  assert.notEqual(close, -1, `Bloc non fermé pour : ${selector}`);
  return css.slice(open + 1, close);
}

function themeTokens(block) {
  const tokens = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(--app-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/);
    if (match) tokens[match[1]] = match[2];
  }
  return tokens;
}

function luminance(hex) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * channel(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * channel(parseInt(hex.slice(5, 7), 16))
  );
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_TOKENS = [
  "--app-fg",
  "--app-muted",
  "--app-subtle",
  "--app-gold",
  "--app-warn",
  "--app-danger",
  "--app-success",
  "--app-info",
];

const SURFACES = ["--app-bg", "--app-card"];

async function readThemes() {
  const css = await readFile(STYLES_URL, "utf8");
  return {
    clair: themeTokens(themeBlock(css, ":root")),
    sombre: themeTokens(themeBlock(css, 'html[data-theme="dark"]')),
  };
}

test("thème clair : jetons de texte ≥ 4,5:1 sur fond et carte (WCAG AA)", async () => {
  const { clair } = await readThemes();
  for (const token of TEXT_TOKENS) {
    assert.ok(clair[token] !== undefined, `Jeton manquant en thème clair : ${token}`);
    for (const surface of SURFACES) {
      const ratio = contrastRatio(clair[token], clair[surface]);
      assert.ok(
        ratio >= 4.5,
        `Contraste clair insuffisant : ${token} (${clair[token]}) sur ${surface} (${clair[surface]}) = ${ratio.toFixed(2)}:1 < 4,5:1`,
      );
    }
  }
});

test("thème sombre : jetons de texte ≥ 4,5:1 sur fond et carte (WCAG AA)", async () => {
  const { sombre } = await readThemes();
  for (const token of TEXT_TOKENS) {
    assert.ok(sombre[token] !== undefined, `Jeton manquant en thème sombre : ${token}`);
    for (const surface of SURFACES) {
      const ratio = contrastRatio(sombre[token], sombre[surface]);
      assert.ok(
        ratio >= 4.5,
        `Contraste sombre insuffisant : ${token} (${sombre[token]}) sur ${surface} (${sombre[surface]}) = ${ratio.toFixed(2)}:1 < 4,5:1`,
      );
    }
  }
});

test("indicateur de focus ≥ 3:1 sur fond et carte (WCAG 1.4.11, non-texte)", async () => {
  const { clair, sombre } = await readThemes();
  for (const [name, theme] of [["clair", clair], ["sombre", sombre]]) {
    assert.ok(theme["--app-ring"] !== undefined, `Jeton --app-ring manquant en thème ${name}`);
    for (const surface of SURFACES) {
      const ratio = contrastRatio(theme["--app-ring"], theme[surface]);
      assert.ok(
        ratio >= 3,
        `Contraste de focus ${name} insuffisant : --app-ring (${theme["--app-ring"]}) sur ${surface} (${theme[surface]}) = ${ratio.toFixed(2)}:1 < 3:1`,
      );
    }
  }
});
