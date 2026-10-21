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
  // embarque minuteur et rapport d'épreuve, ≈ +10 KiB sur son chunk ; le
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
  //
  // Relevé 2000 → 2080 KiB (batch 1 : fiches « HTA essentielle » et « Diabète
  // de type 2 »). Mesure : 2039,1 KiB en local, auth ON, `.env.local` écarté
  // (= configuration CI). Les deux fiches ajoutent ~74 KiB de contenu, mais
  // chacune dans SON chunk (≈ 39 et ≈ 35 KiB) : le chunk principal ne bouge
  // pas, c'est `scripts/bundle-content.test.mjs` qui le garantit désormais.
  // CI ≈ local + ~25 KiB (toolchain Node 22) ⇒ ~2063,6 KiB ; plafond 2080 KiB
  // = marge volontairement faible (~16,4 KiB), même philosophie.
  // ⚠️ Le batch suivant (10 fiches, ≈ +350 KiB) aurait dépassé ce plafond.
  // La réponse n'a PAS été de le relever : les fiches sont devenues des ACTIFS
  // STATIQUES (public/content/pathologies/*.json) servis par fetch().
  //
  // Relevé 2080 → **1960 KIBI (ABAISSÉ)** le 2026-10-18 avec ce changement :
  //   • avant : 2 039,1 KiB mesurés, dont ~121 KiB de chunks de fiches
  //     (paludisme 50,3 + hta 42,1 + diabète 39,3) ;
  //   • après : 1 909,6 KiB mesurés (auth ON, `.env.local` écarté) — les trois
  //     chunks ont disparu, le reste du bundle n'a pas bougé.
  // CI ≈ local + ~25 KiB ⇒ ~1 934,6 KiB ; plafond 1 960 KiB = marge
  // volontairement faible (~25,4 KiB), même philosophie. Le plafond REDESCEND
  // parce qu'il doit suivre le code, pas les circonstances : conserver 2 080
  // aurait laissé 146 KiB de faux mou (quatre sessions de dérive silencieuse).
  // Ajouter 40 fiches désormais : 0 octet de JavaScript, donc 0 octet de budget.
  //
  // Relevé 1960 → **2176 KIBI** le 2026-10-19 (backend Supabase, Phase 1).
  //   • Le SDK `@supabase/supabase-js` pèse 208,8 KiB et il est INDISPENSABLE
  //     (session, RLS, synchronisation de la progression).
  //   • Il a d'abord été importé statiquement : le chunk d'ENTRÉE est passé de
  //     577 à 608,2 KiB et les pages publiques (/tarifs, pages légales)
  //     téléchargeaient un client d'authentification dont elles n'ont aucun
  //     besoin. Il est désormais chargé **paresseusement** : l'entrée est
  //     revenue à 398,5 KiB (−224 KiB sur le chemin critique), et le SDK vit
  //     dans son propre chunk, compté dans le total.
  //   • Mesures : 2 120,4 KiB en local (avec les variables Supabase, auth OFF
  //     via `.env.local`) ; ~2 144 KiB en production (auth ON, +~24 KiB) ⇒
  //     plafond 2 176 KiB = marge volontairement faible (~32 KiB).
  //   • En CI GitHub, les variables `VITE_SUPABASE_*` sont absentes : le
  //     `if (!isSupabaseConfigured) return` devient constant, le `import()`
  //     dynamique est éliminé et le chunk n'est pas émis (~1 936 KiB). La
  //     mesure CI est donc PLUS BASSE que la production : c'est le chiffre de
  //     production qui fixe le plafond, pas celui de la CI.
  //
  // Relevé 2176 → **2192 KIBI** le 2026-10-21 (contenu : deck pilote premium
  // « neuro-epi-l3 » — épilepsie L3, 10 questions sourcées ILAE/HAS/OMS).
  // Le deck ajoute ~13,5 KiB de JSON répartis dans le chunk du catalogue
  // (entrée decks.json, chargée à la demande mais comptée dans le total) et
  // le chunk du deck lui-même ; la marge restante (~12 KiB) était plus fine
  // que le deck. Mesure CI : 2 177,3 KiB — dépassement de 1,3 KiB du plafond
  // de 2 176 KiB posé le 2026-10-19. Plafond 2 192 KiB = marge volontairement
  // faible (~14,7 KiB), même philosophie que les relevés précédents.
  //
  // Relevé 2192 → **2216 KIBI** le 2026-10-21 (contenu : vague 2 des cas
  // cliniques multi-spécialités — 5 nouveaux dossiers dans cases.json :
  // fibrillation atriale (premium), acidocétose inaugurale, pré-éclampsie
  // sévère, fièvre typhoïde, gastro-entérite pédiatrique — plus la navigation
  // /cas : recherche plein texte, pastilles de filtre par spécialité, état
  // vide, et le bouton « Enregistrer et enchaîner » de la vue détail). Le
  // catalogue cases.json grossit de ~24 KiB ; il est importé par la route
  // /cas, donc compté dans le total ; la marge restante (~14,7 KiB) était
  // plus fine que la vague. Mesure CI : 2 199,9 KiB — dépassement de 7,9 KiB
  // du plafond de 2 192 KiB. Plafond 2 216 KiB = marge volontairement
  // faible (~16,1 KiB), même philosophie que les relevés précédents.
  //
  // Relevé 2216 → **2296 KIBI** le 2026-10-21 (contenu : pack NEURO complet —
  // 7 decks premium : neuro-avc-l3/l4/l5/int (AVC L3→INTERNE) et
  // neuro-epi-l4/l5/int (épilepsie L4→INTERNE), 10 questions sourcées chacun,
  // accès pro / NEURO_PACK_15). decks.json grossit de ~98 KiB (47 → 54 decks,
  // 497 → 567 questions) : l'entrée du catalogue est comptée dans le total et
  // chaque deck vit dans son propre chunk chargé à la demande ; la marge
  // restante (~16,1 KiB) était plus fine que le pack. Mesure CI : 2 279,6 KiB
  // — dépassement de 63,6 KiB du plafond de 2 216 KiB posé le 2026-10-21.
  // Plafond 2 296 KiB = marge volontairement faible (~16,4 KiB), même
  // philosophie que les relevés précédents.
  maxTotalJavascriptBytes: 2296 * 1024,
  maxPublicAssetBytes: 512 * 1024,
  maxTotalPublicAssetBytes: 2 * 1024 * 1024,
  // Actifs de CONTENU (`public/content/**`). ⚠️ Depuis la session Sécurité
  // Premium S1 (2026-10-18), il ne devrait PLUS y en avoir : les 133 fiches
  // vivent dans `private/content/**` et sont compilées dans le bundle SERVEUR,
  // donc hors du dossier publié et hors de ce budget client. Le plafond reste
  // en veille pour deux raisons : (1) un actif de contenu qui réapparaîtrait
  // dans `public/` doit rester borné (256 Kio/fichier = signal de mauvais
  // découpage) ; (2) le manifeste public `public/content/signes/_index.json`
  // est légitime et minuscule.
  //
  // Ce que le budget NE mesure PAS, volontairement : le contenu protégé pèse
  // ~1,4 Mo de JSON brut (~255 Kio gzip) dans le bundle serveur. C'est une
  // contrainte de plateforme (taille d'un Worker), pas un budget client —
  // documentée dans docs/performance.md, avec la réponse d'échelle (R2/KV) si
  // le catalogue atteint quelques centaines de fiches.
  maxContentAssetBytes: 256 * 1024,
});

