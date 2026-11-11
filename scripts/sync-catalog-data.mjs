#!/usr/bin/env node
/**
 * Synchronise `public/data/*.json` depuis la source `src/content/data/*.json`.
 *
 * Le client charge les catalogues (decks, cas, démarches) par `fetch("/data/…")`
 * depuis `public/data` — cf. src/content/catalog.ts. Ces fichiers sont des
 * DÉRIVÉS de la source `src/content/data` : si la copie publique prend du
 * retard sur la source, l'app affiche des chapitres « En préparation » (le
 * routeId n'est pas résolu dans DIAGNOSTIC_CASES) alors que le contenu existe
 * bel et bien. C'est exactement ce qui est arrivé au lot des 43 démarches :
 * src/content/data/diagnostics.json (245 Ko, 43 cas) servait via une copie
 * publique restée à 6 cas.
 *
 * ⚠️ `decks.json` et `cases.json` ne sont PLUS copiés tels quels : depuis les
 * correctifs P0/§14 du pentest, les questions des decks premium et le contenu
 * des dossiers cliniques fermés ne doivent pas être publiés. Leurs copies
 * publiques sont produites par `scripts/split-decks.mjs` et
 * `scripts/split-cases.mjs` (index sans contenu + actifs dans
 * `private/content/`). Le resynchroniseur garde donc un seul rôle par fichier :
 * copie à l'octet (démarches) ou split déterministe (decks, cas).
 *
 * Tout démarrage Vite (dev, build, preview — les variantes :cloudflare,
 * :netlify et :worker comprises) resynchronise la copie AVANT que Vite ne
 * copie `public/` vers la sortie : le dérivé ne peut plus jamais déployer un
 * catalogue périmé.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitCases } from "./split-cases.mjs";
import { splitDecks } from "./split-decks.mjs";

/** Catalogues recopiés à l'octet depuis la source. */
const COPIED_CATALOG_FILES = ["diagnostics.json"];

/** Le workspace root (ce fichier vit dans `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/** Copie atomique : un lecteur parallèle voit l'ancien ou le nouveau fichier. */
function atomicWrite(src, dest) {
  const tmp = `${dest}.catalog-sync-tmp`;
  writeFileSync(tmp, readFileSync(src, "utf8"));
  renameSync(tmp, dest);
}

/**
 * Recopie chaque catalogue src → public si, et seulement si, il diverge.
 * `decks.json` passe par le split (jamais les questions premium en clair).
 * Retourne la liste des fichiers resynchronisés (vide = déjà à jour).
 */
export function syncCatalogData({ root = projectRoot(), log = () => {} } = {}) {
  const srcDir = join(root, "src", "content", "data");
  const destDir = join(root, "public", "data");
  mkdirSync(destDir, { recursive: true });
  const synced = [];

  // Decks : index public sans les questions premium + actifs protégés.
  if (splitDecks({ root, log }).indexChanged) synced.push("decks.json");

  // Cas cliniques : index public en teaser + dossiers protégés.
  if (splitCases({ root, log }).indexChanged) synced.push("cases.json");

  for (const name of COPIED_CATALOG_FILES) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    // Pas de source : on ne touche jamais la copie (repli explicite).
    if (!existsSync(src)) continue;
    if (existsSync(dest) && readFileSync(dest, "utf8") === readFileSync(src, "utf8")) continue;
    atomicWrite(src, dest);
    synced.push(name);
  }

  if (synced.length > 0) {
    log(`[catalog-sync] ${synced.join(", ")} resynchronisé(s) depuis src/content/data`);
  }
  return synced;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.cwd(), "scripts", "sync-catalog-data.mjs")) {
  const synced = syncCatalogData({ log: console.log });
  if (synced.length === 0) console.log("[catalog-sync] public/data déjà à jour");
}
