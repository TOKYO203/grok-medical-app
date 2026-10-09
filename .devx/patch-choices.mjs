// One-shot: complete single-choice questions in the FA decks with real distractors.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/content/data/decks.json";
const decks = JSON.parse(readFileSync(FILE, "utf8"));

const PATCHES = {
  "cardio-fa-l5/fa-l5-6": [
    "Anti-arythmique de 1re ligne, sans surveillance biologique particulière",
    "Peut être prescrite sans crainte dans l'IC à FE réduite",
    "N'a aucun effet sur le rythme, elle ne prévient que la thrombose",
  ],
  "cardio-fa-int/fa-int-2": [
    "Bêtabloquant IV en première intention pour ralentir la conduction",
    "Digoxine IV pour contrôler la fréquence ventriculaire",
    "Aspirine + héparine seules, en attendant l'ablation du nœud AV",
  ],
  "cardio-fa-int/fa-int-5": [
    "Risque hémorragique réduit : l'aspirine seule suffit",
    "Aucune interaction médicamenteuse avec les traitements oncologiques",
    "Anticoagulation contre-indiquée de façon systématique",
  ],
  "cardio-fa-int/fa-int-6": [
    "AOD à posologie pleine, sans ajustement à la fonction rénale",
    "Aspirine seule, car l'anticoagulation est contre-indiquée",
    "Association systématique AOD + AVK + antiagrégant",
  ],
  "cardio-fa-int/fa-int-7": [
    "Cardioversion électrique immédiate et systématique",
    "Amiodarone en première intention, avant tout traitement thyroïdien",
    "Anticoagulation seule, sans traiter l'hyperthyroïdie",
  ],
  "cardio-fa-int/fa-int-11": [
    "Minimiser l'importance de l'anticoagulation pour limiter l'anxiété",
    "Ne délivrer l'information qu'en cas de récidive documentée",
    "Confier l'annonce à un tiers et éviter l'entretien avec le patient",
  ],
  "cardio-fa-int/fa-int-12": [
    "Suivi exclusif par un seul cardiologue, sans médecin traitant",
    "Aucun suivi structuré : le patient gère seul son traitement",
    "Télésurveillance seule, sans examen clinique ni bilan biologique",
  ],
};

let patched = 0;
for (const deck of decks) {
  for (const q of deck.questions) {
    const key = `${deck.id}/${q.id}`;
    const extra = PATCHES[key];
    if (!extra) continue;
    if (q.choices.length !== 1) continue;
    if (q.correct !== 0) throw new Error(`${key}: unexpected correct index ${q.correct}`);
    q.choices = [...q.choices, ...extra];
    patched += 1;
  }
}

writeFileSync(FILE, JSON.stringify(decks, null, 2));
console.log(`Patched ${patched} single-choice questions.`);
