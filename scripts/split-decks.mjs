#!/usr/bin/env node
/**
 * SÉPARATION DES DECKS PREMIUM — index public / questions protégées.
 *
 * POURQUOI CE SCRIPT EXISTE
 * `public/data/decks.json` est servi par le CDN à n'importe qui : y laisser les
 * `questions[]` d'un deck `access_policy.tier != "free"` revient à publier les
 * énoncés, les réponses et les explications du contenu payant. Le verrouillage
 * Premium côté React ne protège rien (constat P0 du pentest 2026-11-09).
 *
 * CE QUE FAIT LE SPLIT
 *   • source de vérité INCHANGÉE : `src/content/data/decks.json` (les tests
 *     éditoriaux continuent de lire les questions là où elles sont écrites) ;
 *   • index publié : `public/data/decks.json`, mêmes decks, mais `questions: []`
 *     et `questionCount: N` pour les decks premium ;
 *   • actifs protégés : `private/content/decks/<id>.json`
 *     (`{ schemaVersion, deck_id, questions }`), HORS du dossier publié — lus
 *     uniquement par le garde `/content/$type/$file` sous jeton de contenu.
 *
 * Les decks GRATUITS gardent leurs questions dans l'index : le parcours gratuit
 * doit rester utilisable hors ligne et sans jeton.
 *
 * Usage : node scripts/split-decks.mjs
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Le workspace root (ce fichier vit dans `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/** Emplacements relatifs, un seul endroit pour les trois. */
export const DECKS_SOURCE = ["src", "content", "data", "decks.json"];
export const DECKS_INDEX = ["public", "data", "decks.json"];
export const PROTECTED_DECKS_DIR = ["private", "content", "decks"];

/** Même forme que `PROTECTED_FILE_PATTERN` du garde serveur. */
export const PROTECTED_DECK_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Schéma de l'actif protégé (le garde rend le JSON tel quel). */
export const PROTECTED_DECK_SCHEMA_VERSION = 1;

/** Un deck est premium dès que son palier n'est pas « free ». */
export function isPremiumDeck(deck) {
  return (deck?.access_policy?.tier ?? "free") !== "free";
}

/** Sérialisation stable : mêmes octets pour les mêmes données. */
function serialise(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Calcule l'index public et les actifs protégés à partir des decks SOURCE.
 * Fonction PURE : aucune écriture, utilisable par les tests et le build.
 */
export function splitDecksPayload(decks) {
  if (!Array.isArray(decks)) throw new Error("decks.json : un tableau de decks est attendu");

  const index = [];
  const protectedDecks = [];

  for (const deck of decks) {
    const id = String(deck?.id ?? "");
    if (!PROTECTED_DECK_FILE_PATTERN.test(`${id}.json`)) {
      throw new Error(`id de deck non publiable en actif protégé : « ${id} »`);
    }
    const questions = Array.isArray(deck.questions) ? deck.questions : [];
    const publicDeck = { ...deck, questions, questionCount: questions.length };

    if (questions.length > 0 && isPremiumDeck(deck)) {
      publicDeck.questions = [];
      protectedDecks.push({
        file: `${id}.json`,
        payload: {
          schemaVersion: PROTECTED_DECK_SCHEMA_VERSION,
          deck_id: deck.deck_id ?? id,
          questions,
        },
      });
    }

    index.push(publicDeck);
  }

  return { index, protectedDecks };
}

/** Écriture atomique : un lecteur parallèle voit l'ancien ou le nouveau fichier. */
function atomicWrite(dest, contents) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.split-decks-tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, dest);
}

/**
 * Applique le split dans un espace de travail.
 *
 * @returns {{indexChanged: boolean, protectedWritten: string[], removed: string[]}}
 */
export function splitDecks({ root = projectRoot(), log = () => {} } = {}) {
  const sourcePath = join(root, ...DECKS_SOURCE);
  const indexPath = join(root, ...DECKS_INDEX);
  const privateDir = join(root, ...PROTECTED_DECKS_DIR);

  // Pas de source : on ne touche jamais la copie publique (repli explicite).
  if (!existsSync(sourcePath)) return { indexChanged: false, protectedWritten: [], removed: [] };

  const decks = JSON.parse(readFileSync(sourcePath, "utf8"));
  const { index, protectedDecks } = splitDecksPayload(decks);

  const indexContents = serialise(index);
  let indexChanged = false;
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== indexContents) {
    atomicWrite(indexPath, indexContents);
    indexChanged = true;
  }

  const protectedWritten = [];
  for (const asset of protectedDecks) {
    const dest = join(privateDir, asset.file);
    const contents = serialise(asset.payload);
    if (existsSync(dest) && readFileSync(dest, "utf8") === contents) continue;
    atomicWrite(dest, contents);
    protectedWritten.push(asset.file);
  }

  // Actif protégé orphelin (deck repassé en gratuit ou renommé) : un fichier
  // oublié dans `private/` finirait dans le bundle serveur sans raison.
  const expected = new Set(protectedDecks.map((asset) => asset.file));
  const removed = [];
  if (existsSync(privateDir)) {
    for (const name of readdirSync(privateDir)) {
      if (!name.endsWith(".json") || expected.has(name)) continue;
      rmSync(join(privateDir, name));
      removed.push(name);
    }
  }

  if (indexChanged) log(`[split-decks] ${DECKS_INDEX.join("/")} mis à jour (${index.length} decks)`);
  if (protectedWritten.length > 0) {
    log(`[split-decks] ${protectedWritten.length} actif(s) protégé(s) écrit(s)`);
  }
  if (removed.length > 0) log(`[split-decks] ${removed.length} actif(s) protégé(s) retiré(s)`);

  return { indexChanged, protectedWritten, removed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), "scripts", "split-decks.mjs")) {
  const result = splitDecks({ log: console.log });
  if (!result.indexChanged && result.protectedWritten.length === 0 && result.removed.length === 0) {
    console.log("[split-decks] index public et actifs protégés déjà à jour");
  }
}
