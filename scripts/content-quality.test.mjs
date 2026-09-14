import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const decks = JSON.parse(
  await readFile(new URL("../src/content/data/decks.json", import.meta.url), "utf8"),
);
const cases = JSON.parse(
  await readFile(new URL("../src/content/data/cases.json", import.meta.url), "utf8"),
);

test("every built-in question has an explanation and at least one source", () => {
  for (const deck of decks) {
    for (const question of deck.questions) {
      assert.ok(
        question.explanation.trim().length >= 8,
        `${deck.id}/${question.id}: missing explanation`,
      );
      assert.ok(question.sources.length > 0, `${deck.id}/${question.id}: missing source`);
      for (const source of question.sources) {
        assert.ok(source.title?.trim(), `${deck.id}/${question.id}: missing source title`);
        assert.ok(source.citation?.trim(), `${deck.id}/${question.id}: missing citation`);
      }
    }
  }
});

test("clinical cases remain sourced", () => {
  for (const clinical of cases) {
    assert.ok(clinical.sources.length > 0, `${clinical.id}: missing source`);
  }
});

test("reviewed cardiology and malaria content uses the current source versions", () => {
  const cardio = decks.find((deck) => deck.id === "cardio");
  const tropical = decks.find((deck) => deck.id === "tropical");
  const infectio = decks.find((deck) => deck.id === "infectio");
  assert.equal(cardio?.version, "2.1.0");
  assert.equal(tropical?.version, "2.2.0");
  assert.equal(infectio?.version, "2.2.0");

  const reviewed = JSON.stringify([cardio, tropical, infectio, cases]);
  assert.doesNotMatch(reviewed, /Heart Failure Guidelines, 2023/);
  assert.doesNotMatch(reviewed, /diagnosis and treatment of acute and chronic heart failure, 2023/);
  assert.doesNotMatch(reviewed, /Guidelines for the treatment of malaria, 3e/);
});

test("the severe malaria case uses the WHO hypoglycaemia threshold consistently", () => {
  const malaria = cases.find((clinical) => clinical.id === "TROP-PALU-001");
  assert.ok(malaria, "malaria case missing");
  const serialized = JSON.stringify(malaria);
  assert.match(serialized, /0,35 g\/L/);
  assert.match(serialized, /< 2,2 mmol\/L/);
  assert.doesNotMatch(serialized, /0,62 g\/L/);
});

test("reviewed paracetamol content teaches the safe self-medication ceiling", () => {
  const pharmaco = decks.find((deck) => deck.id === "pharmaco");
  const paracetamol = pharmaco?.questions.find((question) => question.id === "ph-3");
  assert.equal(pharmaco?.version, "2.2.0");
  assert.equal(paracetamol?.choices[paracetamol.correct], "3 g");
  assert.match(paracetamol?.prompt ?? "", /sans avis médical/i);
  assert.match(paracetamol?.explanation ?? "", /Seul un médecin/i);
  assert.ok(paracetamol?.sources.some((source) => source.url?.includes("ansm.sante.fr")));
});

test("reviewed naloxone content keeps ventilation and monitoring central", () => {
  const pharmacology = decks.find((deck) => deck.id === "pharmaco");
  const naloxone = pharmacology?.questions.find((question) => question.id === "ph-4");

  assert.equal(naloxone?.choices[naloxone.correct], "Naloxone");
  assert.match(naloxone?.explanation ?? "", /ventilation assistée/);
  assert.match(naloxone?.explanation ?? "", /peut récidiver/);
  assert.doesNotMatch(naloxone?.explanation ?? "", /réveil complet comme seul objectif/i);
  assert.ok(naloxone?.sources.some((source) => source.url?.includes("who.int")));
});

test("reviewed emergency content avoids automatic burn over-resuscitation", () => {
  const emergencies = decks.find((deck) => deck.id === "urgences");
  const burn = emergencies?.questions.find((question) => question.id === "ur-7");

  assert.equal(emergencies?.version, "2.2.0");
  assert.equal(burn?.choices[burn.correct], "2 mL × kg × % surface brûlée");
  assert.match(burn?.prompt ?? "", /≥ 20 %/);
  assert.match(burn?.explanation ?? "", /ajuster heure par heure/);
  assert.match(burn?.explanation ?? "", /Parkland utilise 4 mL/);
  assert.ok(burn?.sources.some((source) => source.url?.includes("pubmed.ncbi.nlm.nih.gov")));
});

test("reviewed first-aid content teaches safe bleeding and choking actions", () => {
  const emergencies = decks.find((deck) => deck.id === "urgences");
  const bleeding = emergencies?.questions.find((question) => question.id === "ur-5");
  const choking = emergencies?.questions.find((question) => question.id === "ur-8");

  assert.match(bleeding?.choices[bleeding.correct] ?? "", /pression manuelle directe/i);
  assert.match(bleeding?.explanation ?? "", /5 à 7 cm/);
  assert.match(bleeding?.explanation ?? "", /ne pas le desserrer/i);
  assert.doesNotMatch(bleeding?.explanation ?? "", /Masser/);
  assert.match(choking?.explanation ?? "", /commencer la RCP sans délai/);
  assert.match(choking?.explanation ?? "", /objet clairement visible/);
  assert.ok(
    [bleeding, choking].every((question) =>
      question?.sources.some((source) => source.url?.includes("resus.org.uk")),
    ),
  );
});

