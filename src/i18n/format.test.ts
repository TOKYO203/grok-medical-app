import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTime, formatFullDate, formatShortDate, localeTag } from "./format.ts";

test("chaque locale est mappée sur une étiquette Intl", () => {
  assert.equal(localeTag("fr"), "fr-FR");
  assert.equal(localeTag("en"), "en-GB");
  assert.equal(localeTag("es"), "es-ES");
  assert.equal(localeTag("pt"), "pt-PT");
});

test("les dates courtes suivent la locale", () => {
  const ts = Date.UTC(2026, 9, 15); // 15 octobre 2026
  const fr = formatShortDate(ts, "fr");
  const en = formatShortDate(ts, "en");
  assert.ok(fr.includes("15"), "jour visible en fr");
  assert.ok(fr.toLowerCase().includes("oct"), "mois court fr");
  assert.ok(en.includes("15"), "jour visible en en");
  assert.ok(en.includes("Oct"), "mois court en");
  assert.ok(formatShortDate(ts, "pt").toLowerCase().includes("out"), "mois court pt (out.)");
  assert.ok(formatShortDate(ts, "es").toLowerCase().includes("oct"), "mois court es");
});

test("les dates complètes et horodatages incluent l'année", () => {
  const ts = Date.UTC(2026, 9, 15, 10, 30);
  assert.ok(formatFullDate(ts, "fr").includes("2026"));
  assert.ok(formatFullDate(ts, "en").includes("2026"));
  assert.ok(formatDateTime(ts, "es").includes("2026"));
  assert.ok(formatDateTime(ts, "pt").includes("2026"));
});

test("les sorties différencient les locales supportées", () => {
  const ts = Date.UTC(2026, 9, 15);
  const fr = formatShortDate(ts, "fr");
  const en = formatShortDate(ts, "en");
  const es = formatShortDate(ts, "es");
  const pt = formatShortDate(ts, "pt");
  // Paires structurellement distinctes quelle que soit la version ICU du
  // runner : mois capitalisé en anglais, mois espagnol en minuscules,
  // rendu pt différent de fr. fr et es peuvent abréger « oct » à l'identique
  // selon les données CLDR : on vérifie le contenu espagnol plutôt que
  // l'inégalité fr/es.
  assert.notEqual(fr, en);
  assert.notEqual(fr, pt);
  assert.notEqual(en, pt);
  assert.notEqual(es, en);
  assert.notEqual(es, pt);
  assert.ok(es.includes("15") && es.toLowerCase().includes("oct"), "es affiche jour et mois");
});
