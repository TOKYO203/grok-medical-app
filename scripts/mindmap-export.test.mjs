// Garde-fou de l'export de la carte mentale.
//
// L'export doit produire un SVG AUTONOME : aucune `var(--app-*)`, aucune classe
// CSS, toutes les couleurs en clair. Sinon le fichier exporté (ou l'image PNG)
// s'affiche noir sur blanc dans le presse-papiers ou hors de l'app.
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
    // Imports relatifs sans extension (convention du bundler) : on essaie les
    // extensions TypeScript avant d'abandonner.
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const ext of [".ts", ".tsx", ".js"]) {
        try {
          return nextResolve(specifier + ext, context);
        } catch {
          /* essaie l'extension suivante */
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const { computeMindmapLayout, wrapLabel, MINDMAP_NODE_METRICS } = await import(
  "../src/components/demarche/mindmap-layout.ts"
);
const { buildMindmapSvg, svgToDataUrl } = await import(
  "../src/components/demarche/mindmap-export.ts"
);

const map = JSON.parse(
  readFileSync(new URL("../src/content/data/demarches/douleur-thoracique.json", import.meta.url), "utf8"),
).mindmap;

const PALETTE = {
  background: "#FFFFFF",
  card: "#FFFFFF",
  fg: "#1F1A14",
  muted: "#5E4D35",
  border: "#A67C1E",
  rootFrom: "#3E4A2A",
  rootTo: "#3E4A2A",
  rootFg: "#FFFFFF",
  criticity: { critique: "#8B2E1F", grave: "#A67C1E", examens: "#1B4B77", benin: "#4F6B2D" },
};

const layout = computeMindmapLayout(map, new Set(map.branches.map((b) => b.id)));
const svg = buildMindmapSvg(layout, PALETTE, {
  title: "Douleur thoracique",
  subtitle: "Orientation diagnostique",
  legend: [
    { label: "Critique", color: PALETTE.criticity.critique },
    { label: "Grave", color: PALETTE.criticity.grave },
  ],
});

test("l'export est un SVG autonome, sans variable CSS ni classe", () => {
  assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(!svg.includes("var(--"), "aucune var(--app-*) ne doit subsister");
  assert.ok(!/\sclass="/.test(svg), "aucune classe CSS ne doit subsister");
  assert.ok(svg.includes("</svg>"));
});

test("les balises du SVG exporté sont équilibrées", () => {
  const count = (needle) => svg.split(needle).length - 1;
  const opens = count("<g ") + count("<g>");
  const closes = count("</g>");
  assert.equal(opens, closes, `g ouverts ${opens} ≠ fermés ${closes}`);
  assert.equal(count("<text"), count("</text>"));
  assert.equal(count("<tspan"), count("</tspan>"));
  // Les rectangles sont auto-fermants : aucun </rect> ne doit traîner.
  assert.equal(count("</rect>"), 0);
  // Une pastille de comptage par branche porteuse d'enfants + 2 pastilles de légende.
  const withChildren = layout.nodes.filter((n) => n.kind === "branch" && n.childCount > 0).length;
  assert.equal(count("<circle"), withChildren + 2);
});

test("chaque nœud du layout est présent (la 1re ligne de son libellé est rendue)", () => {
  const escape = (text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  assert.ok(svg.includes("Douleur thoracique"));
  for (const node of layout.nodes) {
    const spec =
      node.kind === "root"
        ? MINDMAP_NODE_METRICS.ROOT
        : node.kind === "branch"
          ? MINDMAP_NODE_METRICS.BRANCH
          : MINDMAP_NODE_METRICS.CHILD;
    const firstLine = wrapLabel(node.label, spec.font, spec.maxWidth)[0];
    assert.ok(
      svg.includes(escape(firstLine)),
      `nœud absent du SVG : ${node.id} (« ${firstLine} »)`,
    );
  }
  // Les caractères dangereux sont échappés.
  const risky = buildMindmapSvg(
    { ...layout, nodes: [{ ...layout.nodes[0], label: "A & B <script>" }] },
    PALETTE,
  );
  assert.ok(risky.includes("A &amp; B &lt;script&gt;"));
  assert.ok(!risky.includes("<script>"));
});

test("svgToDataUrl encode le SVG (utilisable par <img>)", () => {
  const url = svgToDataUrl(svg);
  assert.ok(url.startsWith("data:image/svg+xml;charset=utf-8,"));
  const decoded = decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length));
  assert.equal(decoded, svg);
});
