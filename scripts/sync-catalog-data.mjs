#!/usr/bin/env node
/**
 * Génère les catalogues PUBLICS et les actifs PRIVÉS depuis la source gelée
 * `src/content/data/*.json` (pentest 2026-11-09 §1/§14/§15).
 *
 * AVANT : `public/data/*.json` était une copie BRUTE de la source — les 775
 * questions des decks Pro, les 33 cas cliniques Pro (218 Kio) et les 43 QCM
 * de démarche étaient servis en clair par le CDN, sans jeton.
 *
 * MAINTENANT, pour chaque catalogue :
 *   • `public/data/<name>.json` est une PROJECTION publique : les decks Pro
 *     gardent leurs métadonnées (titre, spécialité, `questionCount`) mais
 *     perdent `questions` ; les cas Pro perdent `patient`/`steps`/
 *     `diagnosis`/`management`/`pitfall`/`keyTakeaway` ; les démarches
 *     perdent `steps`/`synthesis` (la vignette reste, c'est un teaser).
 *   • `private/content/<famille>/<id>.json` porte l'objet COMPLET, servi
 *     uniquement par le garde `/content/$type/$file` contre un jeton de
 *     contenu (`Authorization: Bearer`), comme les pathologies et signes.
 *
 * Les fiches enrichies de démarches (`public/content/demarches/*.json`,
 * source de vérité éditoriale) sont COPIÉES vers `private/content/demarches/`
 * et retirées de l'artefact publié par `scripts/strip-demarches-from-dist.mjs`.
 *
 * Déploiement 2026-11-10 : prod = Worker `optimus-medical-prod` (64 MiB) ;
 * le projet Pages (25 MiB) ne peut plus embarquer ce contenu et est à pause.
 *
 * Tout démarrage Vite (dev, build, preview — variantes :cloudflare/:netlify/
 * :worker comprises) régénère les dérivés AVANT que Vite ne copie `public/`
 * vers la sortie : le déploiement ne peut plus jamais publier le contenu
 * payant en clair. Les dossiers `private/content/{decks,cases,diagnostics,
 * demarches}/` sont générés (gitignore) — la source reste `src/content/data`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Le workspace root (ce fichier vit dans `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/** Écriture atomique : un lecteur parallèle voit l'ancien ou le nouveau fichier. */
function atomicWriteText(dest, text) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.catalog-sync-tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, dest);
}

function writeIfChanged(dest, text) {
  if (existsSync(dest) && readFileSync(dest, "utf8") === text) return false;
  atomicWriteText(dest, text);
  return true;
}

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Un deck Pro devient une carte de catalogue : métadonnées, jamais les
 * questions. Un deck GRATUIT garde ses questions et sa grille de correction
 * (`correct`, correction immédiate) mais perd l'explication — modèle freemium
 * v2 (docs/MODEL-FREEMIUM.md, chantier 1) : « le gratuit fait goûter, le
 * premium fait passer ». L'explication est servie aux sessions premium/essai
 * par POST /api/quiz/answer.
 */
function publicDeck(deck) {
  if (deck.access_policy?.tier !== "pro") {
    if (!Array.isArray(deck.questions)) return deck;
    return {
      ...deck,
      questions: deck.questions.map((question) => {
        if (!question || typeof question !== "object") return question;
        const { explanation: _explanation, ...rest } = question;
        return rest;
      }),
    };
  }
  const { questions, ...rest } = deck;
  return { ...rest, questions: [], questionCount: Array.isArray(questions) ? questions.length : 0 };
}

/** Un cas clinique Pro garde son résumé (teaser), jamais le dossier complet. */
const CASE_PROJECTION_FIELDS = [
  "id", "title", "specialty", "studyYear", "difficulty", "summary", "access", "related",
];

function publicClinicalCase(item) {
  if (item.access !== "pro") return item;
  const projection = {};
  for (const field of CASE_PROJECTION_FIELDS) {
    if (item[field] !== undefined) projection[field] = item[field];
  }
  // Le teaser Pro porte toujours ses liens « à lire ensuite » : le contrat de
  // scripts/freemium-explanations.test.mjs fixe la liste exacte des clés du
  // teaser — vide si la source ne définit aucun cas relié.
  if (projection.related === undefined) projection.related = [];
  return projection;
}

