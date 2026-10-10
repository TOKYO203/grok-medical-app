import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const dataDir = new URL("../src/content/data/programmes/", import.meta.url);
const loaderUrl = new URL("../src/content/programme.ts", import.meta.url);

const readJson = async (file) => JSON.parse(await readFile(new URL(file, dataDir), "utf8"));

const catalogue = await readJson("_index.json");
const loaderSource = await readFile(loaderUrl, "utf8");

const CONTENT_FILES = (await readdir(dataDir)).filter(
  (file) => file.endsWith(".json") && !file.startsWith("_"),
);

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} : doublon détecté`);
}

test("le catalogue ne référence que des fichiers de contenu existants", () => {
  assert.ok(Array.isArray(catalogue.programmes), "catalogue : `programmes` doit être un tableau");
  assert.ok(catalogue.programmes.length > 0, "catalogue : aucun programme déclaré");

  assertUnique(
    catalogue.programmes.map((entry) => entry.id),
    "catalogue/id",
  );

  for (const entry of catalogue.programmes) {
    const where = `catalogue/${entry.id}`;
    assert.ok(entry.id?.trim(), `${where} : id manquant`);
    assert.ok(entry.label?.trim(), `${where} : libellé manquant`);
    assert.ok(entry.pays?.trim(), `${where} : pays manquant`);
    assert.ok(Number.isInteger(entry.annee), `${where} : année invalide`);
    assert.ok(
      CONTENT_FILES.includes(entry.fichier),
      `${where} : fichier « ${entry.fichier} » introuvable dans data/programmes/`,
    );
  }
});

test("aucun fichier de contenu orphelin (tout fichier est déclaré au catalogue)", () => {
  const declared = new Set(catalogue.programmes.map((entry) => entry.fichier));
  for (const file of CONTENT_FILES) {
    assert.ok(declared.has(file), `data/programmes/${file} n'est déclaré par aucun catalogue`);
  }
});

test("le loader embarque chaque fichier déclaré (pas de saut silencieux)", () => {
  for (const entry of catalogue.programmes) {
    assert.ok(
      loaderSource.includes(`"${entry.fichier}"`),
      `src/content/programme.ts : « ${entry.fichier} » absent de CONTENT_BY_FILE — le programme serait ignoré au rendu`,
    );
  }
});

test("chaque programme est cohérent : sections, numérotation, identifiants, total", async () => {
  for (const entry of catalogue.programmes) {
    const content = await readJson(entry.fichier);
    const where = `programme/${entry.id}`;

    // Contrat : le catalogue porte le code ISO alpha-2 (`MG`), le fichier de contenu
    // porte le nom d'affichage (`Madagascar`) — le loader préfère ce dernier.
    assert.match(entry.pays, /^[A-Z]{2}$/, `catalogue/${entry.id} : pays doit être un code ISO alpha-2`);
    assert.ok(content.pays?.trim(), `${where} : nom de pays d'affichage manquant`);
    assert.equal(content.flag, entry.flag, `${where} : drapeau divergent`);
    assert.equal(content.annee, entry.annee, `${where} : année divergente`);

    assert.ok(Array.isArray(content.sections) && content.sections.length > 0, `${where} : sections absentes`);
    assertUnique(
      content.sections.map((section) => section.id),
      `${where}/section`,
    );

    const allItemIds = [];
    let counted = 0;

    for (const section of content.sections) {
      const sectionWhere = `${where}/${section.id}`;
      assert.ok(section.id?.trim(), `${sectionWhere} : id de section manquant`);
      assert.ok(section.label?.trim(), `${sectionWhere} : libellé de section manquant`);
      assert.ok(section.description?.trim(), `${sectionWhere} : description de section manquante`);
      assert.ok(
        Array.isArray(section.items) && section.items.length > 0,
        `${sectionWhere} : section vide`,
      );

      assertUnique(
        section.items.map((item) => item.id),
        `${sectionWhere}/id`,
      );

      section.items.forEach((item, index) => {
        const itemWhere = `${sectionWhere}#${index}`;
        assert.equal(item.n, index + 1, `${itemWhere} : numérotation non séquentielle (n=${item.n})`);
        assert.ok(item.id?.trim(), `${itemWhere} : id manquant`);
        assert.ok(
          item.title?.trim().length >= 3,
          `${itemWhere} : titre trop court (« ${item.title} »)`,
        );
        assert.ok(item.specialty?.trim(), `${itemWhere} : spécialité manquante`);
        allItemIds.push(`${section.id}:${item.id}`);
      });

      counted += section.items.length;
    }

    // Les `id` doivent rester uniques à l'échelle du programme (clés React, futur suivi
    // de progression) — la section fait partie de la clé si le besoin inverse apparaît.
    assertUnique(allItemIds, `${where}/id global`);

    assert.equal(counted, content.total, `${where} : total=${content.total} ≠ ${counted} items comptés`);
    assert.equal(counted, entry.total, `${where} : total=${entry.total} du catalogue ≠ ${counted} items`);

    const announcedBySection = new Map(entry.sections.map((section) => [section.id, section.count]));
    for (const section of content.sections) {
      assert.equal(
        announcedBySection.get(section.id),
        section.items.length,
        `${where}/${section.id} : comptage catalogue ≠ contenu`,
      );
    }
  }
});
