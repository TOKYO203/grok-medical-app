import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { listCurricula } from "../../content/curriculum.ts";
import { LEVEL_ORDER } from "../../core/curriculum.ts";
import {
  buildDeckSeries,
  buildDeckSeriesIndex,
  deriveStepLabel,
  extractDeckLevel,
  seriesShortLabel,
  STEP_LABEL_OVERRIDES,
} from "./deck-series.ts";

type RawDeck = { id: string; title: string };

const decks: RawDeck[] = JSON.parse(
  readFileSync(new URL("../../content/data/decks.json", import.meta.url), "utf8"),
);
const titles = new Map(decks.map((deck) => [deck.id, deck.title]));
const series = buildDeckSeries(listCurricula(), titles);

/**
 * Garde-fou de « l'escalier » (refonte de présentation du contenu).
 *
 * Un deck est une **strate de niveau** d'un sujet, pas un sujet. Ces tests
 * verrouillent les propriétés qui rendent l'escalier lisible : une marche ne
 * peut appartenir à deux escaliers, l'ordre est celui de la progression, et un
 * libellé d'étape ne peut pas être vide, technique ou inventé.
 */

test("un deck n'appartient qu'à une seule série", () => {
  const seen = new Map<string, string>();
  for (const serie of series) {
    for (const step of serie.steps) {
      const previous = seen.get(step.deckId);
      assert.equal(
        previous,
        undefined,
        `${step.deckId} est dans la série ${previous} ET dans ${serie.id}`,
      );
      seen.set(step.deckId, serie.id);
    }
  }
});

test("chaque série a au moins 2 marches, et l'index inverse les retrouve toutes", () => {
  const index = buildDeckSeriesIndex(listCurricula(), titles);
  let total = 0;
  for (const serie of series) {
    assert.ok(serie.steps.length >= 2, `${serie.id} n'a qu'une marche`);
    for (const step of serie.steps) {
      total += 1;
      assert.equal(index.get(step.deckId)?.series.id, serie.id);
    }
  }
  assert.ok(total >= 30, `attendu ≥ 30 decks regroupés, obtenu ${total}`);
});

test("les marches montent : l'ordre des niveaux est croissant", () => {
  for (const serie of series) {
    const indexes = serie.steps
      .map((step) => (step.level ? LEVEL_ORDER.indexOf(step.level) : -1))
      .filter((index) => index >= 0);
    for (let i = 1; i < indexes.length; i += 1) {
      assert.ok(
        indexes[i] >= indexes[i - 1],
        `${serie.id} : marche ${i + 1} (${serie.steps[i]?.deckId}) moins avancée que la précédente`,
      );
    }
  }
});

test("chaque marche porte un libellé court et lisible", () => {
  for (const serie of series) {
    for (const step of serie.steps) {
      assert.ok(step.label.length > 0, `${step.deckId} n'a pas de libellé d'étape`);
      assert.ok(
        step.label.length <= 26,
        `${step.deckId} : libellé d'étape trop long (${step.label})`,
      );
      assert.doesNotMatch(
        step.label,
        /^cardio-|^deck:|^l\d$/i,
        `${step.deckId} : libellé technique au lieu d'un libellé clinique`,
      );
    }
  }
});

test("pilote SCA : 5 marches, de L2 à l'internat, sans doublon de libellé", () => {
  const sca = series.find((serie) => serie.id === "cardio:sca");
  assert.ok(sca, "série cardio:sca absente");
  assert.deepEqual(
    sca.steps.map((step) => step.deckId),
    ["cardio-sca-l2", "cardio-sca-l3", "cardio-sca-l4", "cardio-sca-l5", "cardio-sca-int"],
  );
  assert.deepEqual(
    sca.steps.map((step) => step.level),
    ["L2", "L3", "L4", "L5", "INTERNE"],
  );
  const labels = sca.steps.map((step) => step.label);
  assert.equal(new Set(labels).size, labels.length, `libellés dupliqués : ${labels.join(", ")}`);
  assert.equal(sca.steps[1]?.label, "Sémiologie");
  assert.equal(sca.steps[4]?.label, "Cas cliniques");
});

test("extractDeckLevel lit l'identifiant, y compris l'internat abrégé", () => {
  assert.equal(extractDeckLevel("cardio-sca-l4"), "L4");
  assert.equal(extractDeckLevel("cardio-sca-int"), "INTERNE");
  assert.equal(extractDeckLevel("cardio-sca-intern"), "INTERNE");
  assert.equal(extractDeckLevel("anatomie"), null);
});

test("deriveStepLabel : mot-clé clinique d'abord, jamais le titre entier", () => {
  assert.equal(deriveStepLabel("x", "HTA — notions de base"), "Notions");
  assert.equal(deriveStepLabel("x", "FA — stratégie thérapeutique"), "Stratégie");
  assert.equal(deriveStepLabel("x", "OAP — diagnostic et étiologies"), "Diagnostic");
  assert.equal(deriveStepLabel("x", "Arrêt cardiaque — post-ROSC"), "Post-ROSC");
  // Titre long sans mot-clé : repli neutre, pas le titre complet.
  assert.equal(
    deriveStepLabel("x", "Cardiologie — Un titre très long qui ne dit aucune étape"),
    "Synthèse",
  );
  // Deck fantôme : on n'invente rien.
  assert.equal(deriveStepLabel("x", undefined), null);
});

test("les exceptions de libellé ne concernent que des decks réels", () => {
  const ids = new Set(decks.map((deck) => deck.id));
  for (const deckId of Object.keys(STEP_LABEL_OVERRIDES)) {
    assert.ok(ids.has(deckId), `exception posée sur un deck inexistant : ${deckId}`);
  }
});

test("les branches squelettes et les branches à un seul deck ne créent pas d'escalier", () => {
  for (const serie of series) {
    const specialty = listCurricula().find((item) => item.id === serie.specialtyId);
    const branch = specialty?.branches.find((item) => item.id === serie.branchId);
    assert.ok(branch, `branche introuvable pour ${serie.id}`);
    assert.notEqual(branch.skeleton, true, `${serie.id} est une branche squelette`);
    assert.ok(branch.decks.length >= 2);
  }
});

test("seriesShortLabel extrait l'acronyme avant le tiret cadratin", () => {
  assert.equal(seriesShortLabel("SCA — Syndrome coronarien aigu"), "SCA");
  assert.equal(seriesShortLabel("OAP — Œdème aigu du poumon"), "OAP");
  assert.equal(seriesShortLabel("Valvulopathies"), "Valvulopathies");
});
