import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Garde-fou qualité (Phase 5 — contrôle qualité) : l'app est déployée sur Netlify.
// La télémétrie Vercel (@vercel/analytics, @vercel/speed-insights) injectait des
// scripts /_vercel/* qui renvoyaient 404 en production — du bruit console pour
// chaque visiteur. Ces tests verrouillent le retrait : plus d'injection, plus de
// dépendance déclarée, et surtout plus de stub QA qui masquerait un éventuel
// retour de ce bruit en CI.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("la racine du document n'injecte plus de scripts télémétriques Vercel", () => {
  const root = read("../src/routes/__root.tsx");
  assert.ok(
    !root.includes("@vercel/analytics"),
    "@vercel/analytics ne doit plus être importé dans __root.tsx",
  );
  assert.ok(
    !root.includes("@vercel/speed-insights"),
    "@vercel/speed-insights ne doit plus être importé dans __root.tsx",
  );
  assert.ok(!root.includes("/_vercel"), "aucune requête /_vercel ne doit partir de la racine");
});

test("package.json ne déclare plus les paquets télémétriques Vercel", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.ok(
    !(pkg.dependencies ?? {})["@vercel/analytics"],
    "@vercel/analytics doit rester retiré des dépendances",
  );
  assert.ok(
    !(pkg.dependencies ?? {})["@vercel/speed-insights"],
    "@vercel/speed-insights doit rester retiré des dépendances",
  );
});

test("aucun script QA ne masque les requêtes /_vercel (fin du stubbing)", () => {
  const scriptsDir = new URL("../scripts/", import.meta.url);
  for (const name of readdirSync(scriptsDir)) {
    if (!name.endsWith(".mjs")) continue;
    // Ce garde-fou énonce le motif interdit : il ne se scanne pas lui-même.
    if (name === "quality-console.test.mjs") continue;
    const content = readFileSync(new URL(name, scriptsDir), "utf8");
    assert.ok(
      !content.includes("**/_vercel/**"),
      "le script " + name + " ne doit pas stubber les URLs /_vercel : masquer un 404 environnemental revient à cacher une régression",
    );
  }
});

test("la locale reste synchronisée avec l'attribut lang du document", () => {
  const i18n = read("../src/i18n/index.ts");
  assert.ok(
    i18n.includes("document.documentElement.lang"),
    "la synchronisation de <html lang> avec la locale active doit être conservée",
  );
});

test("aucun console.log oublié dans le code applicatif", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(new URL(entry.name + "/", dir));
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      const lines = readFileSync(new URL(entry.name, dir), "utf8").split("\n");
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (line.includes("console.log(") || line.includes("console.debug(")) {
          offenders.push(entry.name + " ligne " + (index + 1));
        }
      });
    }
  };
  walk(new URL("../src/", import.meta.url));
  assert.deepEqual(
    offenders,
    [],
    "console.log/console.debug interdits dans src/ : " + offenders.join(", "),
  );
});
