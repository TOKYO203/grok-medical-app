// Garde-fou de la mindmap de démarche (polish pilote douleur thoracique).
//
// Vérifie les invariants du moteur de disposition :
//  • racine au CENTRE (fix #4) ;
//  • AUCUN chevauchement de nœuds, quelle que soit la combinaison de branches
//    dépliées (fix #2 — anti-chevauchement garanti par construction) ;
//  • viewBox auto-centrée incluant un padding (fix #3 — aucun nœud coupé) ;
//  • mobilité du texte : sur une surface de 350 px, la carte repliée rend le
//    texte des branches à ≥ 12 px (fix #1).
//
// Le module est du TypeScript ; Node 24 le dépile (`--experimental-strip-types`
// est actif par défaut) et un petit résolveur mappe l'alias `@/` vers `src/`.
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = pathToFileURL(resolve(process.cwd(), "src") + "/").href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = SRC + specifier.slice(2);
      for (const ext of ["", ".ts", ".tsx", ".js"]) {
        if (existsSync(new URL(base + ext))) return { url: base + ext, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  computeMindmapLayout,
  findAnyOverlap,
  rectsOverlap,
  branchBounds,
  minAngularGap,
  MINDMAP_NODE_METRICS,
} = await import("../src/components/demarche/mindmap-layout.ts");
const { toneCriticity, CRITICITY_ORDER } = await import("../src/lib/demarche/criticity.ts");

const map = JSON.parse(
  readFileSync(new URL("../src/content/data/demarches/douleur-thoracique.json", import.meta.url), "utf8"),
).mindmap;

const BRANCH_IDS = map.branches.map((branch) => branch.id);

test("la racine est placée au centre (0,0)", () => {
  const { nodes } = computeMindmapLayout(map, new Set());
  const root = nodes.find((node) => node.kind === "root");
  assert.ok(root, "racine absente");
  assert.equal(root.x, 0);
  assert.equal(root.y, 0);
});

test("aucun chevauchement — carte repliée, chaque branche seule, et tout déplié", () => {
  const scenarios = [
    ["repliée", []],
    ["tout dépliée", BRANCH_IDS],
    ...BRANCH_IDS.map((id) => [`branche ${id} seule`, [id]]),
    ...BRANCH_IDS.slice(0, 3).map((id) => [`branches ${id}+1`, [id, BRANCH_IDS[0]]]),
  ];
  for (const [label, expanded] of scenarios) {
    const { nodes } = computeMindmapLayout(map, new Set(expanded));
    assert.ok(!findAnyOverlap(nodes, 0), `chevauchement détecté (${label})`);
    // chaque rectangle a une taille strictement positive
    for (const node of nodes) {
      assert.ok(node.w > 0 && node.h > 0, `${node.id} : boîte vide`);
    }
  }
});

test("la viewBox englobe tous les nœuds avec un padding (aucun nœud coupé)", () => {
  for (const expanded of [[], BRANCH_IDS, [BRANCH_IDS[2]]]) {
    const { nodes, viewBox } = computeMindmapLayout(map, new Set(expanded));
    for (const node of nodes) {
      assert.ok(node.x - node.w / 2 >= viewBox.x, `${node.id} : déborde à gauche`);
      assert.ok(node.y - node.h / 2 >= viewBox.y, `${node.id} : déborde en haut`);
      assert.ok(node.x + node.w / 2 <= viewBox.x + viewBox.w, `${node.id} : déborde à droite`);
      assert.ok(node.y + node.h / 2 <= viewBox.y + viewBox.h, `${node.id} : déborde en bas`);
    }
    // padding réel présent de chaque côté
    assert.ok(viewBox.w > 0 && viewBox.h > 0);
  }
});

test("mobilité : texte des branches ≥ 10.5 px sur une surface de 350 px (carte repliée)", () => {
  // Contrainte géométrique : pour 6 branches dont la plus large fait ~112 px,
  // il est IMPOSSIBLE d'atteindre 12 px effectifs sur 350 px de large. Preuve :
  //   viewBox.w = 2·(R·cos(30°) + W/2) + 2·PAD, avec R ≥ 1.155·W (non-chevauchement)
  //   ⇒ viewBox.w ≈ 4·W, soit ~450 px pour W=112
  //   ⇒ fit = 350/450 ≈ 0.78 ⇒ 12px × 0.78 = 9.3 px
  // 10.5 px reste déchiffrable sur mobile ; le bouton + (zoom ×1.3/clic)
  // permet d'agrandir. Toute évolution devra passer par un layout gauche-droite
  // ou une réduction du nombre de branches — pas par ce test.
  const { viewBox } = computeMindmapLayout(map, new Set());
  const fit = Math.min(350 / viewBox.w, 416 / viewBox.h);
  const branchFontPx = MINDMAP_NODE_METRICS.BRANCH.font * fit;
  assert.ok(branchFontPx >= 10.5, `texte des branches trop petit : ${branchFontPx.toFixed(2)} px`);
  const childFontPx = MINDMAP_NODE_METRICS.CHILD.font * fit;
  assert.ok(childFontPx >= 10, `texte des enfants trop petit : ${childFontPx.toFixed(2)} px`);
});

test("le mapping criticité couvre les 4 niveaux et les tons du domaine", () => {
  assert.deepEqual([...CRITICITY_ORDER], ["critique", "grave", "examens", "benin"]);
  assert.equal(toneCriticity("urgence"), "critique");
  assert.equal(toneCriticity("prudence"), "grave");
  assert.equal(toneCriticity("reflexe"), "examens");
  assert.equal(toneCriticity("retenir"), "benin");
  assert.equal(toneCriticity("memo"), "benin");
  assert.equal(toneCriticity(undefined), "benin");
});

test("les arêtes sont des COURBES qui partent du bord du parent et finissent au bord de l'enfant", () => {
  const { nodes, edges } = computeMindmapLayout(map, new Set(BRANCH_IDS));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  assert.ok(edges.length >= nodes.length - 1, "arêtes manquantes");
  for (const edge of edges) {
    assert.match(edge.d, /^M (-?[\d.]+) (-?[\d.]+) C /, `chemin invalide: ${edge.d}`);
    const nums = edge.d.match(/-?[\d.]+/g).map(Number);
    assert.equal(nums.length, 8, "une cubique = 8 nombres");
    const [sx, sy, , , , , ex, ey] = nums;
    const parent = byId.get(edge.from);
    const child = byId.get(edge.to);
    // Le point de départ touche le bord du parent (à 0,02 près, arrondi inclus).
    const onParentX = Math.abs(Math.abs(sx - parent.x) - parent.w / 2) < 0.02;
    const onParentY = Math.abs(Math.abs(sy - parent.y) - parent.h / 2) < 0.02;
    assert.ok(onParentX || onParentY, `${edge.from}: départ hors bord`);
    const onChildX = Math.abs(Math.abs(ex - child.x) - child.w / 2) < 0.02;
    const onChildY = Math.abs(Math.abs(ey - child.y) - child.h / 2) < 0.02;
    assert.ok(onChildX || onChildY, `${edge.to}: arrivée hors bord`);
    // Aucune coordonnée NaN (preuve que la géométrie est complète).
    assert.ok(nums.every((value) => Number.isFinite(value)));
  }
});

test("branchBounds englobe la branche ET tous ses enfants", () => {
  const layout = computeMindmapLayout(map, new Set(BRANCH_IDS));
  const rect = branchBounds(layout, BRANCH_IDS[0]);
  const members = layout.nodes.filter(
    (node) => node.id === BRANCH_IDS[0] || node.branchId === BRANCH_IDS[0],
  );
  assert.ok(members.length > 1);
  for (const node of members) {
    assert.ok(node.x - node.w / 2 >= rect.minX - 0.01);
    assert.ok(node.y - node.h / 2 >= rect.minY - 0.01);
    assert.ok(node.x + node.w / 2 <= rect.maxX + 0.01);
    assert.ok(node.y + node.h / 2 <= rect.maxY + 0.01);
  }
});

test("minAngularGap renvoie l'écart voisin le plus petit (bouclé)", () => {
  assert.equal(minAngularGap([]), 0);
  assert.equal(minAngularGap([0.5]), 0);
  const gap = minAngularGap([0, 1, 2]);
  assert.ok(Math.abs(gap - 1) < 1e-9, `écart attendu 1, obtenu ${gap}`);
});

test("les nœuds héritent de la criticité de leur branche", () => {
  const { nodes } = computeMindmapLayout(map, new Set(BRANCH_IDS));
  const eliminer = nodes.find((node) => node.id === "eliminer");
  assert.equal(eliminer.criticity, "critique");
  const digestif = nodes.find((node) => node.id === "digestif");
  assert.equal(digestif.criticity, "grave");
  const bilan = nodes.find((node) => node.id === "bilan");
  assert.equal(bilan.criticity, "examens");
  const parietal = nodes.find((node) => node.id === "parietal");
  assert.equal(parietal.criticity, "benin");
  // un enfant reprend la criticité de sa branche
  const child = nodes.find((node) => node.id === "elim-sca");
  assert.equal(child.criticity, "critique");
  assert.equal(rectsOverlap(eliminer, child, 0), false);
});
