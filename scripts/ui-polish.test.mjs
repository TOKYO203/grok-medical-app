import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const parcours = readFileSync(new URL("../src/routes/parcours.tsx", import.meta.url), "utf8");
const cases = readFileSync(new URL("../src/routes/cas.tsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("../src/routes/cas.$caseId.tsx", import.meta.url), "utf8");
const contentCard = readFileSync(
  new URL("../src/components/content/content-card.tsx", import.meta.url),
  "utf8",
);
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/shell.tsx", import.meta.url), "utf8");
const connectivity = readFileSync(
  new URL("../src/components/connectivity-status.tsx", import.meta.url),
  "utf8",
);
const resumeBridge = readFileSync(
  new URL("../src/components/app-resume-bridge.tsx", import.meta.url),
  "utf8",
);
const installCard = readFileSync(
  new URL("../src/components/pwa-install-card.tsx", import.meta.url),
  "utf8",
);
const installHook = readFileSync(
  new URL("../src/hooks/use-pwa-install.ts", import.meta.url),
  "utf8",
);
const errorComponent = readFileSync(
  new URL("../src/lib/error-component.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
// Phase 3 (i18n) : la copie française visible vit dans le catalogue de messages.
const frCatalog = readFileSync(new URL("../src/i18n/messages/fr.ts", import.meta.url), "utf8");

test("home exposes an accessible skeleton instead of a blank loading screen", () => {
  assert.match(home, /HomeSkeleton/);
  assert.match(home, /aria-busy="true"/);
  assert.match(home, /optimus-skeleton/);
  assert.match(styles, /optimus-skeleton-shimmer/);
});

test("interactive learning cards share restrained motion and depth", () => {
  assert.match(styles, /optimus-interactive-card/);
  assert.match(home, /optimus-interactive-card/);
  assert.match(parcours, /optimus-interactive-card/);
  // Depuis le refactor ContentCard, /cas rend la primitive partagée, qui porte
  // la classe interactive — on vérifie donc la primitive ET son usage dans /cas.
  assert.match(contentCard, /optimus-interactive-card/);
  assert.match(cases, /<ContentCard/);
});

test("parcours and clinical cases expose progress summaries and explicit states", () => {
  assert.match(parcours, /Résumé des parcours/);
  assert.match(parcours, /Disponibles/);
  assert.match(parcours, /En cours/);
  assert.match(parcours, /Terminés/);
  assert.match(cases, /Progression des cas cliniques/);
  assert.match(cases, /Accessibles/);
  assert.match(cases, /Premium/);
  assert.match(cases, /Terminé/);
});

test("offline mode stays explicit without blocking local learning", () => {
  assert.match(root, /<ConnectivityStatus \/>/);
  assert.match(connectivity, /navigator\.onLine/);
  assert.match(connectivity, /previous === false && next/);
  assert.match(connectivity, /Mode hors ligne/);
  assert.match(connectivity, /synchronisation reprendra/);
  assert.match(connectivity, /Connexion rétablie/);
});

test("app resume refreshes existing online workflows without pretending to be online", () => {
  assert.match(root, /<AppResumeBridge \/>/);
  assert.match(resumeBridge, /navigator\.onLine/);
  assert.match(resumeBridge, /visibilitychange/);
  assert.match(resumeBridge, /pageshow/);
  assert.match(resumeBridge, /window\.dispatchEvent\(new Event\("online"\)\)/);
  assert.match(resumeBridge, /RESUME_THROTTLE_MS/);
});

test("PWA installation is discoverable and standalone-aware", () => {
  assert.match(home, /<PwaInstallCard \/>/);
  // La détection standalone vit dans le hook ; la carte porte l'UI (état installé,
  // instructions par plateforme) — la page d'installation reste servie par le chrome plateforme.
  assert.match(installHook, /display-mode: standalone/);
  assert.match(installCard, /Optimus est installé/);
  assert.match(installCard, /Installer Optimus/);
});

test("global error state is user-facing in French and hides raw details in production", () => {
  assert.match(errorComponent, /Impossible d’afficher cet écran/);
  assert.match(errorComponent, /Réessayer/);
  assert.match(errorComponent, /Accueil/);
  assert.match(errorComponent, /import\.meta\.env\.DEV/);
});

test("main navigation supports keyboard users and current-page semantics", () => {
  // Phase 3 (i18n) : la navigation lit ses libellés et aria-labels via t() ;
  // on vérifie le branchement dans le composant et la copie française dans le catalogue.
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /t\("nav\.skipContent"\)/);
  assert.match(frCatalog, /Aller au contenu/);
  assert.match(shell, /id="main-content"/);
  assert.match(shell, /tabIndex=\{-1\}/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /aria-label=\{t\("nav\.ariaPrimary"\)\}/);
  assert.match(frCatalog, /Navigation principale/);
});

test("progress motion still honors the global reduced-motion escape hatch", () => {
  assert.match(styles, /optimus-progress-fill/);
  assert.match(styles, /data-optimus-motion="reduced"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("clinical case navigation keeps search, specialty filters and chaining explicit", () => {
  // Vague 2 : /cas doit rester parcourable sur mobile — recherche plein texte,
  // filtres par spécialité (flex-wrap, aucun débordement) et enchaînement des dossiers.
  assert.match(cases, /data-cas-search/);
  assert.match(cases, /specialtyFacets/);
  assert.match(cases, /resolveSpecialty/);
  assert.match(cases, /Filtrer par spécialité/);
  assert.match(cases, /Aucun dossier ne correspond/);
  assert.match(caseDetail, /CLINICAL_CASES/);
  assert.match(caseDetail, /Enregistrer et enchaîner/);
});
