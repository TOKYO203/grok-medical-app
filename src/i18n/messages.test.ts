import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE, isLocale, localeDir, translate } from "./core.ts";
import { fr } from "./messages/fr.ts";
import { en } from "./messages/en.ts";

const catalogs = { fr, en };

test("fr et en sont des catalogues jumeaux aux clés identiques", () => {
  const frKeys = Object.keys(fr).sort();
  const enKeys = Object.keys(en).sort();
  assert.ok(frKeys.length >= 100);
  assert.deepEqual(frKeys, enKeys);
  for (const value of Object.values(fr)) {
    assert.ok(typeof value === "string" || typeof value === "function");
  }
});

test("translate résout les clés simples dans les deux langues", () => {
  assert.equal(translate("fr", "nav.home", {}, catalogs), "Accueil");
  assert.equal(translate("en", "nav.home", {}, catalogs), "Home");
  assert.equal(translate("fr", "nav.search", {}, catalogs), "Rechercher…");
  assert.equal(translate("en", "profil.confort", {}, catalogs), "Study comfort");
});

test("translate fait un repli sur le français si la clé manque dans la langue", () => {
  const partial = { ...en };
  delete partial["nav.home"];
  assert.equal(translate("en", "nav.home", {}, { fr, en: partial }), "Accueil");
});

test("une clé inconnue renvoie la clé elle-même", () => {
  assert.equal(translate("fr", "clé.inconnue", {}, catalogs), "clé.inconnue");
});

test("les contrats de pluriel respectent les gabarits d'origine", () => {
  assert.equal(translate("fr", "dash.questionsLeft", { count: 1 }, catalogs), "1 question restante");
  assert.equal(
    translate("fr", "dash.questionsLeft", { count: 5 }, catalogs),
    "5 questions restantes",
  );
  assert.equal(translate("en", "dash.questionsLeft", { count: 5 }, catalogs), "5 questions left");
  assert.equal(translate("fr", "dash.cardsDue", { count: 1 }, catalogs), "1 carte due");
  assert.equal(translate("fr", "dash.cardsDue", { count: 5 }, catalogs), "5 cartes dues");
  assert.equal(translate("en", "dash.cardsDue", { count: 1 }, catalogs), "1 card due");
  assert.equal(translate("fr", "dash.streakDays", { count: 1 }, catalogs), "1 jour d'affilée");
  assert.equal(translate("fr", "dash.streakDays", { count: 5 }, catalogs), "5 jours d'affilée");
  assert.equal(translate("en", "dash.streakDays", { count: 5 }, catalogs), "5 days in a row");
  assert.equal(translate("fr", "dash.hello", {}, catalogs), "Bonjour");
  assert.equal(translate("fr", "dash.hello", { name: "Fetra" }, catalogs), "Bonjour, Fetra");
  assert.equal(translate("en", "dash.hello", { name: "Fetra" }, catalogs), "Hello, Fetra");
  assert.equal(
    translate("fr", "quiz.correct", { count: 3, xp: 30 }, catalogs),
    "Juste · combo 3 · +30 XP combo",
  );
  assert.equal(
    translate("fr", "quiz.summary", { max: 3 }, catalogs),
    "Combo max 3. L’XP mesure l’effort — la Mastery, la compétence.",
  );
  assert.equal(translate("fr", "onb.step", { current: 2, total: 4 }, catalogs), "Étape 2 sur 4");
  assert.equal(translate("en", "onb.step", { current: 2, total: 4 }, catalogs), "Step 2 of 4");
  assert.equal(translate("fr", "dash.outOf", { goal: 10 }, catalogs), "sur 10");
});

test("année, ligue et niveau gardent leur formulation française", () => {
  assert.equal(translate("fr", "dash.yearShort", { year: 1 }, catalogs), "1re année");
  assert.equal(translate("fr", "dash.yearShort", { year: 5 }, catalogs), "5e année");
  assert.equal(translate("fr", "dash.yearShort", { year: 0 }, catalogs), "Cursus");
  assert.equal(translate("en", "dash.yearShort", { year: 1 }, catalogs), "1st year");
  assert.equal(translate("en", "dash.yearShort", { year: 5 }, catalogs), "5th year");
  assert.equal(translate("en", "dash.yearShort", { year: 0 }, catalogs), "Curriculum");
  const sep = translate("fr", "dash.levelSep", {}, catalogs);
  assert.equal(
    translate("fr", "dash.levelWithTitle", { level: 3, title: "Confirmé" }, catalogs),
    "Niveau 3" + sep + "Confirmé",
  );
  assert.equal(translate("fr", "dash.league", { label: "Or" }, catalogs), "ligue Or");
  assert.equal(translate("en", "dash.league", { label: "Gold" }, catalogs), "Gold league");
});

test("les utilitaires de locale exposent le contrat de la Phase 3", () => {
  assert.equal(DEFAULT_LOCALE, "fr");
  assert.equal(isLocale("fr"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("mg"), false);
  assert.equal(localeDir("fr"), "ltr");
  assert.equal(localeDir("en"), "ltr");
});
