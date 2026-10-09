#!/usr/bin/env node
/**
 * audit-content.mjs — Contrôle d'intégrité de la refonte contenu médical (2026).
 *
 * Vérifie les invariants suivants (cf. décisions validées) :
 *   1. Un deck = un seul usage dans le curriculum  (aucun doublon).
 *   2. Aucun deck « fantôme » : tout deck référencé existe dans decks.json.
 *   3. Aucun deck « orphelin » : tout deck de decks.json est référencé.
 *   4. Toute branche NON marquée `skeleton: true` est peuplée (≥ 1 deck).
 *
 * Sécurité : lecture seule. decks.json n'est JAMAIS écrit par ce script.
 *
 * Usage : node scripts/audit-content.mjs
 * Sortie : code 0 si tout est OK, code 1 si au moins une anomalie est détectée.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DECKS_PATH = path.join(ROOT, "src/content/data/decks.json");
const CURRICULUM_PATH = path.join(ROOT, "src/content/curriculum.ts");

/* ── Chargement (lecture seule) ─────────────────────────────────────── */

const decksRaw = await readFile(DECKS_PATH, "utf8");
const decks = JSON.parse(decksRaw);
const deckById = new Map(decks.map((d) => [d.id, d]));

const mod = await import(pathToFileURL(CURRICULUM_PATH).href);
const curricula =
  typeof mod.listCurricula === "function"
    ? mod.listCurricula()
    : Object.values(mod.CURRICULA ?? {});

/* ── Analyse ────────────────────────────────────────────────────────── */

const errors = [];
const usage = new Map(); // deckId -> ["specialtyId/branchId", ...]
let branchCount = 0;
let skeletonCount = 0;
const emptyNonSkeleton = [];

for (const specialty of curricula) {
  for (const branch of specialty.branches ?? []) {
    branchCount += 1;

    if (branch.skeleton === true) {
      skeletonCount += 1;
      continue; // branche squelette : exclue des contrôles
    }

    const decksInBranch = branch.decks ?? [];
    if (decksInBranch.length === 0) {
      emptyNonSkeleton.push(`${specialty.id}/${branch.id}`);
    }

    for (const deckId of decksInBranch) {
      if (!deckById.has(deckId)) {
        errors.push(
          `fantôme  : ${specialty.id}/${branch.id} référence « ${deckId} », absent de decks.json`,
        );
      }
      const places = usage.get(deckId) ?? [];
      places.push(`${specialty.id}/${branch.id}`);
      usage.set(deckId, places);
    }
  }
}

// 1. Doublons (un deck utilisé dans plusieurs branches/spécialités)
for (const [deckId, places] of usage) {
  if (places.length > 1) {
    errors.push(`doublon  : « ${deckId} » utilisé ${places.length}× (${places.join(", ")})`);
  }
}

// 4. Branches vides non marquées squelette
for (const ref of emptyNonSkeleton) {
  errors.push(`branche vide (non-squelette) : ${ref}`);
}

// 3. Orphelins (decks présents dans decks.json mais référencés nulle part)
const orphans = decks.filter((d) => !usage.has(d.id)).map((d) => d.id);
for (const id of orphans) {
  errors.push(`orphelin : deck « ${id} » présent dans decks.json mais non référencé`);
}

/* ── Rapport ────────────────────────────────────────────────────────── */

console.log("=== audit-content.mjs ===");
console.log(`spécialités              : ${curricula.length}`);
console.log(`branches                 : ${branchCount} (dont squelettes : ${skeletonCount})`);
console.log(`decks.json               : ${decks.length}`);
console.log(`decks référencés uniques : ${usage.size}`);
console.log("");

if (errors.length > 0) {
  console.log(`ÉCHEC — ${errors.length} anomalie(s) :`);
  for (const error of errors) console.log(`  ✗ ${error}`);
  console.log("");
  console.log("Résultat : ÉCHEC");
  process.exit(1);
}

console.log("Résultat : OK — aucun doublon, fantôme, orphelin ou branche vide non-squelette.");
process.exit(0);
