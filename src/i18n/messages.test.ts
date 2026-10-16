import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE, isLocale, localeDir, translate } from "./core.ts";
import { fr } from "./messages/fr.ts";
import { en } from "./messages/en.ts";
import { es } from "./messages/es.ts";
import { pt } from "./messages/pt.ts";

const catalogs = { fr, en, es, pt };

test("fr, en, es et pt sont des catalogues jumeaux aux clés identiques", () => {
  const frKeys = Object.keys(fr).sort();
  assert.ok(frKeys.length >= 100);
  assert.deepEqual(frKeys, Object.keys(en).sort());
  assert.deepEqual(frKeys, Object.keys(es).sort());
  assert.deepEqual(frKeys, Object.keys(pt).sort());
  for (const value of Object.values(fr)) {
    assert.ok(typeof value === "string" || typeof value === "function");
  }
});

test("translate résout les clés simples dans les quatre langues", () => {
  assert.equal(translate("fr", "nav.home", {}, catalogs), "Accueil");
  assert.equal(translate("en", "nav.home", {}, catalogs), "Home");
  assert.equal(translate("es", "nav.home", {}, catalogs), "Inicio");
  assert.equal(translate("pt", "nav.home", {}, catalogs), "Início");
  assert.equal(translate("fr", "nav.search", {}, catalogs), "Rechercher…");
  assert.equal(translate("en", "profil.confort", {}, catalogs), "Study comfort");
  assert.equal(translate("es", "profil.language", {}, catalogs), "Idioma");
  assert.equal(translate("pt", "profil.language", {}, catalogs), "Idioma");
});

test("translate fait un repli sur le français si la clé manque dans la langue", () => {
  // C21 : le registre complet est requis (Record<Locale, MessageCatalog>) ;
  // on retire la clé du seul catalogue anglais pour prouver le repli.
  const partial = { ...catalogs, en: { ...en } };
  delete partial.en["nav.home"];
  assert.equal(translate("en", "nav.home", {}, partial), "Accueil");
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
  assert.equal(
    translate("es", "dash.questionsLeft", { count: 5 }, catalogs),
    "5 preguntas restantes",
  );
  assert.equal(
    translate("pt", "dash.questionsLeft", { count: 5 }, catalogs),
    "5 perguntas restantes",
  );
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
  assert.equal(translate("es", "onb.step", { current: 2, total: 4 }, catalogs), "Paso 2 de 4");
  assert.equal(translate("pt", "onb.step", { current: 2, total: 4 }, catalogs), "Passo 2 de 4");
  assert.equal(translate("fr", "dash.questionsUnit", {}, catalogs), "questions");
  assert.equal(translate("en", "dash.questionsUnit", {}, catalogs), "questions");
  assert.equal(translate("es", "dash.questionsUnit", {}, catalogs), "preguntas");
  assert.equal(translate("pt", "dash.questionsUnit", {}, catalogs), "perguntas");
  assert.equal(
    translate("fr", "dash.idTooltip", {}, catalogs),
    "Ton identifiant Optimus — il lie tes achats et licences à ce profil",
  );
  assert.equal(
    translate("en", "dash.idTooltip", {}, catalogs),
    "Your Optimus ID — it links your purchases and licenses to this profile",
  );
  assert.equal(
    translate("es", "dash.idTooltip", {}, catalogs),
    "Tu identificador Optimus — vincula tus compras y licencias a este perfil",
  );
  assert.equal(
    translate("pt", "dash.idTooltip", {}, catalogs),
    "O teu identificador Optimus — liga as tuas compras e licenças a este perfil",
  );
  assert.equal(translate("fr", "nav.pricing", {}, catalogs), "Combien ça coûte ?");
  assert.equal(translate("en", "nav.pricing", {}, catalogs), "How much does it cost?");
  assert.equal(translate("es", "nav.pricing", {}, catalogs), "¿Cuánto cuesta?");
  assert.equal(translate("pt", "nav.pricing", {}, catalogs), "Quanto custa?");
  assert.equal(translate("fr", "dash.compareTitle", {}, catalogs), "Gratuit ou Premium ?");
  assert.equal(translate("fr", "dash.compareCta", {}, catalogs), "Voir les tarifs");
  assert.equal(translate("en", "dash.compareCta", {}, catalogs), "See pricing");
  assert.equal(translate("es", "dash.compareCta", {}, catalogs), "Ver tarifas");
  assert.equal(translate("pt", "dash.compareCta", {}, catalogs), "Ver preços");
});

test("année, ligue et niveau gardent leur formulation par langue", () => {
  assert.equal(translate("fr", "dash.yearShort", { year: 1 }, catalogs), "1re année");
  assert.equal(translate("fr", "dash.yearShort", { year: 5 }, catalogs), "5e année");
  assert.equal(translate("fr", "dash.yearShort", { year: 0 }, catalogs), "Cursus");
  assert.equal(translate("en", "dash.yearShort", { year: 1 }, catalogs), "1st year");
  assert.equal(translate("en", "dash.yearShort", { year: 5 }, catalogs), "5th year");
  assert.equal(translate("en", "dash.yearShort", { year: 0 }, catalogs), "Curriculum");
  assert.equal(translate("es", "dash.yearShort", { year: 5 }, catalogs), "5.º año");
  assert.equal(translate("pt", "dash.yearShort", { year: 5 }, catalogs), "5.º ano");
  const sep = translate("fr", "dash.levelSep", {}, catalogs);
  assert.equal(
    translate("fr", "dash.levelWithTitle", { level: 3, title: "Confirmé" }, catalogs),
    "Niveau 3" + sep + "Confirmé",
  );
  assert.equal(translate("fr", "dash.league", { label: "Or" }, catalogs), "ligue Or");
  assert.equal(translate("en", "dash.league", { label: "Gold" }, catalogs), "Gold league");
  assert.equal(translate("es", "dash.league", { label: "Oro" }, catalogs), "liga Oro");
  assert.equal(translate("pt", "dash.league", { label: "Ouro" }, catalogs), "liga Ouro");
});

test("les utilitaires de locale exposent le contrat des quatre langues", () => {
  assert.equal(DEFAULT_LOCALE, "fr");
  assert.equal(isLocale("fr"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("es"), true);
  assert.equal(isLocale("pt"), true);
  assert.equal(isLocale("mg"), false);
  assert.equal(localeDir("fr"), "ltr");
  assert.equal(localeDir("en"), "ltr");
  assert.equal(localeDir("es"), "ltr");
  assert.equal(localeDir("pt"), "ltr");
});
