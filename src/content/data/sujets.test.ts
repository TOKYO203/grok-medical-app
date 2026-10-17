/**
 * Garde-fou des **sujets** (`/sujet`, `/sujet/<slug>`).
 *
 * Le fichier `sujets.ts` est écrit à la main : c'est une décision éditoriale,
 * pas une déduction. Sa faiblesse est connue — un deck renommé, un ECG déplacé
 * ou une faute de frappe dans un identifiant produit une page qui **ment** :
 * une rubrique vide, un lien mort, ou un sujet qui prétend couvrir un contenu
 * inexistant. Ces tests transforment cette faiblesse en échec de CI.
 *
 * Ils vérifient quatre familles d'invariants :
 *  1. **résolution** — chaque identifiant référencé existe réellement dans son
 *     catalogue (deck, cas, démarche, ECG, son, score) ;
 *  2. **référentiel** — chaque ordinal 1 → 240 existe et la numérotation globale
 *     correspond aux tailles de sections documentées (41 / 134 / 65) ;
 *  3. **unicité** — un deck n'appartient qu'à un sujet (sinon l'index inverse
 *     `deckId → sujet` écraserait silencieusement une entrée), et un sujet à
 *     plusieurs decks doit former une série réelle du curriculum (sinon la page
 *     n'a pas d'escalier à afficher) ;
 *  4. **câblage** — le hub rend bien son `<Outlet/>`, la route existe dans
 *     l'arbre généré, la navigation et les quatre catalogues i18n portent
 *     l'entrée, et les liens profonds `?score=` / `?son=` sont déclarés par
 *     leurs routes cibles.
 *
 * Exécuté par `node --experimental-strip-types` (cf. `npm test`) : il importe
 * directement `sujets.ts`, qui est volontairement sans aucune dépendance.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { listCurricula } from "../curriculum.ts";
import {
  getSujet,
  listSujets,
  siblingSujets,
  sujetContentCount,
  sujetForDeck,
  sujetHubStats,
  sujetSlugForDeck,
  sujetsBySpecialty,
} from "./sujets.ts";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const readJson = (relative: string) => JSON.parse(read(relative));

const decks: { id: string; title: string }[] = readJson("./decks.json");
const cases: { id: string }[] = readJson("./cases.json");
const ecg: { id: string }[] = readJson("./ecg/_index.json").cases;
const sounds: { id: string; status: string }[] = readJson("./auscultation/_index.json").sounds;
const demarches: { diagnosticId: string }[] = readJson("./demarches/_index.json").demarches;
const programme = readJson("./programmes/madagascar-2025.json") as {
  sections: { id: string; label: string; items: { n: number; title: string }[] }[];
};

/**
 * Scores : lus par expression régulière dans les sources du registre.
 *
 * La page sujet ne charge PAS le registre (78 scores + leurs fonctions de
 * calcul, ~130 Kio) : elle porte elle-même `{ id, label }`. Ce test est donc le
 * seul lien entre les deux — il vérifie que l'identifiant existe ET que le
 * libellé est exactement celui du registre (sans quoi la page afficherait un
 * nom périmé).
 */
const SCORE_SOURCES = [
  "cardio",
  "pneumo",
  "nephro",
  "neuro",
  "infectio",
  "urgences",
  "pediatrie",
  "psychiatrie",
  "general",
].map((file) => read(`../calculators/scores/${file}.ts`));

const calculatorIds = new Set<string>();
for (const source of SCORE_SOURCES) {
  for (const match of source.matchAll(/^\s{2}id: "([^"]+)",$/gm)) {
    calculatorIds.add(match[1]);
  }
}

const DECK_IDS = new Set(decks.map((deck) => deck.id));
const CASE_IDS = new Set(cases.map((entry) => entry.id));
const ECG_IDS = new Set(ecg.map((entry) => entry.id));
const SOUND_BY_ID = new Map(sounds.map((entry) => [entry.id, entry]));
const DEMARCHE_IDS = new Set(demarches.map((entry) => entry.diagnosticId));

/**
 * Numérotation GLOBALE du référentiel : sémiologie 1-41, médecine 42-175,
 * chirurgie 176-240. Ces tailles sont un contrat (cf. en-tête de `sujets.ts`) :
 * si le référentiel gagne des items, les ordinals doivent être revus à la main,
 * et ce test doit échouer pour forcer la relecture.
 */
const SECTION_SIZES = programme.sections.map((section) => section.items.length);
const GLOBAL_ITEM = new Map<number, { title: string; section: string }>();
{
  let offset = 0;
  for (const section of programme.sections) {
    for (const item of section.items) {
      GLOBAL_ITEM.set(offset + item.n, { title: item.title, section: section.label });
    }
    offset += section.items.length;
  }
}