/** Une démarche garde sa vignette (teaser), jamais les QCM ni la synthèse. */
const DIAGNOSTIC_PROJECTION_FIELDS = ["id", "title", "specialty", "vignette"];

function publicDiagnostic(item) {
  const projection = {};
  for (const field of DIAGNOSTIC_PROJECTION_FIELDS) {
    if (item[field] !== undefined) projection[field] = item[field];
  }
  return projection;
}

/** Nom de fichier privé sûr pour chaque famille (aucune traversée possible). */
const SAFE_ID = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/;

// Projections exportées pour les tests (scripts/freemium-explanations.test.mjs).
export { publicDeck, publicClinicalCase, publicDiagnostic };

function privateFileName(id) {
  if (typeof id !== "string" || !SAFE_ID.test(id)) {
    throw new Error(`identifiant non utilisable comme fichier privé : ${JSON.stringify(id)}`);
  }
  return `${id}.json`;
}

/** Copie les fiches enrichies de démarches vers le dossier privé (généré). */
function syncDemarcheAssets({ root, log }) {
  const publicDir = join(root, "public", "content", "demarches");
  const privateDir = join(root, "private", "content", "demarches");
  if (!existsSync(publicDir)) return false;
  rmSync(privateDir, { recursive: true, force: true });
  mkdirSync(privateDir, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(publicDir)) {
    if (!name.endsWith(".json")) continue;
    cpSync(join(publicDir, name), join(privateDir, name));
    copied += 1;
  }
  if (copied > 0) log(`[catalog-sync] ${copied} fiche(s) de démarche copiée(s) vers private/content/demarches`);
  return copied > 0;
}

/**
 * Régénère les projections publiques et les actifs privés depuis la source.
 * Retourne la liste des catalogues resynchronisés (vide = déjà à jour).
 */
export function syncCatalogData({ root = projectRoot(), log = () => {} } = {}) {
  const srcDir = join(root, "src", "content", "data");
  const destDir = join(root, "public", "data");
  mkdirSync(destDir, { recursive: true });
  const synced = [];

  const generate = (name, { project, family }) => {
    const src = join(srcDir, name);
    // Pas de source : on ne touche jamais la copie (repli explicite).
    if (!existsSync(src)) return;
    const source = JSON.parse(readFileSync(src, "utf8"));
    if (!Array.isArray(source)) throw new Error(`${name} : la source n'est pas un tableau`);

    const familyDir = join(root, "private", "content", family);
    let changed = false;

    for (const item of source) {
      const text = serialize(item);
      if (writeIfChanged(join(familyDir, privateFileName(item.id)), text)) changed = true;
    }
    // Un actif privé qui n'existe plus dans la source est retiré (contenu retiré).
    if (existsSync(familyDir)) {
      const expected = new Set(source.map((item) => `${item.id}.json`));
      for (const name_ of readdirSync(familyDir)) {
        if (name_.endsWith(".json") && !expected.has(name_)) {
          rmSync(join(familyDir, name_), { force: true });
          changed = true;
        }
      }
    }

    const publicText = serialize(source.map(project));
    if (writeIfChanged(join(destDir, name), publicText)) changed = true;
    if (changed) synced.push(name);
  };

  generate("decks.json", { project: publicDeck, family: "decks" });
  generate("cases.json", { project: publicClinicalCase, family: "cases" });
  generate("diagnostics.json", { project: publicDiagnostic, family: "diagnostics" });
  syncDemarcheAssets({ root, log });

  if (synced.length > 0) {
    log(`[catalog-sync] ${synced.join(", ")} : projections publiques + actifs privés régénérés`);
  }
  return synced;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), "scripts", "sync-catalog-data.mjs")) {
  const synced = syncCatalogData({ log: console.log });
  if (synced.length === 0) console.log("[catalog-sync] catalogues déjà à jour");
}

