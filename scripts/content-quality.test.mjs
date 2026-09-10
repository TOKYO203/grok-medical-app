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
  assert.equal(tropical?.version, "2.1.0");
  assert.equal(infectio?.version, "2.1.0");

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

test("reviewed stroke content uses the 2026 AHA/ASA guidance safely", () => {
  const neuro = decks.find((deck) => deck.id === "neuro");
  const stroke = cases.find((clinical) => clinical.id === "NEURO-AVC-001");
  assert.equal(neuro?.version, "2.2.0");
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
