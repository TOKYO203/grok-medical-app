#!/usr/bin/env node
/**
 * SÉPARATION DES CAS CLINIQUES PREMIUM — index public / dossier protégé.
 *
 * POURQUOI CE SCRIPT EXISTE
 * `public/data/cases.json` est servi par le CDN à n'importe qui : y laisser le
 * `steps[]` d'un dossier `access: "pro"` revient à publier les étapes, les
 * questions décisionnelles (avec `correct` et `explanation`), le diagnostic, la
 * prise en charge, le piège et la clé de mémorisation. Le verrouillage côté
 * React ne protège rien (constat §14 du pentest 2026-11-09, même classe que le
 * P0 des decks).
 *
 * CE QUE FAIT LE SPLIT
 *   • source de vérité INCHANGÉE : `src/content/data/cases.json` (les tests
 *     éditoriaux et le validateur continuent de lire les dossiers complets) ;
 *   • index publié : `public/data/cases.json`, mêmes dossiers, mais `steps: []`
 *     et `stepCount: N` pour les cas premium, sans diagnostic ni prise en
 *     charge ;
 *   • dossiers protégés : `private/content/cases/<id-minuscule>.json`,
 *     HORS du dossier publié — lus uniquement par le garde
 *     `/content/$type/$file` sous jeton de contenu.
 *
 * Les cas GRATUITS (et ceux sans `access`, historiquement ouverts) gardent leur
 * contenu dans l'index : le parcours gratuit doit rester utilisable hors ligne
 * et sans jeton. Le TEASER des cas premium reste public — titre, résumé,
 * patient, spécialité, nombre d'étapes — c'est ce qui donne envie d'ouvrir.
 *
 * Usage : node scripts/split-cases.mjs
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
export const CASES_SOURCE = ["src", "content", "data", "cases.json"];
export const CASES_INDEX = ["public", "data", "cases.json"];
export const PROTECTED_CASES_DIR = ["private", "content", "cases"];

/** Même forme que `PROTECTED_FILE_PATTERN` du garde serveur (minuscules). */
export const PROTECTED_CASE_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Schéma du dossier protégé (le garde rend le JSON tel quel). */
export const PROTECTED_CASE_SCHEMA_VERSION = 1;

/** Champs qui ne sortent JAMAIS dans l'index public d'un cas premium. */
export const PREMIUM_CASE_FIELDS = ["steps", "diagnosis", "management", "pitfall", "keyTakeaway"];

/**
 * Un cas est premium dès que son palier n'est pas « free ».
 *
 * Les cinq dossiers sans champ `access` sont verrouillés par l'UI
 * (`hasClinicalAccess` n'ouvre que `access === "free"` ou une licence) : les
 * traiter comme publics publierait le contenu d'un dossier fermé. Même règle
 * que les decks (`tier !== "free"`).
 */
export function isPremiumCase(clinical) {
  return (clinical?.access ?? "pro") !== "free";
}

/** Nom d'actif protégé d'un cas (`INF-TB-001` → `inf-tb-001.json`). */
export function protectedCaseFile(id) {
  return `${String(id).toLowerCase()}.json`;
}

/** Sérialisation stable : mêmes octets pour les mêmes données. */
function serialise(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Calcule l'index public et les dossiers protégés à partir des cas SOURCE.
 * Fonction PURE : aucune écriture, utilisable par les tests et le build.
 */
export function splitCasesPayload(cases) {
  if (!Array.isArray(cases)) throw new Error("cases.json : un tableau de cas est attendu");

  const index = [];
  const protectedCases = [];

  for (const clinical of cases) {
    const id = String(clinical?.id ?? "");
    const file = protectedCaseFile(id);
    if (!PROTECTED_CASE_FILE_PATTERN.test(file)) {
      throw new Error(`id de cas non publiable en actif protégé : « ${id} »`);
    }

    const steps = Array.isArray(clinical.steps) ? clinical.steps : [];
    const publicCase = { ...clinical, steps, stepCount: steps.length };

    if (isPremiumCase(clinical)) {
      const payload = {
        schemaVersion: PROTECTED_CASE_SCHEMA_VERSION,
        case_id: clinical.id ?? id,
        steps,
        diagnosis: clinical.diagnosis,
        management: clinical.management,
        pitfall: clinical.pitfall,
        keyTakeaway: clinical.keyTakeaway,
      };

      publicCase.steps = [];
      delete publicCase.diagnosis;
      delete publicCase.management;
      delete publicCase.pitfall;
      delete publicCase.keyTakeaway;

      protectedCases.push({ file, payload });
    }

    index.push(publicCase);
  }

  return { index, protectedCases };
}

/** Écriture atomique : un lecteur parallèle voit l'ancien ou le nouveau fichier. */
function atomicWrite(dest, contents) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.split-cases-tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, dest);
}

/**
 * Applique le split dans un espace de travail.
 *
 * @returns {{indexChanged: boolean, protectedWritten: string[], removed: string[]}}
 */
export function splitCases({ root = projectRoot(), log = () => {} } = {}) {
  const sourcePath = join(root, ...CASES_SOURCE);
  const indexPath = join(root, ...CASES_INDEX);
  const privateDir = join(root, ...PROTECTED_CASES_DIR);

  // Pas de source : on ne touche jamais la copie publique (repli explicite).
  if (!existsSync(sourcePath)) return { indexChanged: false, protectedWritten: [], removed: [] };

  const cases = JSON.parse(readFileSync(sourcePath, "utf8"));
  const { index, protectedCases } = splitCasesPayload(cases);

  const indexContents = serialise(index);
  let indexChanged = false;
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== indexContents) {
    atomicWrite(indexPath, indexContents);
    indexChanged = true;
  }

  const protectedWritten = [];
  for (const asset of protectedCases) {
    const dest = join(privateDir, asset.file);
    const contents = serialise(asset.payload);
    if (existsSync(dest) && readFileSync(dest, "utf8") === contents) continue;
    atomicWrite(dest, contents);
    protectedWritten.push(asset.file);
  }

  // Dossier orphelin (cas repassé en gratuit ou renommé) : un fichier oublié
  // dans `private/` finirait dans le bundle serveur sans raison.
  const expected = new Set(protectedCases.map((asset) => asset.file));
  const removed = [];
  if (existsSync(privateDir)) {
    for (const name of readdirSync(privateDir)) {
      if (!name.endsWith(".json") || expected.has(name)) continue;
      rmSync(join(privateDir, name));
      removed.push(name);
    }
  }

  if (indexChanged) log(`[split-cases] ${CASES_INDEX.join("/")} mis à jour (${index.length} cas)`);
  if (protectedWritten.length > 0) {
    log(`[split-cases] ${protectedWritten.length} dossier(s) protégé(s) écrit(s)`);
  }
  if (removed.length > 0) log(`[split-cases] ${removed.length} dossier(s) protégé(s) retiré(s)`);

  return { indexChanged, protectedWritten, removed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), "scripts", "split-cases.mjs")) {
  const result = splitCases({ log: console.log });
  if (!result.indexChanged && result.protectedWritten.length === 0 && result.removed.length === 0) {
    console.log("[split-cases] index public et dossiers protégés déjà à jour");
  }
}
