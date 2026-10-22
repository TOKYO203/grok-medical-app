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
