/**
 * Garde-fou — compteur de progression de /signes.
 *
 * BUG RÉEL (2026-10-18) : la page affichait « 1 / 10 » alors que le catalogue
 * contenait 110 fiches. Ce n'était PAS un total codé en dur (vérifié : le
 * composant affichait déjà `items.length`) — c'était un bundle périmé resservi
 * par le service worker (voir public/sw.js et les règles de cache).
 *
 * Ce test verrouille la propriété qui doit rester vraie quoi qu'il arrive :
 *
 *   1. le total affiché est DÉRIVÉ du catalogue chargé (`items.length`), jamais
 *      d'une constante — sinon le compteur mentirait dès le prochain lot de
 *      contenu (10 → 90 → 110 aujourd'hui) ;
 *   2. « Suivant » n'est borné que par `items.length - 1` : aucune limite en
 *      dur ne doit empêcher d'atteindre la 110e fiche ;
 *   3. le chargeur ne tronque pas le catalogue (aucun `slice`/`limit`) ;
 *   4. le manifeste publié et les fiches sur disque sont d'accord sur le
 *      total — un catalogue à moitié présent afficherait un total faux.
 *
 * Le test est volontairement indifférent à l'emplacement des fiches
 * (`public/content/signes/` avant S1, `private/content/signes/` après) pour
 * rester vert pendant la transition.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROUTE = join(ROOT, "src/routes/signes.tsx");
const CATALOG = join(ROOT, "src/lib/signes/catalog.ts");
const MANIFEST = join(ROOT, "public/content/signes/_index.json");
const SHEET_DIRS = ["public/content/signes", "private/content/signes"];

const route = readFileSync(ROUTE, "utf8");
const catalog = readFileSync(CATALOG, "utf8");

/**
 * Badge de compteur découpé en deux : l'attribut `data-signes-count` et le TEXTE
 * affiché. ⚠️ On ne teste pas la balise entière — son `className` contient des
 * chiffres (`px-2 py-1`), ce qui faisait échouer une assertion « aucun chiffre »
 * pour une raison sans rapport avec le compteur.
 */
function counterParts(source) {
  const badge = source.match(
    /<span[^>]*data-signes-count=\{([^}]*)\}([^>]*)>([\s\S]*?)<\/span>/,
  );
  assert.ok(badge, "badge de compteur `data-signes-count` introuvable dans src/routes/signes.tsx");
  const [, attribute, , children] = badge;
  return { attribute: attribute.trim(), children: children.trim() };
}

test("le total affiché vient du catalogue chargé, jamais d'une constante", () => {
  const { attribute, children } = counterParts(route);

  // Le rendu doit interpoler `items.length` (et non un nombre).
  assert.match(
    children,
    /^\{\s*safeIndex \+ 1\s*\}\s*\/\s*\{\s*items\.length\s*\}$/,
    `le compteur doit s'écrire « {safeIndex + 1} / {items.length} » (lu : « ${children} »)`,
  );

  // Aucun chiffre hors interpolation dans le TEXTE du badge : ni « / 10 ».
  assert.doesNotMatch(
    children.replace(/\{[^}]*\}/g, ""),
    /\d/,
    "le badge de compteur contient un nombre en dur (ex. « / 10 ») : le total doit être dérivé du catalogue",
  );

  // Le badge et l'attribut de diagnostic doivent désigner la MÊME valeur.
  assert.equal(
    attribute,
    "items.length",
    "`data-signes-count` doit exposer `items.length` (valeur lue par la QA)",
  );
});

test("« Suivant » n'est borné que par la longueur du catalogue", () => {
  // Borne de l'index courant.
  assert.match(route, /Math\.min\(\s*index\s*,\s*items\.length - 1\s*\)/);

  // Le bouton « Suivant » avance tant qu'il reste un élément.
  assert.match(
    route,
    /disabled=\{\s*safeIndex === items\.length - 1\s*\}/,
    "le bouton « Suivant » doit être désactivé au DERNIER élément du catalogue, pas à une limite fixe",
  );
  assert.match(
    route,
    /setIndex\(\(i\) => Math\.min\(\s*items\.length - 1\s*,\s*i \+ 1\s*\)\)/,
    "l'incrément doit être borné par `items.length - 1`",
  );

  // Et la révélation propose bien « cas suivant » jusque-là.
  assert.match(
    route,
    /onNext=\{\s*safeIndex < items\.length - 1\s*\?/,
    "`onNext` doit exister jusqu'à l'avant-dernière fiche",
  );

  // Aucune constante de type MAX_ITEMS / TOTAL / PAGE_SIZE dans la route.
  assert.doesNotMatch(route, /\b(MAX_ITEMS|TOTAL_ITEMS|PAGE_SIZE|LIMIT)\b/);
});

test("le chargeur ne tronque pas le catalogue", () => {
  // Un `slice(0, N)` ou un `limit` sur les items réintroduirait le bug côté données.
  assert.doesNotMatch(
    catalog,
    /\.slice\(\s*0\s*,\s*\d+\s*\)/,
    "catalog.ts tronque la liste des fiches (slice(0, N))",
  );
  assert.doesNotMatch(catalog, /\blimit\b/i, "catalog.ts applique une limite au catalogue");

  // Le catalogue est la CONCATÉNATION de toutes les catégories du manifeste
  // (`flatMap` sur chaque catégorie, chaque catégorie chargeant TOUS ses ids).
  assert.match(
    catalog,
    /catalogs\.flatMap\(/,
    "catalog.ts doit concaténer toutes les catégories (flatMap) plutôt qu'en retenir quelques-unes",
  );
  assert.match(
    catalog,
    /ids\.map\(\(id\) =>/,
    "chaque catégorie doit charger TOUS les ids du manifeste (pas un sous-ensemble)",
  );
  assert.match(
    catalog,
    /assets\.filter\(/,
    "les fiches illisibles sont écartées par filtrage, pas par troncature",
  );
});

test("le manifeste publié et les fiches sur disque sont d'accord sur le total", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const categories = manifest.categories ?? {};
  const ids = Object.values(categories).flat();

  assert.ok(ids.length >= 100, `le manifeste ne déclare que ${ids.length} fiches (< 100)`);
  assert.equal(new Set(ids).size, ids.length, "ids dupliqués dans le manifeste");

  const missing = ids.filter(
    (id) => !SHEET_DIRS.some((dir) => existsSync(join(ROOT, dir, `${id}.json`))),
  );
  assert.deepEqual(missing, [], `fiches déclarées mais absentes du disque : ${missing.join(", ")}`);

  // Le total affiché par la page est celui du manifeste : on peut donc l'ancrer.
  const expected = 110;
  assert.equal(
    ids.length,
    expected,
    `le total servi est ${ids.length} ; la QA et la doc attendent ${expected}. ` +
      "Mettre à jour ce test ET docs/DECISIONS.md si le catalogue change.",
  );
});
