import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { projectRoot, syncCatalogData } from "./sync-catalog-data.mjs";

const CATALOGS = ["decks.json", "cases.json", "diagnostics.json"];

/**
 * `public/data/*.json` est un DÉRIVÉ de `src/content/data/*.json`, servi à
 * l'app par fetch("/data/…") — cf. src/content/catalog.ts. Un retard de la
 * copie publique sur la source affiche des chapitres « En préparation » en
 * production alors que le contenu existe : c'est le bug du lot des 43
 * démarches (source à 245 Ko / 43 cas, copie publique restée à ~6 cas).
 * Ce test verrouille le contrat du resynchroniseur.
 */
function makeWorkspace({ stale = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "catalog-sync-"));
  const srcDir = join(root, "src", "content", "data");
  const destDir = join(root, "public", "data");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(destDir, { recursive: true });
  for (const name of CATALOGS) {
    const source = join(projectRoot(), "src", "content", "data", name);
    writeFileSync(join(srcDir, name), readFileSync(source, "utf8"));
    if (stale) {
      // Copie publique volontairement périmée : un préfixe de la source.
      const text = readFileSync(source, "utf8");
      writeFileSync(join(destDir, name), text.slice(0, Math.floor(text.length / 2)));
    } else {
      copyFileSync(source, join(destDir, name));
    }
  }
  return { root, srcDir, destDir };
}

test("resynchronise une copie publique périmée depuis la source", () => {
  const { root, srcDir, destDir } = makeWorkspace({ stale: true });
  const synced = syncCatalogData({ root });
  assert.deepEqual(synced.sort(), [...CATALOGS].sort());
  for (const name of CATALOGS) {
    assert.equal(
      readFileSync(join(destDir, name), "utf8"),
      readFileSync(join(srcDir, name), "utf8"),
      `${name} doit être resynchronisé octet pour octet`,
    );
  }
});

test("est idempotent : une copie à jour n'est pas réécrite", () => {
  const { root } = makeWorkspace();
  assert.deepEqual(syncCatalogData({ root }), []);
});

test("préserve la copie quand la source est absente (repli explicite)", () => {
  const { root, destDir } = makeWorkspace();
  mkdirSync(join(root, "src", "content", "data", "absent"), { recursive: true });
  const before = readFileSync(join(destDir, "diagnostics.json"), "utf8");
  assert.deepEqual(syncCatalogData({ root: join(root, "absent") }), []);
  assert.equal(readFileSync(join(destDir, "diagnostics.json"), "utf8"), before);
});

test("au niveau du dépôt : après resynchronisation, public/data est identique à la source", () => {
  // Le check-out CI peut embarquer une copie publique périmée (elle est
  // resynchronisée au build) ; le resynchroniseur doit suffire à la réaligner.
  const root = projectRoot();
  syncCatalogData({ root });
  for (const name of CATALOGS) {
    const src = readFileSync(join(root, "src", "content", "data", name), "utf8");
    const dest = readFileSync(join(root, "public", "data", name), "utf8");
    assert.equal(dest, src, `public/data/${name} diverge de src/content/data/${name}`);
  }
});
