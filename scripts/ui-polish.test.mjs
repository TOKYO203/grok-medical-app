import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const parcours = readFileSync(new URL("../src/routes/parcours.tsx", import.meta.url), "utf8");
const cases = readFileSync(new URL("../src/routes/cas.tsx", import.meta.url), "utf8");
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

test("progress motion still honors the global reduced-motion escape hatch", () => {
  assert.match(styles, /optimus-progress-fill/);
  assert.match(styles, /data-optimus-motion="reduced"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
