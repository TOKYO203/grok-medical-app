// Tests du registre des unités cliniques standardisées (C28).
import assert from "node:assert/strict";
import test from "node:test";
import { CLINICAL_UNITS, NARROW_NBSP, formatMeasurement, parseMeasurement } from "./units.ts";

test("formatMeasurement insère une espace fine insécable avant le symbole", () => {
  const fr = formatMeasurement(80, "bpm", "fr");
  assert.ok(fr.includes(NARROW_NBSP), "espace fine insécable attendue");
  assert.ok(fr.endsWith("bpm"));
  assert.ok(formatMeasurement(120, "mmHg", "pt").endsWith("mmHg"));
});

test("le séparateur décimal suit la langue de l'interface", () => {
  assert.equal(formatMeasurement(12.5, "gPerL", "fr"), "12,5" + NARROW_NBSP + "g/L");
  assert.equal(formatMeasurement(12.5, "gPerL", "en"), "12.5" + NARROW_NBSP + "g/L");
  assert.equal(formatMeasurement(37.5, "celsius", "fr"), "37,5" + NARROW_NBSP + "°C");
});

test("le registre couvre les unités cliniques courantes avec symboles SI", () => {
  assert.equal(CLINICAL_UNITS.mmHg.symbol, "mmHg");
  assert.equal(CLINICAL_UNITS.kgPerM2.symbol, "kg/m²");
  assert.equal(CLINICAL_UNITS.mmolPerL.symbol, "mmol/L");
  for (const unit of Object.values(CLINICAL_UNITS)) {
    assert.ok(unit.symbol.length > 0, "symbole manquant pour " + unit.id);
    assert.ok(unit.label.length > 0, "libellé manquant pour " + unit.id);
  }
});

test("parseMeasurement accepte virgule et point, rejette l'invalide", () => {
  assert.equal(parseMeasurement("12,5"), 12.5);
  assert.equal(parseMeasurement(" 12.5 "), 12.5);
  assert.equal(parseMeasurement("12,5" + NARROW_NBSP), 12.5);
  assert.equal(parseMeasurement("abc"), null);
  assert.equal(parseMeasurement(""), null);
});
