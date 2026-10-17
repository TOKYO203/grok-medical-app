import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Garde-fou du Design System (Session A).
 *
 * Il verrouille le CONTRAT public des fondations : les 9 niveaux typographiques,
 * l'échelle d'espacement strictement multiple de 4 px, les rayons / ombres, les
 * 5 tones sémantiques et leurs états, l'absence de couleur codée en dur dans les
 * composants pilotes, et le verrouillage DEV de la vitrine `/kitchen-sink`.
 */

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [tokensCss, stylesCss, buttonSource, cardSource, badgeSource, devLayout, kitchenSink, shell, navigation, routeTree] =
  await Promise.all([
    read("src/styles/tokens.css"),
    read("src/styles.css"),
    read("src/components/ui/ds/Button.tsx"),
    read("src/components/ui/ds/Card.tsx"),
    read("src/components/ui/ds/Badge.tsx"),
    read("src/routes/_dev.tsx"),
    read("src/routes/_dev.kitchen-sink.tsx"),
    read("src/components/shell.tsx"),
    read("src/lib/navigation.ts"),
    read("src/routeTree.gen.ts"),
  ]);

const TYPE_LEVELS = [
  "display-xl",
  "display-lg",
  "display-md",
  "title-lg",
  "title",
  "subtitle",
  "body",
  "body-sm",
  "micro",
];

const TONES = ["danger", "warn", "info", "success", "accent"];

const DARK_BLOCK = tokensCss.slice(tokensCss.indexOf('html[data-theme="dark"]'));

test("styles.css importe les tokens en tête, avant toute règle", () => {
  const tokenImport = stylesCss.indexOf('@import "./styles/tokens.css";');
  assert.ok(tokenImport >= 0, "import de src/styles/tokens.css absent");
  assert.equal(
    stylesCss.split('@import "./styles/tokens.css";').length - 1,
    1,
    "les tokens doivent être importés une seule fois",
  );

  for (const marker of ["@theme {", ":root {", "@layer base", "@layer components"]) {
    const index = stylesCss.indexOf(marker);
    assert.ok(index > tokenImport, `l'import des tokens doit précéder « ${marker} »`);
  }
});

test("typographie : 9 niveaux, chacun avec taille + interlignage + approche", () => {
  for (const level of TYPE_LEVELS) {
    for (const prefix of ["fs", "lh", "tr"]) {
      assert.ok(
        new RegExp(`--${prefix}-${level.replace(/-/g, "\\-")}\\s*:`).test(tokensCss),
        `jeton manquant : --${prefix}-${level}`,
      );
    }
    assert.ok(tokensCss.includes(`.type-${level}`), `classe manquante : .type-${level}`);
  }

  // Les classes composées doivent rester dans `components` : les utilitaires
  // Tailwind (`text-sm`, `text-danger`) doivent pouvoir les surcharger.
  const componentsLayer = tokensCss.indexOf("@layer components");
  assert.ok(componentsLayer >= 0, "couche `components` absente");
  for (const level of TYPE_LEVELS) {
    assert.ok(
      tokensCss.indexOf(`.type-${level}`) > componentsLayer,
      `.type-${level} doit être déclarée dans @layer components`,
    );
  }
});

test("espacement : pas strict de 4 px, --sp-1 → --sp-16", () => {
  const steps = new Map();
  for (const match of tokensCss.matchAll(/--sp-(\d+)\s*:\s*(\d+)px;/g)) {
    steps.set(Number(match[1]), Number(match[2]));
  }

  assert.equal(steps.size, 16, `16 pas attendus, ${steps.size} trouvés`);
  for (let step = 1; step <= 16; step += 1) {
    assert.equal(steps.get(step), step * 4, `--sp-${step} doit valoir ${step * 4}px`);
  }
});

test("rayons : --r-sm 6 px → --r-xl 20 px (+ pilule)", () => {
  const radii = new Map();
  for (const match of tokensCss.matchAll(/--r-(sm|md|lg|xl)\s*:\s*(\d+)px;/g)) {
    radii.set(match[1], Number(match[2]));
  }

  assert.deepEqual(Object.fromEntries(radii), { sm: 6, md: 10, lg: 14, xl: 20 });
  assert.match(tokensCss, /--r-pill\s*:\s*999px;/, "rayon pilule manquant (Badge)");
});

