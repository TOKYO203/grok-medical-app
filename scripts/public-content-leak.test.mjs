/* Garde-fou pentest — le contenu fermé n'est pas publié dans `public/data`.

   POURQUOI CE TEST EXISTE
   `public/data/*.json` sont des actifs STATIQUES : le CDN les sert avant tout
   code applicatif, donc sans le moindre jeton. Ils contenaient :
     • les `questions[]` de 74 decks `access_policy.tier = "pro"` (P0) ;
     • les étapes, questions décisionnelles, diagnostic et prise en charge de
       41 dossiers cliniques fermés (§14).
   Soit ~1 Mio de contenu payant téléchargeable par `curl`.

   CE QUE LE TEST VÉRIFIE, pour chaque famille (decks puis cas)
   1. aucun élément fermé de l'index publié ne porte de contenu ;
   2. chaque élément fermé a son actif dans `private/content/<famille>/`,
      complet (mêmes questions / mêmes étapes) ;
   3. les éléments GRATUITS gardent leur contenu dans l'index (le parcours
      gratuit doit rester utilisable hors ligne, sans jeton) ;
   4. le total annoncé (`questionCount` / `stepCount`) est exact ;
   5. aucun actif fermé n'est présent dans le dossier publié ;
   6. l'index publié est EXACTEMENT le split de la source — un fichier
      régénéré à la main, ou une source modifiée sans relancer le split, est
      donc une erreur de build et non une dérive silencieuse.

   ⚠️ Ce test lit les fichiers du dépôt (pas de build requis) : il tourne dans
   le job CI `test`, avant tout déploiement. */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CASES_INDEX,
  CASES_SOURCE,
  PROTECTED_CASES_DIR,
  PROTECTED_CASE_FILE_PATTERN,
  isPremiumCase,
  protectedCaseFile,
  splitCasesPayload,
} from "./split-cases.mjs";
import {
  DECKS_INDEX,
  DECKS_SOURCE,
  PROTECTED_DECKS_DIR,
  PROTECTED_DECK_FILE_PATTERN,
  isPremiumDeck,
  splitDecksPayload,
} from "./split-decks.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const readJson = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), "utf8"));

// ─── Decks ────────────────────────────────────────────────────────────────
const sourceDecks = readJson(...DECKS_SOURCE);
const publishedDecks = readJson(...DECKS_INDEX);

const premiumSource = sourceDecks.filter(isPremiumDeck);
const freeSource = sourceDecks.filter((deck) => !isPremiumDeck(deck));

test("aucune question d'un deck premium n'est publiée dans l'index public", () => {
  assert.ok(premiumSource.length > 0, "aucun deck premium dans la source : test inopérant");

  const offenders = publishedDecks
    .filter((deck) => isPremiumDeck(deck) && Array.isArray(deck.questions) && deck.questions.length > 0)
    .map((deck) => `${deck.id} (${deck.questions.length} questions)`);

  assert.deepEqual(
    offenders,
    [],
    "des questions de decks premium sont encore servies par /data/decks.json :\n" +
      offenders.join("\n") +
      "\nRelancer `node scripts/split-decks.mjs` (ou `npm run build`).",
  );
});

test("chaque deck premium a son actif protégé complet", () => {
  for (const deck of premiumSource) {
    const file = `${deck.id}.json`;
    assert.match(file, PROTECTED_DECK_FILE_PATTERN, `${deck.id} : nom de fichier non publiable dans private/`);

    const path = join(ROOT, ...PROTECTED_DECKS_DIR, file);
    assert.ok(existsSync(path), `${file} : actif protégé absent de ${PROTECTED_DECKS_DIR.join("/")}/`);

    const asset = JSON.parse(readFileSync(path, "utf8"));
    const expectedIds = (deck.questions ?? []).map((question) => question.id);
    const actualIds = (asset.questions ?? []).map((question) => question.id);

    assert.deepEqual(actualIds, expectedIds, `${file} : les questions protégées ne correspondent plus à la source`);
  }
});

test("les decks gratuits gardent leurs questions dans l'index public", () => {
  const publishedById = new Map(publishedDecks.map((deck) => [deck.id, deck]));

  for (const deck of freeSource) {
    const published = publishedById.get(deck.id);
    assert.ok(published, `${deck.id} : deck gratuit absent de l'index publié`);
    assert.deepEqual(
      published.questions,
      deck.questions,
      `${deck.id} : un deck gratuit doit rester jouable sans jeton`,
    );
  }
});

test("le nombre de questions annoncé par l'index est exact", () => {
  for (const deck of sourceDecks) {
    const published = publishedDecks.find((candidate) => candidate.id === deck.id);
    assert.ok(published, `${deck.id} : deck absent de l'index publié`);
    assert.equal(
      published.questionCount,
      (deck.questions ?? []).length,
      `${deck.id} : questionCount incorrect (l'UI afficherait un mauvais total)`,
    );
  }
});

test("aucun actif de deck premium n'est présent dans le dossier publié", () => {
  assert.equal(
    existsSync(join(ROOT, "public", "content", "decks")),
    false,
    "public/content/decks/ existe : le CDN servirait les questions premium sans jeton",
  );
  assert.equal(
    existsSync(join(ROOT, "public", "data", "decks")),
    false,
    "public/data/decks/ existe : le CDN servirait les questions premium sans jeton",
  );
});

