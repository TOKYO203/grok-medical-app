// One-shot: differentiate cross-deck question prompts flagged as near-duplicates.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/content/data/decks.json";
const decks = JSON.parse(readFileSync(FILE, "utf8"));

const REWRITES = {
  "cardio-sca-l2/sca-l2-10":
    "Douleur thoracique évocatrice d'un SCA chez un patient pris en charge en garde : quelle est la conduite initiale attendue ?",
  "cardio-ic-l3/ic-l3-9":
    "Quelles sont les principales étiologies de l'insuffisance cardiaque à rechercher en priorité ?",
  "cardio-fa-l2/fa-l2-5":
    "Quelles sont les principales étiologies de la fibrillation atriale ?",
};

let patched = 0;
for (const deck of decks) {
  for (const q of deck.questions) {
    const key = `${deck.id}/${q.id}`;
    if (!REWRITES[key]) continue;
    q.prompt = REWRITES[key];
    patched += 1;
  }
}

writeFileSync(FILE, JSON.stringify(decks, null, 2));
console.log(`Rewrote ${patched} prompts.`);
