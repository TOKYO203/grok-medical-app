successfully downloaded text file (SHA: 614b746417192e3b15c4fb0785914b7cd19c3c70)import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("privacy and terms are first-class in-app routes linked from About", async () => {
  const [privacy, terms, about] = await Promise.all([
    source("src/routes/confidentialite.tsx"),
    source("src/routes/conditions.tsx"),
    source("src/routes/a-propos.tsx"),
  ]);

  assert.match(privacy, /createFileRoute\("\/confidentialite"\)/);
  assert.match(terms, /createFileRoute\("\/conditions"\)/);
  assert.match(about, /to="\/confidentialite"/);
  assert.match(about, /to="\/conditions"/);
  assert.match(about, /outil éducatif/);
  assert.match(about, /non d’un substitut au jugement clinique\s+professionnel/);
});

test("privacy copy documents export, deletion, local-first storage and commercial separation", async () => {
  const privacy = await source("src/routes/confidentialite.tsx");

  assert.match(privacy, /local-first/);
  assert.match(privacy, /Exporter ou supprimer/);
  assert.match(privacy, /progression pédagogique cloud peut être supprimée/);
  assert.match(privacy, /données\s+commerciales et d’audit liées à une commande sont séparées/);
  assert.match(privacy, /validation juridique locale reste\s+requise/);
  assert.match(privacy, /to="\/donnees"/);
});

test("terms explicitly position Optimus as education, not clinical care", async () => {
  const terms = await source("src/routes/conditions.tsx");

  assert.match(terms, /Un outil éducatif/);
  assert.match(terms, /ne remplace ni une formation encadrée/);
  assert.match(terms, /ne constituent pas une\s+consultation médicale, une prescription, un diagnostic/);
  assert.match(terms, /Aucun paiement ne doit être effectué/);
  assert.match(terms, /validation juridique\s+locale/);
});

test("urgent medical correction procedure requires qualified human review", async () => {
  const procedure = await source("docs/medical-content-correction.md");

  assert.match(procedure, /masquer ou désactiver le contenu concerné/);
  assert.match(procedure, /relecteur humain qualifié/);
  assert.match(procedure, /npm run release:check/);
  assert.match(procedure, /tests automatisés ne constitue jamais, à elle seule, une validation médicale/);
});

test("public changelog is a declared route linked from About and driven by content", async () => {
  const [changelog, about, data] = await Promise.all([
    source("src/routes/changelog.tsx"),
    source("src/routes/a-propos.tsx"),
    source("src/content/changelog.ts"),
  ]);

  assert.match(changelog, /createFileRoute\("\/changelog"\)/);
  assert.match(about, /to="\/changelog"/);
  assert.match(changelog, /@\/content\/changelog/);
  assert.match(data, /APP_CHANGELOG/);
  assert.match(data, /2026-10-17/);
  assert.match(data, /v1\.0\.0/);
});
