// Contrat de l'audit mobile (320 / 360 / 390 px) — garde-fou d'un faux vert.
//
// HISTOIRE DU BUG (2026-10-22, CI `release-check` rouge) :
// l'audit exige qu'un écran ait un repère `<main>` (`mainCount > 0`). Il est
// passé au rouge sur les 5 routes, à toutes les largeurs, avec pour seule
// anomalie `mainCount: 0` — ni débordement, ni erreur console. Cause : depuis
// que l'artefact de production porte la configuration cloud (AUTH-8), un
// visiteur ANONYME ne voit plus l'application sur ces routes mais la porte
// d'entrée (écran de chargement en SSR, puis écran de connexion), et CES DEUX
// ÉCRANS étaient des `<div>`. Le document n'avait donc aucun landmark.
//
// Ce fichier verrouille trois choses :
//   1. tout écran que peut afficher le gate porte un repère `<main>` ;
//   2. ces repères ne dupliquent pas `id="main-content"` (l'`id` du `Shell`) ;
//   3. l'audit DIT quel écran il a mesuré (`gate`) et continue d'échouer sur
//      `mainCount === 0` — sans quoi on remplacerait un bug par un silence.
//
// Lecture seule : les sources sont inspectées, rien n'est exécuté côté navigateur.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");

const AUTH_SCREEN = "src/components/AuthScreen.tsx";
const ROOT_ROUTE = "src/routes/__root.tsx";
const SHELL = "src/components/shell.tsx";
const AUDIT = "scripts/mobile-ui-smoke.mjs";