test("la numérotation globale du référentiel reste celle documentée", () => {
  assert.deepEqual(SECTION_SIZES, [41, 134, 65], "tailles de sections modifiées");
  assert.equal(GLOBAL_ITEM.size, 240, "le référentiel ne couvre plus 1 → 240");

  // Témoin : l'item 61 est bien « Infarctus du myocarde » (médecine n°20).
  assert.match(GLOBAL_ITEM.get(61)?.title ?? "", /Infarctus du myocarde/);
  // Témoin : l'item 10 est bien le chapitre d'orientation de la douleur thoracique.
  assert.match(GLOBAL_ITEM.get(10)?.title ?? "", /Douleur thoracique/);
});

test("chaque sujet est bien formé (slug unique, libellé, spécialité connue)", () => {
  const sujets = listSujets();
  assert.ok(sujets.length >= 8, "au moins les 7 séries cardio + l'AVC");

  const slugs = sujets.map((sujet) => sujet.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug de sujet dupliqué");

  const specialties = new Set(listCurricula().map((specialty) => specialty.label));
  for (const sujet of sujets) {
    assert.match(sujet.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug invalide : ${sujet.slug}`);
    assert.ok(sujet.label.trim().length >= 3, `${sujet.slug} : libellé trop court`);
    assert.ok(
      specialties.has(sujet.specialty),
      `${sujet.slug} : spécialité « ${sujet.specialty} » absente du curriculum`,
    );
    assert.equal(getSujet(sujet.slug)?.label, sujet.label, `getSujet(${sujet.slug}) incohérent`);
  }
});

test("chaque contenu référencé existe réellement dans son catalogue", () => {
  for (const sujet of listSujets()) {
    for (const deckId of sujet.decks) {
      assert.ok(DECK_IDS.has(deckId), `${sujet.slug} : deck inconnu « ${deckId} »`);
    }
    for (const caseId of sujet.cases) {
      assert.ok(CASE_IDS.has(caseId), `${sujet.slug} : cas inconnu « ${caseId} »`);
    }
    for (const id of sujet.demarches) {
      assert.ok(DEMARCHE_IDS.has(id), `${sujet.slug} : démarche inconnue « ${id} »`);
    }
    for (const id of sujet.ecg) {
      assert.ok(ECG_IDS.has(id), `${sujet.slug} : ECG inconnu « ${id} »`);
    }
    for (const id of sujet.auscultation) {
      const sound = SOUND_BY_ID.get(id);
      assert.ok(sound, `${sujet.slug} : son inconnu « ${id} »`);
      // Un lien « Écouter » vers une fiche encore planifiée serait un bouton mort.
      assert.equal(sound.status, "available", `${sujet.slug} : son non disponible « ${id} »`);
    }
    for (const score of sujet.calculateurs) {
      assert.ok(calculatorIds.has(score.id), `${sujet.slug} : score inconnu « ${score.id} »`);
      assert.ok(score.label.trim().length >= 3, `${sujet.slug}/${score.id} : libellé vide`);
      // Adjacence `id` → `label` dans le registre = libellé non périmé.
      const declared = SCORE_SOURCES.some((source) =>
        source.includes(`id: "${score.id}",\n  label: "${score.label}",`),
      );
      assert.ok(declared, `${sujet.slug} : libellé de « ${score.id} » divergent du registre`);
    }
    for (const ordinal of sujet.itemsOfficiels) {
      assert.ok(
        Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= 240,
        `${sujet.slug} : ordinal hors référentiel « ${ordinal} »`,
      );
      assert.ok(GLOBAL_ITEM.has(ordinal), `${sujet.slug} : item ${ordinal} inexistant`);
    }
  }
});

test("aucun doublon à l'intérieur d'un sujet", () => {
  for (const sujet of listSujets()) {
    for (const [key, values] of Object.entries({
      decks: sujet.decks,
      cases: sujet.cases,
      demarches: sujet.demarches,
      ecg: sujet.ecg,
      auscultation: sujet.auscultation,
      calculateurs: sujet.calculateurs.map((score) => score.id),
      itemsOfficiels: sujet.itemsOfficiels,
    })) {
      const list = values as (string | number)[];
      assert.equal(new Set(list).size, list.length, `${sujet.slug}/${key} : doublon`);
    }
  }
});

test("un deck n'appartient qu'à un seul sujet", () => {
  const seen = new Map<string, string>();
  for (const sujet of listSujets()) {
    for (const deckId of sujet.decks) {
      const owner = seen.get(deckId);
      assert.equal(
        owner,
        undefined,
        `deck « ${deckId} » présent dans « ${owner} » et « ${sujet.slug} »`,
      );
      seen.set(deckId, sujet.slug);
      assert.equal(sujetSlugForDeck(deckId), sujet.slug, `index inverse faux pour ${deckId}`);
      assert.equal(sujetForDeck(deckId)?.slug, sujet.slug, `sujetForDeck faux pour ${deckId}`);
      assert.equal(sujetSlugForDeck(`absent-${deckId}`), undefined, "un deck inconnu a un sujet");
    }
  }
});

test("un sujet à plusieurs decks correspond à une vraie série du curriculum", () => {
  // `findSujetSeries` exige ≥ 2 decks dans une même branche : sans cette
  // propriété, la page n'afficherait aucun escalier alors que le sujet en
  // annonce plusieurs — une progression invisible.
  for (const sujet of listSujets()) {
    if (sujet.decks.length < 2) continue;
    const branches = listCurricula().flatMap((specialty) =>
      specialty.branches.map((branch) => branch.decks),
    );
    const host = branches.find(
      (branchDecks) => sujet.decks.filter((deckId) => branchDecks.includes(deckId)).length >= 2,
    );
    assert.ok(host, `${sujet.slug} : aucun escalier possible (decks dispersés)`);
  }
});

test("les compteurs du hub et des sujets restent cohérents", () => {
  const stats = sujetHubStats();
  const sujets = listSujets();

  assert.equal(stats.sujets, sujets.length);
  assert.equal(
    stats.decks,
    sujets.reduce((sum, sujet) => sum + sujet.decks.length, 0),
    "compteur de decks divergent",
  );
  for (const sujet of sujets) {
    assert.equal(
      sujetContentCount(sujet),
      sujet.itemsOfficiels.length +
        sujet.decks.length +
        sujet.demarches.length +
        sujet.cases.length +
        sujet.ecg.length +
        sujet.auscultation.length +
        sujet.calculateurs.length,
      `${sujet.slug} : compteur de contenus incohérent`,
    );
  }

  // Les groupes du hub couvrent tous les sujets, une seule fois.
  const grouped = sujetsBySpecialty().flatMap((group) => group.sujets.map((sujet) => sujet.slug));
  assert.equal(grouped.length, sujets.length);
  assert.deepEqual([...grouped].sort(), sujets.map((sujet) => sujet.slug).sort());
  assert.equal(siblingSujets(getSujet("sca")!).length, 6, "6 voisins cardio pour le SCA");
});

test("les pages /sujet et /sujet/$slug sont câblées (Outlet, route, nav, i18n)", () => {
  const hub = read("../../routes/sujet.tsx");
  const detail = read("../../routes/sujet.$slug.tsx");

  assert.match(hub, /createFileRoute\("\/sujet"\)/, "route /sujet absente");
  // Piège connu : la route parente doit rendre son enfant, sinon la page détail
  // ne s'affiche jamais (bug déjà rencontré sur /cas, /demarche et /ecg).
  assert.match(hub, /<Outlet\s*\/>/, "le hub /sujet ne rend pas <Outlet/>");
  assert.match(hub, /pathname !== "\/sujet"/, "le hub n'a pas de garde de chemin");

  assert.match(detail, /createFileRoute\("\/sujet\/\$slug"\)/, "route /sujet/$slug absente");
  assert.match(detail, /data-sujet-section=/, "aucune section étiquetée pour la QA");

  const navigation = read("../../lib/navigation.ts");
  assert.match(navigation, /to: "\/sujet"/, "aucune entrée de navigation vers /sujet");

  for (const locale of ["fr", "en", "es", "pt"]) {
    const messages = read(`../../i18n/messages/${locale}.ts`);
    assert.match(messages, /"nav\.sujets": "[^"]+"/, `clé nav.sujets absente (${locale})`);
  }

  const routeTree = read("../../../src/routeTree.gen.ts");
  assert.match(routeTree, /'\/sujet\/\$slug'/, "routeTree.gen.ts non régénéré");
});

test("les liens profonds utilisés par la page sujet sont déclarés", () => {
  const calculateurs = read("../../routes/calculateurs.tsx");
  assert.match(calculateurs, /validateSearch/, "pas de validateSearch sur /calculateurs");
  assert.match(calculateurs, /score\?: string/, "paramètre ?score absent de /calculateurs");

  const auscultation = read("../../routes/auscultation.tsx");
  assert.match(auscultation, /validateSearch/, "pas de validateSearch sur /auscultation");
  assert.match(auscultation, /son\?: string/, "paramètre ?son absent de /auscultation");

  const detail = read("../../routes/sujet.$slug.tsx");
  assert.match(detail, /search=\{\{ score:/, "la page sujet ne lie aucun score en profondeur");
  assert.match(detail, /search=\{\{ son:/, "la page sujet ne lie aucun son en profondeur");
});
