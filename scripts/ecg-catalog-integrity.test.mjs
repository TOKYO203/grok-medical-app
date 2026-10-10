import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
const ecgDirectory = new URL("../src/content/data/ecg/", import.meta.url);

/**
 * Garde-fou du catalogue ECG (bug « Cas ECG introuvable », 2026-10-10) :
 * `_index.json` liste 23 cas, mais `catalog.ts` n'enregistrait que `normal-001.json`.
 * Résultat : `getEcg()` renvoyait `undefined` pour 22 cas → la page détail affichait
 * « Cas ECG introuvable ». Ce test verrouille la correspondance index ↔ contenu,
 * et la précision clinique : `ischemia: "lesion-sous-epicardique"` UNIQUEMENT
 * sur les 2 cas IDM (ecg-1-2-idm-etalonnage, ecg-4-6-pacemaker-idm).
 */
test("every indexed ECG case is registered in the catalog loader", async () => {
  const [indexRaw, catalogSource] = await Promise.all([
    read("src/content/data/ecg/_index.json"),
    read("src/lib/ecg/catalog.ts"),
  ]);
  const index = JSON.parse(indexRaw);

  assert.equal(new Set(index.cases.map((c) => c.id)).size, index.cases.length, "duplicate ECG id");

  for (const entry of index.cases) {
    assert.match(
      catalogSource,
      new RegExp(`"${entry.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`),
      `catalog.ts does not register ${entry.file} (case ${entry.id} → "Cas ECG introuvable")`,
    );
  }
});

test("every ECG JSON file on disk is referenced by the index", async () => {
  const [indexRaw, files] = await Promise.all([read("src/content/data/ecg/_index.json"), readdir(ecgDirectory)]);
  const index = JSON.parse(indexRaw);
  const referenced = new Set(index.cases.map((c) => c.file));
  for (const file of files.filter((f) => f.endsWith(".json") && f !== "_index.json")) {
    assert.ok(referenced.has(file), `${file} is orphaned (not listed in _index.json)`);
  }
});

test("ischemia lesion-sous-epicardique is set on exactly the two IDM cases", async () => {
  const files = await readdir(ecgDirectory);
  const ischemic = [];
  for (const file of files.filter((f) => f.endsWith(".json") && f !== "_index.json")) {
    const data = JSON.parse(await read(`src/content/data/ecg/${file}`));
    if (data.ischemia === "lesion-sous-epicardique") ischemic.push(file);
  }
  assert.deepEqual(ischemic.sort(), ["ecg-1-2-idm-etalonnage.json", "ecg-4-6-pacemaker-idm.json"]);
});

test("catalog exposes an integrity helper for indexed-but-unregistered cases", async () => {
  const catalogSource = await read("src/lib/ecg/catalog.ts");
  assert.match(catalogSource, /export function missingEcgFiles/);
});
