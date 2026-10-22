import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const themeSource = readFileSync(join(root, "src", "lib", "theme.ts"), "utf8");
const stylesSource = readFileSync(join(root, "src", "styles.css"), "utf8");
const toggleSource = readFileSync(join(root, "src", "components", "theme-toggle.tsx"), "utf8");
const profilSource = readFileSync(join(root, "src", "routes", "profil.tsx"), "utf8");

/* Fonds de référence des blocs de base — verrouillés par a11y-contrast.test.mjs
   et color-contrast.test.mjs. L'accent doit rester lisible dessus dans les
   DEUX thèmes : c'est le contrat de la palette (elle colore clair, sombre ET
   système). */
const BASE = {
  light: { bg: "#EDE0C8", card: "#FFFFFF" },
  dark: { bg: "#0c1110", card: "#161d1b" },
};

function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Extrait le corps du bloc CSS d'un sélecteur littéral (échappé pour regex). */
function blockFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(escaped + "\\s*\\{([^}]+)\\}"))?.[1] ?? "";
}

const catalog = themeSource.match(/export const ACCENT_PALETTES[^=]+=\s*\[([^\]]*)\]/)?.[1] ?? "";
const palettes = catalog
  .split(",")
  .map((part) => part.trim().replace(/"/g, ""))
  .filter(Boolean);

test("accent palettes are declared, styled and offered end to end", () => {
  // Régression possible : ajouter une palette dans theme.ts sans ses blocs CSS,
  // sa pastille de sélecteur ou son entrée de radiogroup — l'UI offrirait alors
  // un bouton muet qui ne change rien.
  assert.ok(palettes.length >= 2, "catalogue ACCENT_PALETTES introuvable dans theme.ts");
  assert.ok(
    palettes.includes("defaut"),
    "la palette « defaut » doit exister (repli sans bloc CSS dédié : l'or Oxford de base EST le défaut)",
  );
  for (const id of palettes) {
    assert.ok(
      stylesSource.includes(`--accent-swatch-${id}:`),
      `${id} : pastille --accent-swatch-${id} manquante dans styles.css`,
    );
    assert.ok(
      toggleSource.includes(`id: "${id}"`),
      `${id} : absente du AccentSelector (theme-toggle.tsx)`,
    );
    assert.ok(
      toggleSource.includes(`var(--accent-swatch-${id})`),
      `${id} : le sélecteur ne consomme pas la pastille --accent-swatch-${id}`,
    );
    if (id === "defaut") continue;
    assert.ok(
      stylesSource.includes(`html[data-accent="${id}"]`),
      `${id} : bloc clair manquant dans styles.css`,
    );
    assert.ok(
      stylesSource.includes(`html[data-theme="dark"][data-accent="${id}"]`),
      `${id} : bloc sombre manquant dans styles.css (sans lui, le bloc clair gagnerait en thème sombre)`,
    );
  }
  assert.ok(
    profilSource.includes("<AccentSelector"),
    "profil.tsx n'expose pas l'AccentSelector",
  );
});

test("boot script applies the accent before first paint", () => {
  // Sans data-accent posé dans <head> avant le premier paint, le flash
  // or → palette serait visible à chaque chargement de page.
  assert.ok(themeSource.includes("ACCENT_STORAGE_KEY"), "clé de stockage de l'accent manquante");
  const boot = themeSource.match(/THEME_BOOT_SCRIPT = `([^`]*)`/)?.[1] ?? "";
  assert.ok(
    boot.includes("data-accent"),
    "le script de boot ne pose pas data-accent avant le premier paint",
  );
  // La clé est interpolée depuis ACCENT_STORAGE_KEY (template literal) : on
  // vérifie l'interpolation dans la source plutôt que la valeur littérale.
  assert.ok(
    themeSource.includes("localStorage.getItem('${ACCENT_STORAGE_KEY}')"),
    "le script de boot ne relit pas la clé de stockage de l'accent",
  );
});

test("accent gold and ring stay AA on both themes", () => {
  // Même contrat que a11y-contrast.test.mjs, appliqué aux blocs de palette
  // (que ce test ne scanne pas) : --app-gold ≥ 4,5:1 sur --app-bg et
  // --app-card, --app-ring ≥ 3:1 (WCAG 1.4.11), clair ET sombre.
  for (const id of palettes) {
    if (id === "defaut") continue; // or Oxford de base déjà verrouillé par a11y-contrast
    for (const [theme, base] of Object.entries(BASE)) {
      const selector =
        theme === "light" ? `html[data-accent="${id}"]` : `html[data-theme="dark"][data-accent="${id}"]`;
      const block = blockFor(stylesSource, selector);
      assert.ok(block.length > 0, `${id}/${theme} : bloc CSS introuvable (${selector})`);
      const gold = block.match(/--app-gold:\s*(#[0-9A-Fa-f]{6})\s*;/)?.[1];
      const ring = block.match(/--app-ring:\s*(#[0-9A-Fa-f]{6})\s*;/)?.[1];
      assert.ok(gold, `${id}/${theme} : --app-gold introuvable`);
      assert.ok(ring, `${id}/${theme} : --app-ring introuvable`);
      assert.ok(
        contrast(gold, base.bg) >= 4.5,
        `${id}/${theme} : --app-gold ${gold} ne donne que ${contrast(gold, base.bg).toFixed(2)}:1 sur --app-bg (AA ≥ 4,5:1)`,
      );
      assert.ok(
        contrast(gold, base.card) >= 4.5,
        `${id}/${theme} : --app-gold ${gold} ne donne que ${contrast(gold, base.card).toFixed(2)}:1 sur --app-card (AA ≥ 4,5:1)`,
      );
      assert.ok(
        contrast(ring, base.bg) >= 3,
        `${id}/${theme} : --app-ring ${ring} ne donne que ${contrast(ring, base.bg).toFixed(2)}:1 sur --app-bg (WCAG 1.4.11 ≥ 3:1)`,
      );
      assert.ok(
        contrast(ring, base.card) >= 3,
        `${id}/${theme} : --app-ring ${ring} ne donne que ${contrast(ring, base.card).toFixed(2)}:1 sur --app-card (WCAG 1.4.11 ≥ 3:1)`,
      );
    }
  }
});