/** Le contenu rendu par `CloudSplash` (jusqu'à la fermeture du composant). */
function cloudSplashSource() {
  const source = read(ROOT_ROUTE);
  const start = source.indexOf("function CloudSplash()");
  assert.notEqual(start, -1, "CloudSplash introuvable dans src/routes/__root.tsx");
  const end = source.indexOf("\nfunction ", start + 1);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

test("l'écran de connexion est un repère <main> (et non un <div>)", () => {
  const source = read(AUTH_SCREEN);
  assert.match(
    source,
    /<main\b[^>]*\n?[^>]*data-cloud-auth="screen"/,
    "le conteneur de AuthScreen doit être <main data-cloud-auth=\"screen\">",
  );
  assert.doesNotMatch(
    source,
    /<div\b[^>]*data-cloud-auth="screen"/,
    "un <div data-cloud-auth=\"screen\"> ne fournit aucun landmark",
  );
});

test("l'écran de chargement du gate est un repère <main>", () => {
  const splash = cloudSplashSource();
  assert.match(
    splash,
    /<main\b[^>]*data-cloud-gate="splash"/,
    "CloudSplash doit rendre <main data-cloud-gate=\"splash\"> : c'est le HTML SSR de TOUTE route protégée",
  );
  assert.doesNotMatch(splash, /<div\b[^>]*data-cloud-gate="splash"/);
});

test("les repères du gate ne dupliquent pas l'id du Shell", () => {
  // `Shell`/`Page` porte `id="main-content"` (cible du lien d'évitement). Un
  // écran de gate qui réutiliserait cet identifiant produirait un doublon d'id
  // (HTML invalide) dès qu'il est rendu à l'intérieur du shell — c'est le cas de
  // `/login`, qui monte AuthScreen dans l'Outlet.
  assert.doesNotMatch(read(AUTH_SCREEN), /<main\b[^>]*id="main-content"/);
  assert.doesNotMatch(cloudSplashSource(), /<main\b[^>]*id="main-content"/);
  // Le shell, lui, doit conserver son repère unique.
  assert.match(read(SHELL), /<main id="main-content"/);
});

test("l'audit mobile publie l'écran réellement mesuré", () => {
  const audit = read(AUDIT);
  assert.match(audit, /data-cloud-gate="splash"/, "l'audit doit détecter l'écran de chargement");
  assert.match(audit, /data-cloud-auth="screen"/, "l'audit doit détecter l'écran de connexion");
  assert.match(audit, /gate:\s*metrics\.gate/, "chaque résultat doit porter son `gate`");
  assert.match(audit, /gates\[result\.gate\]/, "le verdict doit agréger les écrans mesurés");
});

test("un document sans repère principal reste un échec d'audit", () => {
  const audit = read(AUDIT);
  assert.match(
    audit,
    /result\.mainCount === 0/,
    "supprimer le critère mainCount === 0 transformerait l'audit en faux vert",
  );
  assert.match(audit, /bottomNavTargetsTooSmall > 0/, "le seuil tactile de 44 px reste exigé");
});

// ─────────── Deux cibles de QA : artefact publié vs fonctionnalités ──────────

const QA_BUILT = "scripts/qa-built-mobile.mjs";

test("les smokes de fonctionnalité ne sont pas joués derrière la porte de connexion", () => {
  const runner = read(QA_BUILT);
  // `/import` et le parcours critique décrivent le monde SANS COMPTE
  // (OM-GUEST, IndexedDB). Dans l'artefact de production, ces écrans sont
  // derrière la porte : les y jouer échoue sur un `textarea` introuvable, ce qui
  // ne dit rien de la fonctionnalité. Mesuré en CI avant correctif.
  assert.match(
    runner,
    /runAudit\("scripts\/imported-deck-browser-smoke\.mjs", DEV_URL\)/,
    "l'import de Deck doit être joué sur la cible sans porte (serveur de dev)",
  );
  assert.match(
    runner,
    /runAudit\("scripts\/mobile-critical-journey-smoke\.mjs", DEV_URL\)/,
    "le parcours critique doit être joué sur la cible sans porte",
  );
  // L'audit de MISE EN PAGE reste, lui, sur l'artefact réellement publié.
  assert.match(
    runner,
    /runAudit\("scripts\/mobile-ui-smoke\.mjs", BASE_URL\)/,
    "l'audit de mise en page doit rester sur l'artefact de production",
  );
});

test("la cible sans porte est obtenue par configuration, pas par un drapeau de test", () => {
  const runner = read(QA_BUILT);
  // Neutraliser la configuration cloud utilise le comportement PRODUIT
  // (`configured:false` ⇒ porte transparente). Un `VITE_QA_MODE` créerait un
  // chemin de contournement capable d'atteindre la production s'il était déployé.
  assert.match(runner, /VITE_SUPABASE_URL: ""/, "l'URL cloud doit être vidée sur la cible sans porte");
  assert.match(
    runner,
    /VITE_SUPABASE_ANON_KEY: ""/,
    "les DEUX variables doivent être vidées : une seule ne suffit pas à désactiver le client",
  );
  assert.doesNotMatch(
    runner,
    /VITE_QA_MODE|QA_GATE_BYPASS|DISABLE_AUTH/,
    "aucun drapeau de contournement ne doit exister : la porte est une décision produit",
  );
});

test("l'authentification est neutralisée sur la cible sans porte", () => {
  const runner = read(QA_BUILT);
  // Avec l'auth active, la passerelle historique appelle `/api/auth/get-session` ;
  // les routes serveur (nitro) n'existant qu'en `build`/`preview`, cette route
  // répond 404 en développement. Mesuré : deux erreurs console suffisaient à faire
  // échouer un smoke sans aucun défaut applicatif.
  assert.match(
    runner,
    /VITE_AUTH_ENABLED: "false"/,
    "la cible sans compte doit aussi neutraliser l'authentification",
  );
  // Le build, lui, ne doit JAMAIS recevoir cette valeur : c'est le rôle de
  // `scripts/assert-supabase-build.mjs` côté publication, et le smoke de prod
  // tourne sur un artefact où l'auth est celle du déploiement.
  assert.doesNotMatch(
    runner,
    /process\.env\.VITE_AUTH_ENABLED\s*=\s*"false"/,
    "la neutralisation ne doit pas fuiter dans l'environnement du build",
  );
});

test("le serveur de dev est préchauffé avant les smokes de fonctionnalité", () => {
  const runner = read(QA_BUILT);
  // Vite pré-optimise ses dépendances au premier chargement et recharge la page
  // en cours (« optimized dependencies changed »). Mesuré en CI : le smoke de
  // l'import tombait dans cette fenêtre et échouait sur `504 (Outdated Optimize
  // Dep)` + deux `404`, sans aucun défaut applicatif.
  assert.match(
    runner,
    /runAudit\("scripts\/dev-server-warmup\.mjs", DEV_URL\)/,
    "un préchauffage doit précéder les smokes de fonctionnalité",
  );
  const warmupIndex = runner.indexOf('runAudit("scripts/dev-server-warmup.mjs", DEV_URL)');
  const persistenceIndex = runner.indexOf('runAudit("scripts/imported-deck-browser-smoke.mjs", DEV_URL)');
  assert.ok(
    warmupIndex !== -1 && persistenceIndex !== -1 && warmupIndex < persistenceIndex,
    "le préchauffage doit être exécuté AVANT le smoke de l'import",
  );
});