test("ombres : subtle / medium / overlay, redéfinies en thème sombre", () => {
  for (const shadow of ["subtle", "medium", "overlay"]) {
    assert.ok(
      new RegExp(`--sh-${shadow}\\s*:`).test(tokensCss),
      `ombre manquante : --sh-${shadow}`,
    );
    assert.ok(
      DARK_BLOCK.includes(`--sh-${shadow}:`),
      `--sh-${shadow} doit être redéfinie en thème sombre`,
    );
  }
});

test("tones : 5 tons sémantiques × 6 déclinaisons, mappés sur la palette Oxford", () => {
  for (const tone of TONES) {
    for (const suffix of ["", "-hover", "-soft", "-border", "-fg", "-disabled"]) {
      assert.ok(
        new RegExp(`--tone-${tone}${suffix}\\s*:`).test(tokensCss),
        `jeton manquant : --tone-${tone}${suffix}`,
      );
    }

    // La base doit pointer vers un jeton de thème (--app-*), jamais une couleur
    // littérale : c'est ce qui garantit le suivi clair / sombre.
    assert.match(
      tokensCss,
      new RegExp(`--tone-${tone}\\s*:\\s*var\\(--app-[a-z]+\\);`),
      `--tone-${tone} doit être mappé sur une variable --app-*`,
    );
    assert.ok(
      DARK_BLOCK.includes(`--tone-${tone}-hover:`),
      `--tone-${tone}-hover doit être redéfinie en thème sombre`,
    );
  }
});

test("composants pilotes : exports, états et zéro couleur codée en dur", () => {
  const components = [
    { name: "Button", source: buttonSource },
    { name: "Card", source: cardSource },
    { name: "Badge", source: badgeSource },
  ];

  for (const { name, source } of components) {
    assert.match(
      source,
      new RegExp(`export function ${name}\\(`),
      `${name} doit être exporté nommément`,
    );
    assert.doesNotMatch(
      source,
      /#[0-9a-fA-F]{3,8}\b/,
      `${name} ne doit contenir aucune couleur hexadécimale (tokens uniquement)`,
    );
    assert.ok(
      source.includes("var(--"),
      `${name} doit consommer au moins un jeton CSS (var(--…))`,
    );
  }

  assert.match(buttonSource, /loading\?: boolean/, "Button.loading manquant");
  assert.match(buttonSource, /aria-busy=/, "Button doit exposer aria-busy en chargement");
  assert.match(buttonSource, /data-loading=/, "Button doit exposer data-loading (QA)");
  assert.match(cardSource, /padding\?: CardPadding/, "Card.padding manquant");
  assert.match(cardSource, /interactive\?: boolean/, "Card.interactive manquant");
  assert.match(cardSource, /selected\?: boolean/, "Card.selected manquant");
  assert.match(badgeSource, /tone\?: BadgeTone/, "Badge.tone manquant");
  assert.match(badgeSource, /size\?: BadgeSize/, "Badge.size manquant");
});

test("kitchen-sink : route DEV verrouillée en production", () => {
  assert.match(
    devLayout,
    /if \(!import\.meta\.env\.DEV\) throw notFound\(\);/,
    "le layout _dev doit lever notFound() hors développement",
  );
  assert.match(kitchenSink, /createFileRoute\("\/_dev\/kitchen-sink"\)/, "route déclarée absente");
  assert.match(
    routeTree,
    /["']\/_dev\/kitchen-sink["']/,
    "src/routeTree.gen.ts n'a pas été régénéré (route absente)",
  );
  assert.match(
    routeTree,
    /path: ['"]\/kitchen-sink['"]/,
    "la route DEV doit répondre sur /kitchen-sink",
  );

  // La vitrine ne doit jamais être atteignable depuis la navigation.
  assert.ok(!shell.includes("kitchen-sink"), "shell.tsx ne doit pas lier /kitchen-sink");
  assert.ok(!navigation.includes("kitchen-sink"), "navigation.ts ne doit pas lier /kitchen-sink");
});
