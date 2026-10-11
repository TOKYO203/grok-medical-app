import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Garde-fou de routage du contenu.
 *
 * Chaque `ContentItem` de la Bibliothèque porte un `ContentLink` typé. Ce test
 * verrouille deux choses qu'un simple `tsc` ne peut pas voir :
 *   1. la cible de chaque lien correspond bien à une route réellement enregistrée
 *      sous `src/routes/` ;
 *   2. une « démarche » ouvre sa page `/demarche/$id` — elle a déjà été branchée
 *      par erreur sur `/calculateurs` (la carte promettait une démarche et
 *      livrait la page des scores cliniques).
 */

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [contentIndex, contentCard, demarcheRoute] = await Promise.all([
  read("src/lib/library/content-index.ts"),
  read("src/components/content/content-card.tsx"),
  read("src/routes/demarche.$id.tsx"),
]);

test("every ContentLink target is a registered route", async () => {
  const allDestinations = [...contentIndex.matchAll(/to:\s*"(\/[^"]*)"/g)].map((m) => m[1]);
  assert.ok(allDestinations.length >= 5, "ContentLink: aucune cible détectée");

  for (const destination of new Set(allDestinations)) {
    const [staticRoute, dynamicParam] = destination.split("/$");
    const file = dynamicParam
      ? `src/routes/${staticRoute.replace(/^\//, "").replace(/\//g, ".")}.$${dynamicParam}.tsx`
      : `src/routes/${destination === "/" ? "index" : destination.slice(1)}.tsx`;
    const source = await read(file).catch(() => null);
    assert.ok(source, `ContentLink: la route "${destination}" n'existe pas (${file})`);
    assert.match(
      source,
      new RegExp(`createFileRoute\\("${destination.replace(/\$/g, "\\$")}"\\)`),
      `ContentLink: ${file} n'enregistre pas la route "${destination}"`,
    );
  }
});

test("a diagnostic (démarche) card opens /demarche/$id, not /calculateurs", () => {
  const diagnosticBuilder = contentIndex.slice(contentIndex.indexOf("function diagnosticToItem"));
  const body = diagnosticBuilder.slice(0, diagnosticBuilder.indexOf("\n}"));
  assert.match(
    body,
    /link:\s*\{\s*to:\s*"\/demarche\/\$id",\s*params:\s*\{\s*id:\s*diagnostic\.id\s*\}\s*\}/,
    "diagnosticToItem doit pointer vers /demarche/$id",
  );
  assert.doesNotMatch(
    body,
    /to:\s*"\/calculateurs"/,
    "diagnosticToItem ne doit plus pointer vers /calculateurs",
  );
});

test("the ContentLink union and the card wrapper both know /demarche/$id", () => {
  assert.match(
    contentIndex,
    /\{\s*to:\s*"\/demarche\/\$id";\s*params:\s*\{\s*id:\s*string\s*\}\s*\}/,
    "ContentLink: variante /demarche/$id absente",
  );
  assert.match(
    contentCard,
    /link\.to === "\/demarche\/\$id"[\s\S]{0,120}params=\{link\.params\}/,
    "ContentLinkWrap: /demarche/$id non rendu avec ses params",
  );
});

test("the /demarche/$id route exposes the `id` param the link sends", () => {
  assert.match(demarcheRoute, /createFileRoute\("\/demarche\/\$id"\)/);
  assert.match(
    demarcheRoute,
    /const\s*\{\s*id\s*\}\s*=\s*Route\.useParams\(\)/,
    "param `id` attendu",
  );
});
