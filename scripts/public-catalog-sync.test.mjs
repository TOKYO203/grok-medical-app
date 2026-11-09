#!/usr/bin/env node
/**
 * Contrat de scripts/sync-catalog-data.mjs depuis le pentest 2026-11-09
 * (§1 decks, §14 cas cliniques, §15 démarches) : `public/data/*.json` n'est
 * plus une copie brute de la source, mais une PROJECTION publique (aucune
 * question Pro, aucun dossier clinique Pro, aucun stepper de démarche) ; les
 * actifs COMPLETS vivent dans `private/content/**` (généré, gitignoré) et ne
 * sont servis que par le garde `/content/$type/$file` sous jeton.
 *
 * Tous les scénarios tournent sur un workspace TMP : le test ne mute JAMAIS le
 * check-out (la dernière version du test faisait exactement l'inverse).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncCatalogData } from "./sync-catalog-data.mjs";

const CHECKOUT = join(fileURLToPath(import.meta.url), "..", "..");

/** Workspace tmp minimal : source des 3 catalogues + fiches de démarches. */
function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "catalog-sync-"));
  const srcDir = join(root, "src", "content", "data");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(srcDir, "decks.json"),
    JSON.stringify([
      {
        id: "DK-FREE-1",
        title: "Deck gratuit",
        access_policy: { tier: "free", entitlement: "OPTIMUS_FREE" },
        questions: [{ id: "QF1" }, { id: "QF2" }],
      },
      {
        id: "DK-PRO-1",
        title: "Deck premium",
        access_policy: { tier: "pro", entitlement: "CARDIO" },
        questions: [{ id: "QP1" }, { id: "QP2" }, { id: "QP3" }],
      },
    ]),
  );
  writeFileSync(
    join(srcDir, "cases.json"),
    JSON.stringify([
      {
        id: "CS-FREE-1",
        title: "Cas gratuit",
        access: "free",
        summary: "Résumé",
        patient: { age: 30, sex: "F", context: "c" },
        steps: [{ kind: "reveal", title: "t", body: "b" }],
        diagnosis: "D",
        management: "M",
      },
      {
        id: "CS-PRO-1",
        title: "Cas premium",
        access: "pro",
        summary: "Teaser",
        patient: { age: 60, sex: "H", context: "c" },
        steps: [{ kind: "question", prompt: "p", choices: ["a"], correct: 0, explanation: "e" }],
        diagnosis: "Secret",
        management: "Secret",
        pitfall: "Piège",
        keyTakeaway: "Clé",
      },
    ]),
  );
  writeFileSync(
    join(srcDir, "diagnostics.json"),
    JSON.stringify([
      {
        id: "DX-TEST-001",
        title: "Démarche",
        specialty: "Cardiologie",
        vignette: "Vignette publique",
        steps: [{ id: "S1", title: "t", lead: "l", prompt: "p", choices: ["a"], correct: 0, explanation: "e" }],
        synthesis: "Synthèse privée",
      },
    ]),
  );
  const demarcheDir = join(root, "public", "content", "demarches");
  mkdirSync(demarcheDir, { recursive: true });
  writeFileSync(join(demarcheDir, "_index.json"), JSON.stringify({ demarches: [] }));
  writeFileSync(join(demarcheDir, "fiche-a.json"), JSON.stringify({ id: "F", sections: [] }));
  return root;
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

