import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const parcours = readFileSync(new URL("../src/routes/parcours.tsx", import.meta.url), "utf8");
const cases = readFileSync(new URL("../src/routes/cas.tsx", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
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
const errorComponent = readFileSync(
  new URL("../src/lib/error-component.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

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
  assert.match(cases, /optimus-interactive-card/);
});

test("parcours and clinical cases expose progress summaries and explicit states", () => {
  assert.match(parcours, /Résumé des parcours/);
  assert.match(parcours, /Disponibles/);
  assert.match(parcours, /En cours/);
  assert.match(parcours, /Terminés/);
  assert.match(cases, /Progression des cas cliniques/);
  assert.match(cases, /Disponible/);
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
  assert.match(installCard, /display-mode: standalone/);
  assert.match(installCard, /\/\?install=1/);
  assert.match(installCard, /Optimus est installé/);
});

test("global error state is user-facing in French and hides raw details in production", () => {
  assert.match(errorComponent, /Impossible d’afficher cet écran/);
  assert.match(errorComponent, /Réessayer/);
  assert.match(errorComponent, /Accueil/);
  assert.match(errorComponent, /import\.meta\.env\.DEV/);
});

test("progress motion still honors the global reduced-motion escape hatch", () => {
  assert.match(styles, /optimus-progress-fill/);
  assert.match(styles, /data-optimus-motion="reduced"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
