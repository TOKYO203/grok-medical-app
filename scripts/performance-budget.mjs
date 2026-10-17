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
  // Relevé 104 → 120 KiB (Design System, Session A) : les fondations ajoutent
  // ~5,8 KiB de jetons (typographie, espacement, rayons, ombres, 5 tones × 6
  // déclinaisons — chaque `color-mix` est émis avec son repli `@supports`), les
  // 9 classes `.type-*` (~1,5 KiB) et les utilitaires des composants pilotes.
  // Mesure après optimisation de la vitrine (mise en page sur l'échelle
  // Tailwind, identique à `--sp-N`) : 116,2 KiB. Marge volontairement faible
  // (~3,8 KiB), même philosophie que les relevés précédents.
  maxStylesheetBytes: 120 * 1024,
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
  // Relevé 1824 → 1832 KiB avec les animations mindmap (c76c694 + 847343f) :
  // 50 lignes CSS mortes et 12 clés i18n orphelines déjà purgées avant relevé.
  // Marge : ~1,8 KiB (mesuré 1830,2 KiB côté CI).
  // Relevé 1832 → 1864 KiB (Session 13 « examen blanc » : la page /examen
  // embarque minuteur et rapport d’épreuve, ≈ +10 KiB sur son chunk ; le
  // total exact reste rapporté par ce garde-fou à chaque build).
  // Relevé 1864 → 1888 KiB (Session 17 « crédibilité » : journal des versions
  // public /changelog + canal email institutionnel B20).
  //
  // ⚠️ Le total dépend de la CONFIGURATION COMPILÉE, pas seulement du code :
  // la CI et le déploiement compilent avec l'authentification ACTIVE
  // (`VITE_AUTH_ENABLED` absent ⇒ `authEnabled` vaut true dans
  // src/lib/auth/client.ts), tandis qu'un poste de dev peut porter un
  // `.env.local` (non versionné) `VITE_AUTH_ENABLED=false` qui retire tout le
  // client d'auth du bundle. Mesures reproductibles au commit de référence :
  //   • auth ON, sans `.env.local` (= configuration CI / déploiement) :
  //     1846,6 KiB en local, 1871,3 KiB en CI (ubuntu-latest, Node 22) — l'écart
  //     d'environnement/toolchain (~25 KiB) est reproductible, pas du code ;
  //   • auth OFF (`.env.local` du poste de dev) : 1822,5 KiB.
  // Le plafond doit donc couvrir la mesure CI (1871,3 KiB) avec la marge
  // volontairement faible du projet (~17 KiB) → 1888 KiB. Mesurer un budget
  // « local » avec l'auth désactivée donne une fausse marge de ~65 KiB.
  //
  // Relevé 1888 → 2000 KiB (Nosographie : fiche de cours « Paludisme »).
  // ⚠️ Le plafond de 1888 KiB était DÉJÀ dépassé AVANT ce chantier : mesuré au
  // commit de base (8a39adb), auth ON, sans aucune de ces modifications,
  // le total vaut 1896,1 KiB. L'escalier des sujets (IA-1→IA-7) et la carte
  // mentale enrichie ont chacun ajouté du bundle sans reprendre la mesure, et
  // le relèvement correspondant (1960 KiB) vit sur une autre branche, non
  // fusionnée ici : sur CETTE base, le plafond de 1888 est rouge de 8,1 KiB.
  // Mesure de ce chantier : 1958,5 KiB en local (auth ON), soit +62,4 KiB :
  //   • 50,3 KiB = la fiche elle-même (contenu JSON, chunk « paludisme »
  //     chargé À LA DEMANDE — aucun octet dans le bundle initial) ;
  //   • 7,0 KiB = la route /pathologie/$slug (3 vues + gating + liens) ;
  //   • ~5 KiB = clés i18n × 4 langues et le lien « Fiche » de /programme.
  // Aucune purge possible pour compenser : les octets sont du CONTENU médical
  // et une route, pas du code mort (les 74 fichiers morts recensés par l'audit
  // ne sont pas bundlés, les supprimer n'allège pas le bundle).
  // CI ≈ local + ~25 KiB (toolchain Node 22 vs 24) ⇒ ~1983,5 KiB ; plafond
  // 2000 KiB = marge volontairement faible (~16,5 KiB), même philosophie.
  // NOTE D'ÉCHELLE : à 240 fiches de cette taille, le total exploserait. Le
  // format tient parce que chaque fiche est un chunk à part ; si le catalogue
  // se remplit, la prochaine étape est de servir les JSON comme actifs
  // téléchargeables plutôt que de relever ce plafond (décision documentée dans
  // docs/DECISIONS.md, NOSO-2).
  maxTotalJavascriptBytes: 2000 * 1024,
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
