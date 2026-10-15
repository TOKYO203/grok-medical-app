import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Phase 4 (UX « navigation classée ») : la navigation vit dans une source
// unique rangée par groupes. Ce garde-fou verrouille la systématisation :
// une seule taxonomie, des cibles réelles, des libellés traduits, et tous
// les points d'entrée (shell, tiroir mobile, palette) branchés dessus.
const navigation = readFileSync(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/shell.tsx", import.meta.url), "utf8");
const drawer = readFileSync(
  new URL("../src/components/mobile-tools-drawer.tsx", import.meta.url),
  "utf8",
);
const palette = readFileSync(new URL("../src/components/command-palette.tsx", import.meta.url), "utf8");
const frCatalog = readFileSync(new URL("../src/i18n/messages/fr.ts", import.meta.url), "utf8");
const enCatalog = readFileSync(new URL("../src/i18n/messages/en.ts", import.meta.url), "utf8");

// Valeurs littérales qui suivent un marqueur, jusqu'au guillemet fermant.
const quotedAfter = (source, marker) =>
  source.split(marker).slice(1).map((chunk) => chunk.slice(0, chunk.indexOf('"')));

test("la navigation vit dans une source unique consommée par tous les points d'entrée", () => {
  for (const entry of [["shell", shell], ["tiroir mobile", drawer], ["palette", palette]]) {
    assert.ok(
      entry[1].includes('from "@/lib/navigation"'),
      entry[0] + " doit importer la configuration centrale",
    );
  }
  assert.ok(!shell.includes("const NAV = ["), "le shell ne doit plus redéfinir NAV localement");
  assert.ok(!shell.includes("const EXPLORE = ["), "le shell ne doit plus redéfinir EXPLORE localement");
});

test("chaque cible configurée correspond à une route réellement déclarée", () => {
  const targets = quotedAfter(navigation, 'to: "');
  assert.ok(targets.length >= 15, "la configuration de navigation semble vide");
  for (const target of new Set(targets)) {
    const file = target === "/" ? "index" : target.slice(1);
    assert.ok(
      existsSync(new URL("../src/routes/" + file + ".tsx", import.meta.url)),
      "la cible " + target + " n'a pas de route src/routes/" + file + ".tsx",
    );
  }
});

test("l'explorateur est rangé en quatre groupes complets, sans doublon", () => {
  const explore = navigation.split("export const EXPLORE_GROUPS")[1] ?? "";
  assert.ok(explore.length > 0, "EXPLORE_GROUPS introuvable dans la source");
  const expected = [
    ["nav.group.learn", 3],
    ["nav.group.train", 4],
    ["nav.group.tools", 2],
    ["nav.group.community", 1],
  ];
  const chunks = explore.split('labelKey: "nav.group.');
  assert.equal(chunks.length - 1, expected.length, "l'explorateur doit compter exactement 4 groupes");
  const seen = new Set();
  for (let i = 0; i < expected.length; i++) {
    const key = expected[i][0];
    const minItems = expected[i][1];
    const chunk = chunks[i + 1];
    assert.ok(chunk.startsWith(key.slice("nav.group.".length)), "groupe absent ou mal ordonné : " + key);
    const items = quotedAfter(chunk, 'to: "');
    assert.ok(items.length >= minItems, "le groupe " + key + " semble incomplet");
    for (const target of items) {
      assert.ok(!seen.has(target), "doublon de cible entre les groupes : " + target);
      seen.add(target);
    }
  }
  assert.ok(!seen.has("/programme"), "/programme reste un onglet principal, pas une page secondaire");
});

test("chaque clé i18n référencée par la taxonomie est traduite en fr et en en", () => {
  const keys = new Set([
    ...quotedAfter(navigation, 'labelKey: "'),
    ...quotedAfter(navigation, 'shortKey: "'),
  ]);
  assert.ok(keys.size >= 20, "aucune clé de libellé détectée dans la taxonomie");
  for (const key of keys) {
    assert.ok(frCatalog.includes('"' + key + '":'), "clé absente du catalogue français : " + key);
    assert.ok(enCatalog.includes('"' + key + '":'), "clé absente du catalogue anglais : " + key);
  }
});

test("le tiroir mobile est un menu complet et accessible", () => {
  assert.ok(drawer.includes('role="dialog"'), "le tiroir doit être déclaré comme une boîte de dialogue");
  assert.ok(drawer.includes('aria-modal="true"'), "le tiroir doit être modal");
  assert.ok(drawer.includes("NAV.map"), "le tiroir doit exposer la navigation principale");
  assert.ok(drawer.includes("EXPLORE_GROUPS.map"), "le tiroir doit exposer les groupes Explorer");
  assert.ok(drawer.includes('aria-label={t("drawer.title")}'), "le tiroir doit porter un libellé traduit");
  assert.ok(drawer.includes("onClick={close}"), "le tiroir doit se fermer à la navigation");
  for (const key of ["drawer.openAria", "drawer.title", "drawer.settings", "drawer.appearance"]) {
    assert.ok(drawer.includes('"' + key + '"'), "clé de tiroir non branchée : " + key);
  }
});

test("la palette classe ses résultats et dérive ses pages de la taxonomie", () => {
  assert.ok(palette.includes("SECTION_ORDER"), "la palette doit définir un ordre de sections fixe");
  assert.ok(palette.includes("...NAV, ...EXPLORE_GROUPS"), "les pages doivent venir de la taxonomie centrale");
  assert.ok(palette.includes('kind === "page"'), "la requête vide doit limiter la palette au plan du site");
  for (const target of ["/donnees", "/a-propos", "/contact", "/soutenir", "/pro"]) {
    assert.ok(palette.includes('"' + target + '"'), "page extra absente de la palette : " + target);
  }
  assert.ok(palette.includes("palette.section."), "les sections doivent être libellées via l'i18n");
  assert.ok(palette.includes("palette.placeholder"), "la palette doit traduire son champ de recherche");
});