test("reviewed tuberculosis content distinguishes standard and shorter regimens", () => {
  const infectiousDiseases = decks.find((deck) => deck.id === "infectio");
  const tuberculosis = infectiousDiseases?.questions.find((question) => question.id === "in-5");

  assert.equal(infectiousDiseases?.version, "2.2.0");
  assert.match(tuberculosis?.choices[tuberculosis.correct] ?? "", /2HRZE\/4HR/);
  assert.match(tuberculosis?.choices[tuberculosis.correct] ?? "", /quatre mois/);
  assert.match(tuberculosis?.explanation ?? "", /rifapentine et moxifloxacine/);
  assert.match(tuberculosis?.explanation ?? "", /programme national/);
  assert.ok(tuberculosis?.sources.some((source) => source.url?.includes("who.int")));
});

test("reviewed erythema migrans content does not delay treatment for serology", () => {
  const dermatology = decks.find((deck) => deck.id === "dermato");
  const erythemaMigrans = dermatology?.questions.find((question) => question.id === "de-8");

  assert.equal(dermatology?.version, "2.1.0");
  assert.match(erythemaMigrans?.choices[erythemaMigrans.correct] ?? "", /sans attendre une sérologie/);
  assert.match(erythemaMigrans?.explanation ?? "", /diagnostic clinique/);
  assert.match(erythemaMigrans?.explanation ?? "", /protocole national/);
  assert.ok(erythemaMigrans?.sources.some((source) => source.url?.includes("has-sante.fr")));
});

test("reviewed stroke content uses the 2026 AHA/ASA guidance safely", () => {
  const neuro = decks.find((deck) => deck.id === "neuro");
  const stroke = cases.find((clinical) => clinical.id === "NEURO-AVC-001");
  assert.equal(neuro?.version, "2.3.0");
  assert.ok(stroke, "stroke case missing");

  const serialized = JSON.stringify([neuro, stroke]);
  assert.match(serialized, /2026 Guideline for the Early Management/);
  assert.match(serialized, /jusqu'à 24 h/);
  assert.match(serialized, /dernière normalité/);
  assert.doesNotMatch(serialized, /l'heure de début est le coucher/i);
  assert.doesNotMatch(serialized, /Contre-indiquée : heure de début inconnue/i);
});

test("reviewed neurological emergencies preserve operational priorities", () => {
  const neuro = decks.find((deck) => deck.id === "neuro");
  const seizure = neuro?.questions.find((question) => question.id === "ne-3");
  const myasthenia = neuro?.questions.find((question) => question.id === "ne-6");

  assert.equal(seizure?.choices[seizure.correct], "5 minutes");
  assert.match(seizure?.explanation ?? "", /t1 = 5 minutes/);
  assert.match(seizure?.explanation ?? "", /t2 = 30 minutes/);
  assert.deepEqual(
    seizure?.sources.map((source) => source.title),
    ["ILAE", "American Epilepsy Society"],
  );

  assert.match(myasthenia?.explanation ?? "", /surveillance en soins intensifs/);
  assert.match(myasthenia?.explanation ?? "", /échanges plasmatiques/);
  assert.match(myasthenia?.explanation ?? "", /immunoglobulines IV/);
  assert.ok(myasthenia?.sources.some((source) => source.title === "MGFA"));
  assert.doesNotMatch(JSON.stringify([seizure, myasthenia]), /lésions irréversibles/);
});

test("reviewed Guillain-Barré and severe head injury content fails safely", () => {
  const neuro = decks.find((deck) => deck.id === "neuro");
  const guillainBarre = neuro?.questions.find((question) => question.id === "ne-5");
  const severeHeadInjury = neuro?.questions.find((question) => question.id === "ne-7");

  assert.match(guillainBarre?.choices[guillainBarre.correct] ?? "", /peut manquer au début/);
  assert.match(guillainBarre?.explanation ?? "", /première semaine/);
  assert.match(guillainBarre?.explanation ?? "", /surveillance respiratoire/);
  assert.ok(guillainBarre?.sources.some((source) => source.title === "EAN / PNS"));
  assert.doesNotMatch(guillainBarre?.explanation ?? "", /exclut le diagnostic/);

  assert.match(severeHeadInjury?.prompt ?? "", /traumatisme crânien/);
  assert.match(severeHeadInjury?.choices[severeHeadInjury.correct] ?? "", /stabiliser ABC/);
  assert.match(severeHeadInjury?.explanation ?? "", /GCS < 9/);
  assert.match(severeHeadInjury?.explanation ?? "", /facteurs confondants réversibles/);
  assert.ok(
    severeHeadInjury?.sources.some((source) => source.title === "Brain Trauma Foundation"),
  );
});
