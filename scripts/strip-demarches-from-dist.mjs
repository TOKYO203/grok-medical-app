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
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/** Candidats de sortie selon le preset Vite (client classique ou Nitro). */
const CANDIDATES = ["dist", ".output/public", ".output"];

let removed = 0;
for (const candidate of CANDIDATES) {
  const dir = join(root, candidate, "content", "demarches");
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "_index.json") continue;
    rmSync(join(dir, name), { force: true });
    removed += 1;
  }
}

if (removed > 0) {
  console.log(`[strip-demarches] ${removed} fiche(s) de démarche retirée(s) de l'artefact de build`);
} else {
  console.log("[strip-demarches] rien à retirer (déjà propre ou build absent)");
}
