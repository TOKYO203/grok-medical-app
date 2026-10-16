import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const dir = new URL("../src/content/data/demarches/", import.meta.url);
const readJson = (name) => readFile(new URL(name, dir), "utf8").then(JSON.parse);

const [index, diagnostics] = await Promise.all([
  readJson("_index.json"),
  readFile(new URL("../src/content/data/diagnostics.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
]);

const TONES = new Set(["urgence", "prudence", "reflexe", "retenir", "memo"]);
const DIAGNOSTIC_IDS = new Set(diagnostics.map((diagnostic) => diagnostic.id));

/** Fichiers réellement présents dans le dossier (hors manifeste). */
const presentFiles = new Set(
  (await readdir(dir)).filter((name) => name.endsWith(".json") && name !== "_index.json"),
);

const availableEntries = index.demarches.filter((entry) => entry.status === "available");

test("le manifeste des démarches pointe vers des fichiers existants et des QCM connus", () => {
  assert.ok(Array.isArray(index.demarches) && index.demarches.length >= 1, "manifeste vide");

  for (const key of ["slug", "diagnosticId"]) {
    const values = index.demarches.map((entry) => entry[key]);
    assert.equal(new Set(values).size, values.length, `${key}: doublon dans le manifeste`);
  }

  for (const entry of index.demarches) {
    assert.ok(DIAGNOSTIC_IDS.has(entry.diagnosticId), `QCM inconnu : ${entry.diagnosticId}`);
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug invalide : ${entry.slug}`);
    assert.ok(["available", "planned"].includes(entry.status), `statut invalide : ${entry.status}`);
    assert.ok(presentFiles.has(entry.file), `fichier déclaré absent : ${entry.file}`);
  }
});

test("aucun fichier de démarche n'est orphelin (tout fichier est déclaré)", () => {
  const declared = new Set(index.demarches.map((entry) => entry.file));
  for (const file of presentFiles) {
    assert.ok(declared.has(file), `fichier orphelin (non déclaré dans _index.json) : ${file}`);
  }
});

test("chaque démarche disponible est complète et rattachée au bon QCM", async () => {
  assert.ok(availableEntries.length >= 1, "aucune démarche disponible");

  for (const entry of availableEntries) {
    const content = await readJson(entry.file);

    assert.equal(content.diagnosticId, entry.diagnosticId, `${entry.file}: diagnosticId divergent`);
    assert.equal(content.slug, entry.slug, `${entry.file}: slug divergent`);
    assert.ok(content.title?.trim().length >= 4, `${entry.file}: titre trop court`);
    assert.ok(content.objective?.trim().length >= 20, `${entry.file}: objectif trop court`);
    assert.match(content.updatedAt, /^\d{4}-\d{2}-\d{2}$/, `${entry.file}: date invalide`);

    // 1. Fiche — sections, blocs, tons
    assert.ok(content.sections.length >= 3, `${entry.file}: trop peu de sections`);
    const sectionIds = content.sections.map((section) => section.id);
    assert.equal(new Set(sectionIds).size, sectionIds.length, `${entry.file}: section id dupliqué`);

    const tonesSeen = new Set();
    for (const section of content.sections) {
      assert.ok(section.title?.trim(), `${entry.file}/${section.id}: titre de section absent`);
      assert.ok(section.blocks.length >= 1, `${entry.file}/${section.id}: section vide`);
      for (const block of section.blocks) {
        if (block.type === "paragraph") {
          assert.ok(block.text?.trim().length >= 20, `${entry.file}/${section.id}: paragraphe trop court`);
        } else if (block.type === "list") {
          assert.ok(block.items?.length >= 1, `${entry.file}/${section.id}: liste vide`);
          for (const item of block.items) {
            assert.ok(item?.trim().length >= 5, `${entry.file}/${section.id}: item trop court`);
          }
        } else if (block.type === "table") {
          assert.ok(block.columns?.length >= 2, `${entry.file}/${section.id}: colonnes insuffisantes`);
          assert.ok(block.rows?.length >= 1, `${entry.file}/${section.id}: table sans ligne`);
          for (const row of block.rows) {
            assert.equal(
              row.length,
              block.columns.length,
              `${entry.file}/${section.id}: ligne de table mal alignée`,
            );
          }
        } else if (block.type === "callout") {
          assert.ok(TONES.has(block.tone), `${entry.file}/${section.id}: ton de callout invalide`);
          assert.ok(block.title?.trim(), `${entry.file}/${section.id}: callout sans titre`);
          assert.ok(block.text?.trim().length >= 20, `${entry.file}/${section.id}: callout trop court`);
          tonesSeen.add(block.tone);
        } else {
          assert.fail(`${entry.file}/${section.id}: type de bloc inconnu « ${block.type} »`);
        }
      }
    }

    // Les trois encadrés exigés par le cahier des charges doivent exister.
    for (const tone of ["urgence", "prudence", "reflexe"]) {
      assert.ok(tonesSeen.has(tone), `${entry.file}: aucun encadré « ${tone} »`);
    }

    // 2. Mnémotechniques
    const mnemonicIds = content.mnemonics.map((m) => m.id);
    assert.equal(new Set(mnemonicIds).size, mnemonicIds.length, `${entry.file}: mnémo id dupliqué`);
    for (const mnemonic of content.mnemonics) {
      assert.ok(mnemonic.label?.trim(), `${entry.file}: mnémo sans label`);
      assert.ok(mnemonic.entries?.length >= 2, `${entry.file}/${mnemonic.id}: mnémo trop court`);
      for (const entryM of mnemonic.entries) {
        assert.ok(entryM.key?.trim() && entryM.term?.trim(), `${entry.file}/${mnemonic.id}: entrée incomplète`);
      }
    }

    // 3. Flashcards
    assert.ok(content.flashcards.length >= 8, `${entry.file}: trop peu de flashcards`);
    const cardIds = content.flashcards.map((card) => card.id);
    assert.equal(new Set(cardIds).size, cardIds.length, `${entry.file}: flashcard id dupliqué`);
    for (const card of content.flashcards) {
      assert.ok(card.front?.trim().length >= 8, `${entry.file}/${card.id}: recto trop court`);
      assert.ok(card.back?.trim().length >= 8, `${entry.file}/${card.id}: verso trop court`);
    }

    // 4. Mindmap — graphe valide et identifiants uniques
    const mapIds = [content.mindmap.root.id];
    assert.ok(content.mindmap.root.label?.trim(), `${entry.file}: racine sans label`);
    assert.ok(content.mindmap.root.detail?.trim(), `${entry.file}: racine sans détail`);
    assert.ok(content.mindmap.branches.length >= 4, `${entry.file}: trop peu de branches`);
    for (const branch of content.mindmap.branches) {
      mapIds.push(branch.id);
      assert.ok(branch.label?.trim(), `${entry.file}/${branch.id}: branche sans label`);
      assert.ok(branch.detail?.trim().length >= 20, `${entry.file}/${branch.id}: branche sans détail`);
      assert.ok(branch.children?.length >= 1, `${entry.file}/${branch.id}: branche sans enfant`);
      if (branch.tone) assert.ok(TONES.has(branch.tone), `${entry.file}/${branch.id}: ton invalide`);
      for (const child of branch.children) {
        mapIds.push(child.id);
        assert.ok(child.label?.trim(), `${entry.file}/${branch.id}: enfant sans label`);
        for (const leaf of child.leaves ?? []) {
          mapIds.push(leaf.id);
          assert.ok(leaf.label?.trim(), `${entry.file}/${branch.id}: feuille sans label`);
        }
      }
    }
    assert.equal(new Set(mapIds).size, mapIds.length, `${entry.file}: identifiant de mindmap dupliqué`);

    // 5. Références transportables (miroir de catalog-integrity)
    assert.ok(content.sources.length >= 2, `${entry.file}: références absentes`);
    for (const source of content.sources) {
      assert.ok(source.title?.trim(), `${entry.file}: source sans titre`);
      assert.ok(source.citation?.trim(), `${entry.file}: source sans citation`);
      if (source.url) assert.match(source.url, /^https:\/\//, `${entry.file}: URL non HTTPS`);
      if (source.verifiedAt) {
        assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${entry.file}: date de vérification invalide`);
      }
    }
  }
});
