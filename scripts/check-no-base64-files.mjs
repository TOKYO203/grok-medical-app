#!/usr/bin/env node
/**
 * Garde-fou anti-base64 (incident du commit #468, corrigé par #473).
 *
 * CE QUI S'EST PASSÉ : un outil de contribution a poussé le CONTENU base64
 * d'un fichier source à la place de son code (une seule ligne base64 dans
 * server/middleware/admin-guard.ts). Build prod ET suite de tests sont
 * tombés sur main, et la croix rouge a masqué les vrais échecs de PR.
 *
 * CE QUE FAIT CE SCRIPT : échoue si un fichier texte suivi contient une
 * plage base64 continue anormalement longue (> 600 caractères), signature
 * d'un contenu encodé par erreur. Les données base64 légitimes volumineuses
 * (data-URI d'images, sourcemaps) sont exclues par extension ou par la liste
 * d'exclusion ci-dessous.
 *
 * Branché dans .github/workflows/ci.yml (job tests, bloquant) juste après
 * le checkout : il ne coûte rien et couvre aussi les commits directs sur main.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MIN_RUN = 600;
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|json|jsonc|md|css|scss|html|yml|yaml|txt|vue|svelte)$/;
const IGNORE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/;

/** Plage base64 stricte : uniquement [A-Za-z0-9+/=], sans espace ni ponctuation. */
const B64_RUN = new RegExp("[A-Za-z0-9+/=]{" + MIN_RUN + ",}");

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => TEXT_EXT.test(f) && !IGNORE.test(f));

const offenders = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(B64_RUN);
    if (match) {
      offenders.push(file + ":" + (i + 1) + " (plage base64 de " + match[0].length + " caractères)");
      break;
    }
  }
}

if (offenders.length > 0) {
  console.error(
    "[anti-base64] contenu possiblement encodé en base64 détecté — un contenu" +
      " a probablement été poussé EN LIEU ET PLACE de son code :\n  " +
      offenders.join("\n  ") +
      "\nCorriger le fichier source (décoder ou restaurer le vrai contenu)," +
      " ou ajouter une exception justifiée dans scripts/check-no-base64-files.mjs.",
  );
  process.exit(1);
}
console.log("[anti-base64] OK : aucune plage base64 suspecte dans les fichiers suivis.");
