#!/usr/bin/env node
/**
 * Pentest 2026-11-09 §15 : retire les fiches de démarches de l'artefact de
 * build. `public/content/demarches/*.json` reste la SOURCE ÉDITORIALE (elle
 * alimente le manifeste et la copie privée faite par sync-catalog-data.mjs),
 * mais l'artefact publié ne doit plus les contenir : elles sont servies par le
 * garde `/content/$type/$file` contre un jeton de contenu.
 *
 * Idempotent : ne lève jamais si le dossier de build est absent (le script
 * peut tourner avant/après les autres post-build). Seul `_index.json`
 * (manifeste public, aucun contenu de fiche) est conservé.
 *
 * La logique est EXPORTÉE pour être testable sur un build temporaire : le test
 * ne doit pas dépendre de la présence d'un `dist/` local (ligne CI-3).
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Candidats de sortie selon le preset Vite (client classique ou Nitro). */
export const DIST_CANDIDATES = ["dist", ".output/public", ".output"];

/** Le workspace root (ce fichier vit dans `<root>/scripts/`). */
export function projectRoot() {
  return join(fileURLToPath(import.meta.url), "..", "..");
}

/**
 * Retire les fiches de démarches de chaque artefact présent sous `root`.
 * @returns le nombre de fichiers supprimés (0 = déjà propre ou build absent).
 */
export function stripDemarchesFromDist({ root = projectRoot() } = {}) {
  let removed = 0;
  for (const candidate of DIST_CANDIDATES) {
    const dir = join(root, candidate, "content", "demarches");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || name === "_index.json") continue;
      rmSync(join(dir, name), { force: true });
      removed += 1;
    }
  }
  return removed;
}

// Exécution directe UNIQUEMENT — même garde que sync-catalog-data.mjs : le test
// importe ce module, il ne doit pas nettoyer le dépôt au passage.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const removed = stripDemarchesFromDist();
  if (removed > 0) {
    console.log(`[strip-demarches] ${removed} fiche(s) de démarche retirée(s) de l'artefact de build`);
  } else {
    console.log("[strip-demarches] rien à retirer (déjà propre ou build absent)");
  }
}
