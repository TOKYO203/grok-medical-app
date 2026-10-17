/* Garde-fou bundle (Session 15 — G51, code-splitting) :
   le catalogue médical (src/content/catalog — decks.json + cases.json +
   diagnostics.json) ne doit JAMAIS revenir dans le graphe EAGER du client.
   Le chunk partagé initial est payé au premier rendu de chaque page : y
   importer le catalogue statiquement (depuis le store, la palette de
   commandes ou tout composant monté par la racine/le Shell) re-verrouillerait
   les données cliniques dans le bundle initial. Mécanisme attendu :
   - le store lit les decks via le cache léger src/state/builtin-decks.ts ;
   - chaque route qui appelle useAllDecks sème ce cache en tête de module ;
   - la palette de commandes charge le catalogue par import dynamique. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fileUrl = (path) => new URL("../" + path + "", import.meta.url);

/** Fichiers évalués en eager sur chaque page (racine + Shell + provider d'état). */
const EAGER_FILES = [
  "src/routes/__root.tsx",
  "src/components/shell.tsx",
  "src/state/store.ts",
  "src/components/command-palette.tsx",
  "src/lib/navigation.ts",
];

/** Routes qui lisent les decks intégrés via le store. */
const SEEDING_ROUTES = [
  "src/routes/index.tsx",
  "src/routes/bibliotheque.tsx",
  "src/routes/parcours.tsx",
  "src/routes/parcours.$deckId.tsx",
  "src/routes/learn.$deckId.tsx",
  "src/routes/revue.tsx",
  "src/routes/examen.tsx",
  "src/routes/cas.tsx",
  "src/routes/import.tsx",
  "src/routes/classement.tsx",
];

test("le graphe eager n'importe jamais le catalogue médical (G51)", async () => {
  for (const path of EAGER_FILES) {
    const source = await readFile(fileUrl(path), "utf8");
    assert.ok(
      !/from\s+"@\/content\/catalog"/.test(source),
      path + " importe @/content/catalog statiquement — les trois JSON cliniques retourneraient dans le chunk partagé initial (G51). Passer par le cache src/state/builtin-decks ou un import dynamique.",
    );
  }
});

test("builtin-decks expose un cache à chargement différé, sans import statique", async () => {
  const source = await readFile(fileUrl("src/state/builtin-decks.ts"), "utf8");
  assert.ok(
    !/from\s+"@\/content\/catalog"/.test(source),
    "src/state/builtin-decks.ts ne doit pas importer le catalogue statiquement.",
  );
  assert.ok(
    /import\("@\/content\/catalog"\)/.test(source),
    "src/state/builtin-decks.ts doit charger le catalogue par import dynamique.",
  );
});

test("chaque route useAllDecks sème le cache des decks intégrés (G51)", async () => {
  for (const path of SEEDING_ROUTES) {
    const source = await readFile(fileUrl(path), "utf8");
    assert.ok(
      source.includes("useAllDecks"),
      path + " ne consomme plus useAllDecks — retirer cette entrée de la garde.",
    );
    assert.ok(
      source.includes("seedBuiltinDecks(BUILTIN_DECKS)"),
      path + " appelle useAllDecks sans semer le cache (G51) — les decks intégrés seraient vides au rendu.",
    );
  }
});
