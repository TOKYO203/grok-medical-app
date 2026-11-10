/* Garde-fou P0 du pentest — les questions des decks premium ne sont pas publiées.

   POURQUOI CE TEST EXISTE
   `public/data/decks.json` est un actif STATIQUE : le CDN le sert avant tout
   code applicatif, donc sans le moindre jeton. Il contenait les `questions[]`
   (énoncé, réponses, explication) de 74 decks `access_policy.tier = "pro"`,
   soit ~700 Kio de contenu payant téléchargeables par `curl` — constat P0 du
   pentest du 2026-11-09.

   CE QUE LE TEST VÉRIFIE
   1. Aucun deck premium de l'index publié ne porte de questions ;
   2. chaque deck premium a son actif dans `private/content/decks/<id>.json`,
      complet (mêmes questions, même nombre) ;
   3. les decks GRATUITS gardent leurs questions dans l'index (le parcours
      gratuit doit rester utilisable hors ligne, sans jeton) ;
   4. aucun actif de deck premium n'est présent dans le dossier publié ;
   5. l'index publié est EXACTEMENT le split de la source — un `decks.json`
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
  DECKS_SOURCE,
  PROTECTED_DECKS_DIR,
  PROTECTED_DECK_FILE_PATTERN,
  isPremiumDeck,
  splitDecksPayload,
} from "./split-decks.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const readJson = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), "utf8"));

const sourceDecks = readJson(...DECKS_SOURCE);
const publishedDecks = readJson("public", "data", "decks.json");

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

test("l'index publié est exactement le split de la source (aucune dérive)", () => {
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
