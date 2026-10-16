#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PERFORMANCE_BUDGET = Object.freeze({
  // Plafond par chunk : un chunk ne doit jamais dépasser ce seuil. Relevé
  // 550 → 576 KiB avec la démarche enrichie « Douleur thoracique » : le chunk
  // partagé (react-dom + zod + i18n + données médicales, un seul chunk côté
  // client) mesurait 570,4 KiB et franchissait donc le plafond de 550 KiB qui
  // n'avait plus que ~12 KiB de marge. Reste volontairement serré (~5,6 KiB).
  // Relevé 576 → 584 KiB avec la carte mentale « niveau éditorial » (recherche,
  // isolement, plein écran, export SVG, arêtes courbes) : après purge du code
  // mort (50 lignes CSS + 12 entrées i18n), le chunk partagé mesure 577,0 KiB.
  // Marge volontairement faible (~7 KiB), même philosophie.
  maxJavascriptChunkBytes: 584 * 1024,
  // Relevé 100 → 104 KiB (même chantier) : le CSS de la mindmap (trame, voile
  // d'isolement, surlignage de recherche, pulsation de repère) pèse ~2 KiB ;
  // après purge des 3 dégradés de profil morts (`cover-hautes-terres/baobab/
  // canal`, remplacés par des images) la feuille mesure 100,2 KiB.
  maxStylesheetBytes: 104 * 1024,
  // Plafond global : relevé 1536 → 1664 KiB (chantier « Calculateurs ») puis
  // 1664 → 1704 KiB après le moteur ECG multi-cycles (chunk EcgMonitor ≈ 54 KiB)
  // et le moniteur auscultation — total mesuré 1677,4 KiB. Marge volontairement
  // faible (~26 KiB) pour continuer à détecter toute dérive de bundle.
  // Relevé 1704 → 1728 KiB (Session 1 « business model » : page /tarifs, prix
  // multi-devises, essai 7 jours, teaser 30 s, badges progressifs) — total mesuré
  // 1706,2 KiB. Marge volontairement faible (~21,8 KiB), même philosophie.
  // Relevé 1728 → 1756 KiB (Session 3 « i18n » : catalogues jumeaux es/pt,
  // dates locale-aware, registre d'unités cliniques) — total mesuré
  // 1733,8 KiB. Marge volontairement faible (~22,2 KiB), même philosophie.
  // Relevé 1756 → 1792 KiB avec la démarche enrichie « Douleur thoracique »
  // (fiche + flashcards + mindmap, contenu JSON offline + 4 vues) — total mesuré
  // 1767,3 KiB. Même philosophie de marge volontairement faible (~24,7 KiB).
  // Relevé 1792 → 1824 KiB avec la carte mentale « niveau éditorial »
  // (recherche, isolement, plein écran, export SVG, moteur de disposition radiale
  // testé) — total mesuré 1804,4 KiB après purge du code mort. Marge volontairement
  // faible (~19,6 KiB), même philosophie.
  maxTotalJavascriptBytes: 1824 * 1024,
  maxPublicAssetBytes: 512 * 1024,
  maxTotalPublicAssetBytes: 2 * 1024 * 1024,
});

const ASSET_DIR_CANDIDATES = [
  ".vercel/output/static/assets",
  ".netlify/static/assets",
  ".output/public/assets",
  "dist/assets",
];

export function findAssetDirectory(root = process.cwd()) {
  for (const relativePath of ASSET_DIR_CANDIDATES) {
    const absolute = resolve(root, relativePath);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) return absolute;
  }
  return null;
}

export function inspectPublicAssetBudget(publicDirectory, budget = PERFORMANCE_BUDGET) {
  if (!existsSync(publicDirectory) || !statSync(publicDirectory).isDirectory()) {
    return {
      ok: true,
      totalPublicAssetBytes: 0,
      publicAssetFiles: 0,
      largestPublicAssets: [],
      violations: [],
    };
  }

  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push({
          name: relative(publicDirectory, absolute),
          bytes: statSync(absolute).size,
        });
      }
    }
  };
  walk(publicDirectory);

  const totalPublicAssetBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const violations = [];

  for (const file of files) {
    if (file.bytes > budget.maxPublicAssetBytes) {
      violations.push(
        `${file.name}: public asset ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxPublicAssetBytes)}`,
      );
    }
  }

  if (totalPublicAssetBytes > budget.maxTotalPublicAssetBytes) {
    violations.push(
      `total public assets ${formatBytes(totalPublicAssetBytes)} exceeds ${formatBytes(budget.maxTotalPublicAssetBytes)}`,
    );
  }

  return {
    ok: violations.length === 0,
    totalPublicAssetBytes,
    publicAssetFiles: files.length,
    largestPublicAssets: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    violations,
  };
}

export function inspectPerformanceBudget(assetDirectory, budget = PERFORMANCE_BUDGET) {
  const files = readdirSync(assetDirectory)
    .map((name) => ({ name, bytes: statSync(resolve(assetDirectory, name)).size }))
    .filter((file) => /\.(?:js|css)$/i.test(file.name));

  const javascript = files.filter((file) => /\.js$/i.test(file.name));
  const stylesheets = files.filter((file) => /\.css$/i.test(file.name));
  const totalJavascriptBytes = javascript.reduce((sum, file) => sum + file.bytes, 0);

  const violations = [];
  for (const file of javascript) {
    if (file.bytes > budget.maxJavascriptChunkBytes) {
      violations.push(
        `${file.name}: JS chunk ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxJavascriptChunkBytes)}`,
      );
    }
  }
  for (const file of stylesheets) {
    if (file.bytes > budget.maxStylesheetBytes) {
      violations.push(
        `${file.name}: stylesheet ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxStylesheetBytes)}`,
      );
    }
  }
  if (totalJavascriptBytes > budget.maxTotalJavascriptBytes) {
    violations.push(
      `total client JS ${formatBytes(totalJavascriptBytes)} exceeds ${formatBytes(budget.maxTotalJavascriptBytes)}`,
    );
  }

  const largestJavascript = [...javascript].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  const largestStylesheets = [...stylesheets].sort((a, b) => b.bytes - a.bytes).slice(0, 3);

  return {
    ok: violations.length === 0,
    budget,
    totalJavascriptBytes,
    javascriptFiles: javascript.length,
    stylesheetFiles: stylesheets.length,
    largestJavascript,
    largestStylesheets,
    violations,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function main() {
  const root = process.cwd();
  const assetDirectory = findAssetDirectory(root);
  if (!assetDirectory) {
    console.error(
      "[performance-budget] client asset directory not found after build; refusing to skip the budget gate.",
    );
    process.exitCode = 1;
    return;
  }

  const clientReport = inspectPerformanceBudget(assetDirectory);
  const publicReport = inspectPublicAssetBudget(resolve(root, "public"));
  const violations = [...clientReport.violations, ...publicReport.violations];
  const report = {
    ...clientReport,
    ok: violations.length === 0,
    violations,
    publicAssets: publicReport,
  };

  console.log(
    JSON.stringify(
      {
        ...report,
        assetDirectory,
        totalJavascript: formatBytes(report.totalJavascriptBytes),
        totalPublicAssets: formatBytes(publicReport.totalPublicAssetBytes),
      },
      null,
      2,
    ),
  );

  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