test("l'index publié des decks est exactement le split de la source (aucune dérive)", () => {
  const { index, protectedDecks } = splitDecksPayload(sourceDecks);

  assert.deepEqual(
    publishedDecks,
    index,
    "public/data/decks.json n'est pas le split de src/content/data/decks.json : " +
      "relancer `node scripts/split-decks.mjs`",
  );

  for (const asset of protectedDecks) {
    const path = join(ROOT, ...PROTECTED_DECKS_DIR, asset.file);
    const written = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(written, asset.payload, `${asset.file} : actif protégé périmé par rapport à la source`);
  }
});

// ─── Cas cliniques ────────────────────────────────────────────────────────
const sourceCases = readJson(...CASES_SOURCE);
const publishedCases = readJson(...CASES_INDEX);

const premiumCases = sourceCases.filter(isPremiumCase);
const freeCases = sourceCases.filter((clinical) => !isPremiumCase(clinical));

/** Champs qui ne doivent jamais sortir dans l'index public d'un cas fermé. */
const CLOSED_CASE_FIELDS = ["steps", "diagnosis", "management", "pitfall", "keyTakeaway"];

test("aucun contenu d'un dossier clinique fermé n'est publié dans l'index public", () => {
  assert.ok(premiumCases.length > 0, "aucun dossier fermé dans la source : test inopérant");

  const offenders = publishedCases
    .filter((clinical) => isPremiumCase(clinical))
    .flatMap((clinical) => {
      const leaked = [];
      if (Array.isArray(clinical.steps) && clinical.steps.length > 0) {
        leaked.push(`${clinical.id} : ${clinical.steps.length} étape(s)`);
      }
      for (const field of ["diagnosis", "management", "pitfall", "keyTakeaway"]) {
        if (clinical[field] !== undefined) leaked.push(`${clinical.id} : ${field}`);
      }
      return leaked;
    });

  assert.deepEqual(
    offenders,
    [],
    "du contenu de dossiers fermés est encore servi par /data/cases.json :\n" +
      offenders.join("\n") +
      "\nRelancer `node scripts/split-cases.mjs` (ou `npm run build`).",
  );
});

test("chaque dossier clinique fermé a son actif protégé complet", () => {
  for (const clinical of premiumCases) {
    const file = protectedCaseFile(clinical.id);
    assert.match(file, PROTECTED_CASE_FILE_PATTERN, `${clinical.id} : nom de fichier non publiable dans private/`);

    const path = join(ROOT, ...PROTECTED_CASES_DIR, file);
    assert.ok(existsSync(path), `${file} : dossier protégé absent de ${PROTECTED_CASES_DIR.join("/")}/`);

    const asset = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(
      (asset.steps ?? []).map((step) => step.id ?? step.title ?? step.prompt),
      (clinical.steps ?? []).map((step) => step.id ?? step.title ?? step.prompt),
      `${file} : les étapes protégées ne correspondent plus à la source`,
    );
    assert.equal(asset.diagnosis, clinical.diagnosis, `${file} : diagnostic protégé divergent`);
    assert.equal(asset.management, clinical.management, `${file} : prise en charge protégée divergente`);
  }
});

test("les dossiers gratuits gardent leur contenu dans l'index public", () => {
  const publishedById = new Map(publishedCases.map((clinical) => [clinical.id, clinical]));

  for (const clinical of freeCases) {
    const published = publishedById.get(clinical.id);
    assert.ok(published, `${clinical.id} : dossier gratuit absent de l'index publié`);
    assert.deepEqual(
      published.steps,
      clinical.steps,
      `${clinical.id} : un dossier gratuit doit rester jouable sans jeton`,
    );
    assert.equal(published.diagnosis, clinical.diagnosis, `${clinical.id} : diagnostic gratuit manquant`);
  }
});

test("le nombre d'étapes annoncé par l'index est exact", () => {
  for (const clinical of sourceCases) {
    const published = publishedCases.find((candidate) => candidate.id === clinical.id);
    assert.ok(published, `${clinical.id} : dossier absent de l'index publié`);
    assert.equal(
      published.stepCount,
      (clinical.steps ?? []).length,
      `${clinical.id} : stepCount incorrect (l'UI afficherait un mauvais total)`,
    );
  }
});

test("aucun dossier clinique protégé n'est présent dans le dossier publié", () => {
  for (const dir of [
    join(ROOT, "public", "content", "cases"),
    join(ROOT, "public", "data", "cases"),
  ]) {
    assert.equal(existsSync(dir), false, `${dir} existe : le CDN servirait les dossiers fermés sans jeton`);
  }
});

test("l'index publié des cas est exactement le split de la source (aucune dérive)", () => {
  const { index, protectedCases: assets } = splitCasesPayload(sourceCases);

  assert.deepEqual(
    publishedCases,
    index,
    "public/data/cases.json n'est pas le split de src/content/data/cases.json : " +
      "relancer `node scripts/split-cases.mjs`",
  );

  assert.deepEqual(
    CLOSED_CASE_FIELDS.sort(),
    ["diagnosis", "keyTakeaway", "management", "pitfall", "steps"],
    "un champ fermé a été oublié dans le split",
  );

  for (const asset of assets) {
    const path = join(ROOT, ...PROTECTED_CASES_DIR, asset.file);
    const written = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(written, asset.payload, `${asset.file} : dossier protégé périmé par rapport à la source`);
  }
});
