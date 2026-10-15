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

test("les sorties différencient les locales latines", () => {
  const ts = Date.UTC(2026, 9, 15);
  const formats = [formatShortDate(ts, "fr"), formatShortDate(ts, "en"), formatShortDate(ts, "es"), formatShortDate(ts, "pt")];
  assert.equal(new Set(formats).size, 4);
});