test("la projection publique ne fuit aucun contenu Pro, l'actif privé est complet", () => {
  const root = makeWorkspace();
  try {
    const synced = syncCatalogData({ root });
    assert.deepEqual(synced, ["decks.json", "cases.json", "diagnostics.json"]);

    // §1 — decks : le gratuit reste entier, le Pro n'a plus ses questions.
    const decks = readJson(join(root, "public", "data", "decks.json"));
    assert.equal(decks.length, 2);
    const free = decks.find((d) => d.id === "DK-FREE-1");
    const pro = decks.find((d) => d.id === "DK-PRO-1");
    assert.equal(free.questions.length, 2);
    assert.deepEqual(pro.questions, []);
    assert.equal(pro.questionCount, 3);
    assert.equal(pro.title, "Deck premium");

    // §14 — cas cliniques : le gratuit reste entier, le Pro n'est qu'une carte.
    const cases = readJson(join(root, "public", "data", "cases.json"));
    const freeCase = cases.find((c) => c.id === "CS-FREE-1");
    const proCase = cases.find((c) => c.id === "CS-PRO-1");
    assert.equal(freeCase.steps.length, 1);
    assert.equal(freeCase.diagnosis, "D");
    assert.equal(proCase.summary, "Teaser");
    for (const field of ["patient", "steps", "diagnosis", "management", "pitfall", "keyTakeaway"]) {
      assert.equal(proCase[field], undefined, `cases.json public ne doit plus porter ${field}`);
    }

    // §15 — démarches : vignette publique, ni stepper ni synthèse.
    const diagnostics = readJson(join(root, "public", "data", "diagnostics.json"));
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].vignette, "Vignette publique");
    assert.equal(diagnostics[0].steps, undefined);
    assert.equal(diagnostics[0].synthesis, undefined);

    // Les actifs PRIVÉS portent l'objet complet, serviable sous jeton.
    const proAsset = readJson(join(root, "private", "content", "decks", "DK-PRO-1.json"));
    assert.equal(proAsset.questions.length, 3);
    const caseAsset = readJson(join(root, "private", "content", "cases", "CS-PRO-1.json"));
    assert.equal(caseAsset.steps.length, 1);
    assert.equal(caseAsset.diagnosis, "Secret");
    const diagAsset = readJson(join(root, "private", "content", "diagnostics", "DX-TEST-001.json"));
    assert.equal(diagAsset.steps.length, 1);
    assert.equal(diagAsset.synthesis, "Synthèse privée");
    // Fiches de démarches copiées vers le dossier privé (servies par le garde).
    assert.ok(existsSync(join(root, "private", "content", "demarches", "fiche-a.json")));
    assert.ok(existsSync(join(root, "private", "content", "demarches", "_index.json")));
  } finally {
    rmTemp(root);
  }
});

test("la synchronisation est idempotente", () => {
  const root = makeWorkspace();
  try {
    syncCatalogData({ root });
    const again = syncCatalogData({ root });
    assert.deepEqual(again, [], "un second passage ne doit rien régénérer");
  } finally {
    rmTemp(root);
  }
});

test("sans source, la copie publique existante est préservée", () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-sync-"));
  try {
    const destDir = join(root, "public", "data");
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "decks.json"), "[{\"id\":\"LEGACY\"}]");
    const synced = syncCatalogData({ root });
    assert.deepEqual(synced, []);
    assert.equal(readFileSync(join(destDir, "decks.json"), "utf8"), "[{\"id\":\"LEGACY\"}]");
  } finally {
    rmTemp(root);
  }
});

test("le test ne mute jamais le check-out", () => {
  const checkoutData = join(CHECKOUT, "public", "data");
  const snapshot = existsSync(checkoutData)
    ? Object.fromEntries(readdirSync(checkoutData).map((name) => [name, readFileSync(join(checkoutData, name), "utf8")]))
    : {};
  const root = makeWorkspace();
  try {
    syncCatalogData({ root });
    if (existsSync(checkoutData)) {
      for (const [name, before] of Object.entries(snapshot)) {
        assert.equal(readFileSync(join(checkoutData, name), "utf8"), before, `le check-out ne doit pas être muté (${name})`);
      }
    }
  } finally {
    rmTemp(root);
  }
});

function rmTemp(root) {
  for (const dir of ["public", "private", "src"]) {
    rmSync(join(root, dir), { recursive: true, force: true });
  }
}
