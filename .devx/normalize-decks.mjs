// One-shot: bring the 35 new cardiology "spirale" decks in line with the catalog schema.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/content/data/decks.json";
const decks = JSON.parse(readFileSync(FILE, "utf8"));

const SPIRALE = /^cardio-(sca|ic|hta|fa|valv|arret|oap)-(l2|l3|l4|l5|int)$/;

const DECK_SOURCES = {
  sca: [
    { title: "ESC 2023 — Syndromes coronariens aigus", citation: "2023 ESC Guidelines for the management of acute coronary syndromes." },
    { title: "HAS — Syndrome coronarien aigu", citation: "Prise en charge du syndrome coronarien aigu en phase aiguë. Haute Autorité de Santé." },
    { title: "Collège de Cardiologie", citation: "Référentiel national EDN de cardiologie — Syndromes coronariens aigus." },
  ],
  ic: [
    { title: "ESC — Insuffisance cardiaque", citation: "ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure (focused update)." },
    { title: "HAS 2023", citation: "Parcours de soins — Insuffisance cardiaque. Haute Autorité de Santé, 2023." },
    { title: "Collège de Cardiologie", citation: "Référentiel national EDN de cardiologie — Insuffisance cardiaque." },
  ],
  hta: [
    { title: "ESC 2024 — Hypertension", citation: "2024 ESC Guidelines for the management of elevated blood pressure and hypertension." },
    { title: "HAS 2023", citation: "Prise en charge de l'hypertension artérielle essentielle de l'adulte. Haute Autorité de Santé, 2023." },
    { title: "OMS 2024", citation: "Global report on hypertension 2024. Organisation mondiale de la Santé." },
  ],
  fa: [
    { title: "ESC 2024 — Fibrillation atriale", citation: "2024 ESC Guidelines for the management of atrial fibrillation." },
    { title: "HAS 2023", citation: "Prise en charge de la fibrillation atriale. Haute Autorité de Santé, 2023." },
    { title: "Collège de Cardiologie", citation: "Référentiel national EDN de cardiologie — Fibrillation atriale." },
  ],
  valv: [
    { title: "ESC/EACTS 2021 — Valvulopathies", citation: "2021 ESC/EACTS Guidelines for the management of valvular heart disease." },
    { title: "ESC 2023 — Endocardite", citation: "2023 ESC Guidelines for the management of infective endocarditis." },
    { title: "HAS 2023", citation: "Prise en charge des valvulopathies. Haute Autorité de Santé, 2023." },
  ],
  arret: [
    { title: "ERC 2021 — Réanimation", citation: "European Resuscitation Council Guidelines 2021 — basic and adult advanced life support." },
    { title: "SFAR", citation: "Recommandations formalisées d'experts — arrêt cardiaque et réanimation." },
    { title: "Collège de Cardiologie", citation: "Référentiel national EDN de cardiologie — Arrêt cardiaque." },
  ],
  oap: [
    { title: "ESC 2022 — Insuffisance cardiaque aiguë", citation: "Acute heart failure and cardiogenic pulmonary oedema — ESC position statement, 2022." },
    { title: "HAS 2023", citation: "Prise en charge de l'œdème aigu du poumon cardiogénique. Haute Autorité de Santé, 2023." },
    { title: "Collège de Cardiologie", citation: "Référentiel national EDN de cardiologie — Œdème aigu du poumon." },
  ],
};

const ALLOWED = new Set([
  "recognize",
  "semiology",
  "diagnostic_orientation",
  "diagnosis",
  "management",
  "clinical_reasoning",
  "canmeds_expert",
  "canmeds_communicator",
  "canmeds_collaborator",
  "canmeds_leader",
  "canmeds_health_advocate",
  "canmeds_scholar",
  "canmeds_professional",
]);

let touched = 0;
let fixedCompetencies = 0;

for (const deck of decks) {
  const m = SPIRALE.exec(deck.id);
  if (!m) continue;
  touched += 1;
  const topic = m[1];

  deck.deck_id = deck.id;
  deck.schema_version = 2;
  if (!deck.access_policy) {
    deck.access_policy = { tier: "pro", entitlement: "CARDIO_PACK_15" };
  }
  if (!Array.isArray(deck.sources) || deck.sources.length === 0) {
    deck.sources = DECK_SOURCES[topic].map((s) => ({ ...s }));
  }
  // The whole spirale is a released family; align the lone draft placeholder.
  if (deck.status !== "published") deck.status = "published";

  for (const q of deck.questions) {
    if (q.competency === "prognosis") {
      q.competency = "clinical_reasoning";
      fixedCompetencies += 1;
    } else if (!ALLOWED.has(q.competency)) {
      throw new Error(`Unknown competency ${q.competency} in ${deck.id}/${q.id}`);
    }
  }
}

writeFileSync(FILE, JSON.stringify(decks, null, 2));
console.log(`Normalized ${touched} decks; fixed ${fixedCompetencies} competencies.`);
