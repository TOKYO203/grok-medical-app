import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE } from "./core.ts";
import { applyDetectedLocale, detectLocale } from "./detect.ts";

test("detectLocale mappe les langues du navigateur vers les locales supportées", () => {
  assert.equal(detectLocale(["fr-FR", "en-US"]), "fr");
  assert.equal(detectLocale(["en-GB", "fr-FR"]), "en");
  assert.equal(detectLocale(["es-AR", "en-US"]), "es");
  assert.equal(detectLocale(["pt-BR", "en-US"]), "pt");
  assert.equal(detectLocale(["pt-PT"]), "pt");
});

test("detectLocale revient au français par défaut", () => {
  assert.equal(detectLocale([]), DEFAULT_LOCALE);
  assert.equal(detectLocale(["mg-MG", "zh-CN"]), DEFAULT_LOCALE);
  assert.equal(detectLocale(["de-DE"]), DEFAULT_LOCALE);
});

test("detectLocale ignore la casse, les espaces et les variantes régionales", () => {
  assert.equal(detectLocale([" ES-419 "]), "es");
  assert.equal(detectLocale(["PT-br"]), "pt");
  assert.equal(detectLocale(["en-US", "es-ES"]), "en");
});

test("applyDetectedLocale est inoffensive côté serveur", () => {
  assert.equal(applyDetectedLocale(), false);
});
