// One-shot: register every new cardiology "spirale" deck in the editorial registry.
import { readFileSync, writeFileSync } from "node:fs";

const DECKS = JSON.parse(readFileSync("src/content/data/decks.json", "utf8"));
const REG_FILE = "src/content/data/editorial-registry.json";
const registry = JSON.parse(readFileSync(REG_FILE, "utf8"));

const SPIRALE = /^cardio-(sca|ic|hta|fa|valv|arret|oap)-(l2|l3|l4|l5|int)$/;

const SCOPE = {
  sca: "Réseau coronarien : reconnaissance, reperfusion et complications du SCA selon le niveau d'étude",
  ic: "Insuffisance cardiaque : du diagnostic au traitement et aux décompensations aiguës",
  hta: "Hypertension artérielle : dépistage, risque cardiovasculaire et stratégies thérapeutiques",
  fa: "Fibrillation atriale : contrôle du rythme, anticoagulation et prévention embolique",
  valv: "Valvulopathies : sémiologie, surveillance et indications interventionnelles",
  arret: "Arrêt cardiaque : chaîne de survie, RCP et soins post-réanimation",
  oap: "Œdème aigu du poumon : reconnaissance, traitement immédiat et surveillance",
};

const existing = new Set(registry.decks.map((entry) => entry.deck_id));
const maxSequence = Math.max(...registry.decks.filter((e) => e.code === "CAR").map((e) => e.sequence));

const newDecks = DECKS.filter((deck) => SPIRALE.test(deck.id) && !existing.has(deck.id));
let sequence = maxSequence;

for (const deck of newDecks) {
  sequence += 1;
  const topic = SPIRALE.exec(deck.id)[1];
  const ids = deck.questions.map((q) => q.id);
  const namespace = ids[0].replace(/-\d+$/, "");
  if (!ids.every((id) => new RegExp(`^${namespace}-\\d+$`).test(id))) {
    throw new Error(`${deck.id}: question ids do not share namespace ${namespace}`);
  }
  const next = Math.max(...ids.map((id) => Number(id.slice(namespace.length + 1)))) + 1;
  registry.decks.push({
    deck_id: deck.id,
    editorial_id: `CAR-D${String(sequence).padStart(2, "0")}`,
    code: "CAR",
    sequence,
    question_namespace: namespace,
    next_question_number: next,
    scope: SCOPE[topic],
    status: "published",
    medical_review: { status: "structural_only", verified_at: null, items: [] },
  });
}

registry.updated_at = "2026-10-08";
registry.decks.sort((a, b) => (a.code === b.code ? a.sequence - b.sequence : a.code.localeCompare(b.code)));

writeFileSync(REG_FILE, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Registered ${newDecks.length} decks; registry now ${registry.decks.length} entries.`);