const STATIC_DIR_CANDIDATES = [
  ".vercel/output/static",
  ".netlify/static",
  ".output/public",
  "dist",
];

const ASSET_DIR_CANDIDATES = STATIC_DIR_CANDIDATES.map((directory) => `${directory}/assets`);

export function findAssetDirectory(root = process.cwd()) {
  for (const relativePath of ASSET_DIR_CANDIDATES) {
    const absolute = resolve(root, relativePath);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) return absolute;
  }
  return null;
}

/**
 * Dossier STATIQUE publié (celui que sert le CDN), indépendamment des chunks.
 * Sert aux garde-fous qui vérifient que les actifs de contenu (fiches de
 * nosographie) sont bien publiés comme fichiers, hors bundle JS.
 * Même liste que `findAssetDirectory`, sans le suffixe `/assets`.
 */
export function findStaticDirectory(root = process.cwd()) {
  for (const relativePath of STATIC_DIR_CANDIDATES) {
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

  // Les actifs de CONTENU sont suivis séparément : ce sont des données
  // téléchargées à la demande, pas les ressources du shell applicatif.
  const contentAssets = files.filter((file) => file.name.startsWith("content/"));
  const shellAssets = files.filter((file) => !file.name.startsWith("content/"));

  const totalPublicAssetBytes = shellAssets.reduce((sum, file) => sum + file.bytes, 0);
  const totalContentAssetBytes = contentAssets.reduce((sum, file) => sum + file.bytes, 0);
  const violations = [];

  for (const file of shellAssets) {
    if (file.bytes > budget.maxPublicAssetBytes) {
      violations.push(
        `${file.name}: public asset ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxPublicAssetBytes)}`,
      );
    }
  }
  for (const file of contentAssets) {
    if (file.bytes > budget.maxContentAssetBytes) {
      violations.push(
        `${file.name}: contenu ${formatBytes(file.bytes)} exceeds ${formatBytes(budget.maxContentAssetBytes)} (plafond par fiche)`,
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
    publicAssetFiles: shellAssets.length,
    largestPublicAssets: [...shellAssets].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    contentAssets: {
      totalBytes: totalContentAssetBytes,
      files: contentAssets.length,
      largest: [...contentAssets].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    },
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
