#!/usr/bin/env node
/**
 * SÉPARATION DES DÉMARCHES D'ORIENTATION — aperçu public / réponses protégées.
 *
 * POURQUOI CE SCRIPT EXISTE
 * `public/data/diagnostics.json` est un actif STATIQUE : le CDN le sert avant
 * tout code applicatif, donc sans jeton. Il contenait les 43 QCM complets —
 * `correct` et `explanation` de chaque étape, plus la `synthesis` — alors que
 * les 43 chapitres sont `access: "pro"`. N'importe qui pouvait lire les
 * réponses de tout le programme d'orientation avec un `curl` (§15 du pentest).
 *
 * CE QUE FAIT LE SPLIT
 *   • source de vérité INCHANGÉE : `src/content/data/diagnostics.json` ;
 *   • index publié : `public/data/diagnostics.json`, mêmes chapitres, mêmes
 *     énoncés et mêmes choix, mais `correct`/`explanation` retirés de toutes
 *     les étapes SAUF la première, et `synthesis` retirée. C'est l'aperçu
 *     « première décision offerte » de `/demarche/$id` ;
 *   • réponses protégées : `private/content/demarche-answers/<id-minuscule>.json`
 *     (étapes suivantes + synthèse), HORS du dossier publié — servies par
 *     `/content/demarche-answers/**` sous jeton de contenu.
 *
 * Les fiches enrichies (fiche / flashcards / carte mentale) ne sont pas
 * traitées ici : elles vivent dans `private/content/demarches/` (déplacées de
 * `public/content/` le 2026-11-11) et sortent par `/content/demarches/<file>`.
 *
 * Usage : node scripts/split-demarches.mjs
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
export const DIAGNOSTICS_SOURCE = ["src", "content", "data", "diagnostics.json"];
export const DIAGNOSTICS_INDEX = ["public", "data", "diagnostics.json"];
export const PROTECTED_ANSWERS_DIR = ["private", "content", "demarche-answers"];

/** Même forme que `PROTECTED_FILE_PATTERN` du garde serveur (minuscules). */
export const PROTECTED_ANSWER_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Schéma de l'actif protégé (le garde rend le JSON tel quel). */
export const PROTECTED_ANSWER_SCHEMA_VERSION = 1;

/**
 * Nombre d'étapes offertes SANS jeton.
 *
 * L'écran affiche « Aperçu Premium · première décision offerte » et verrouille
 * à partir de la deuxième étape (`!open && step >= 1`) : la première réponse
 * doit donc rester publique, sinon l'aperçu ne corrige plus rien.
 */
export const FREE_STEP_COUNT = 1;

/** Nom d'actif protégé d'un chapitre (`DX-THORAX-001` → `dx-thorax-001.json`). */
export function protectedAnswerFile(id) {
  return `${String(id).toLowerCase()}.json`;
}

/** Copie d'une étape sans sa correction ni son explication. */
export function stripStepAnswers(step) {
  const { correct: _correct, explanation: _explanation, ...rest } = step ?? {};
  return rest;
}

/**
 * Calcule l'index public et les réponses protégées à partir des QCM SOURCE.
 * Fonction PURE : aucune écriture, utilisable par les tests et le build.
 */
export function splitDiagnosticsPayload(diagnostics) {
  if (!Array.isArray(diagnostics)) {
    throw new Error("diagnostics.json : un tableau de démarches est attendu");
  }

  const index = [];
  const answers = [];

  for (const diagnostic of diagnostics) {
    const id = String(diagnostic?.id ?? "");
    const file = protectedAnswerFile(id);
    if (!PROTECTED_ANSWER_FILE_PATTERN.test(file)) {
      throw new Error(`id de démarche non publiable en actif protégé : « ${id} »`);
    }

    const steps = Array.isArray(diagnostic.steps) ? diagnostic.steps : [];
    const publicSteps = steps.map((step, position) =>
      position < FREE_STEP_COUNT ? step : stripStepAnswers(step),
    );

    // `synthesis` est la conclusion du raisonnement : elle ne sort qu'après la
    // dernière décision, donc jamais dans l'index public.
    const { synthesis, ...rest } = diagnostic;
    index.push({ ...rest, steps: publicSteps });

    answers.push({
      file,
      payload: {
        schemaVersion: PROTECTED_ANSWER_SCHEMA_VERSION,
        diagnosticId: diagnostic.id ?? id,
        steps: steps.slice(FREE_STEP_COUNT).map((step) => ({
          id: step.id,
          correct: step.correct,
          explanation: step.explanation,
        })),
        synthesis,
      },
    });
  }

  return { index, answers };
}

/** Sérialisation stable : mêmes octets pour les mêmes données. */
function serialise(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Écriture atomique : un lecteur parallèle voit l'ancien ou le nouveau fichier. */
function atomicWrite(dest, contents) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.split-demarches-tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, dest);
}

/**
 * Applique le split dans un espace de travail.
 *
 * @returns {{indexChanged: boolean, protectedWritten: string[], removed: string[]}}
 */
export function splitDiagnostics({ root = projectRoot(), log = () => {} } = {}) {
  const sourcePath = join(root, ...DIAGNOSTICS_SOURCE);
  const indexPath = join(root, ...DIAGNOSTICS_INDEX);
  const privateDir = join(root, ...PROTECTED_ANSWERS_DIR);

  // Pas de source : on ne touche jamais la copie publique (repli explicite).
  if (!existsSync(sourcePath)) return { indexChanged: false, protectedWritten: [], removed: [] };

  const diagnostics = JSON.parse(readFileSync(sourcePath, "utf8"));
  const { index, answers } = splitDiagnosticsPayload(diagnostics);

  const indexContents = serialise(index);
  let indexChanged = false;
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== indexContents) {
    atomicWrite(indexPath, indexContents);
    indexChanged = true;
  }

  const protectedWritten = [];
  for (const asset of answers) {
    const dest = join(privateDir, asset.file);
    const contents = serialise(asset.payload);
    if (existsSync(dest) && readFileSync(dest, "utf8") === contents) continue;
    atomicWrite(dest, contents);
    protectedWritten.push(asset.file);
  }

  // Orphelin (chapitre retiré ou renommé) : un actif oublié dans `private/`
  // finirait dans le bundle serveur sans raison.
  const expected = new Set(answers.map((asset) => asset.file));
  const removed = [];
  if (existsSync(privateDir)) {
    for (const name of readdirSync(privateDir)) {
      if (!name.endsWith(".json") || expected.has(name)) continue;
      rmSync(join(privateDir, name));
      removed.push(name);
    }
  }

  if (indexChanged) {
    log(`[split-demarches] ${DIAGNOSTICS_INDEX.join("/")} mis à jour (${index.length} chapitres)`);
  }
  if (protectedWritten.length > 0) {
    log(`[split-demarches] ${protectedWritten.length} corrigé(s) protégé(s) écrit(s)`);
  }
  if (removed.length > 0) log(`[split-demarches] ${removed.length} corrigé(s) protégé(s) retiré(s)`);

  return { indexChanged, protectedWritten, removed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), "scripts", "split-demarches.mjs")) {
  const result = splitDiagnostics({ log: console.log });
  if (!result.indexChanged && result.protectedWritten.length === 0 && result.removed.length === 0) {
    console.log("[split-demarches] index public et corrigés protégés déjà à jour");
  }
}
