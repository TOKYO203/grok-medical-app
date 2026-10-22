import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PERFORMANCE_BUDGET } from "./performance-budget.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const routeSource = readFileSync(join(root, "src", "routes", "profil.tsx"), "utf8");
const typesSource = readFileSync(join(root, "src", "core", "types.ts"), "utf8");
const coversDirectory = join(root, "public", "profile-covers");

test("every built-in profile cover resolves to a published file", () => {
  // Régression du 2026-10-09 (d11a819) : clinique.jpg avait été retiré de
  // public/ sans mettre à jour la page — la 4e couverture pointait dans le
  // vide. Un chemin référencé par le sélecteur doit TOUJOURS exister.
  const refs = [...new Set(routeSource.match(/\/profile-covers\/[A-Za-z0-9._-]+/g) ?? [])];
  assert.ok(refs.length >= 4, "profil.tsx ne référence aucune photo de couverture");
  for (const ref of refs) {
    const file = join(root, "public", ref);
    assert.ok(existsSync(file), `${ref} : fichier manquant dans public/`);
  }
});

test("every CoverId of the union is offered by the profile picker", () => {
  const union = typesSource.match(/export type CoverId =([^;]+);/)?.[1] ?? "";
  const ids = union
    .split("|")
    .map((part) => part.trim().replace(/"/g, ""))
    .filter(Boolean);
  assert.ok(ids.length >= 5, "union CoverId introuvable dans src/core/types.ts");
  for (const id of ids) {
    if (id === "custom") continue;
    assert.ok(
      routeSource.includes(`id: "${id}"`),
      `${id} : déclaré dans CoverId mais absent du sélecteur de couverture`,
    );
  }
});

test("published cover assets stay within the mobile budget", () => {
  const names = readdirSync(coversDirectory);
  assert.ok(names.length >= 7, "le catalogue de couvertures est vide");
  for (const name of names) {
    const file = join(coversDirectory, name);
    const bytes = statSync(file).size;
    assert.ok(
      bytes <= PERFORMANCE_BUDGET.maxPublicAssetBytes,
      `${name} dépasse le budget par actif public`,
    );
    if (name.endsWith(".svg")) {
      const source = readFileSync(file, "utf8");
      assert.ok(source.includes("<svg"), `${name} n'est pas un SVG valide`);
    }
  }
});
