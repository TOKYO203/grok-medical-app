/**
 * Export d'une carte mentale vers un SVG autonome (puis PNG par rastérisation).
 *
 * Un SVG « vivant » dépend des variables CSS du thème (`var(--app-*)`) et des
 * feuilles de style : une fois isolé (balise `<img>`, presse-papiers, fichier),
 * ces variables disparaissent et le rendu devient noir sur blanc. On régénère
 * donc ici un SVG **entièrement littéral** : couleurs résolues en hexadécimal,
 * aucun `class`, aucun `var()`. Le résultat est identique au rendu écran, mais
 * autonome — donc partageable et imprimable (standard éditorial).
 *
 * Module PUR : aucune dépendance DOM, testé sous Node.
 */
import type { Criticity } from "@/lib/demarche/criticity";
import { MINDMAP_NODE_METRICS, wrapLabel, type MapLayout, type MapNode } from "./mindmap-layout";

export type MindmapPalette = {
  background: string;
  card: string;
  fg: string;
  muted: string;
  border: string;
  rootFrom: string;
  rootTo: string;
  rootFg: string;
  criticity: Record<Criticity, string>;
};

export type MindmapLegend = { label: string; color: string }[];

export type MindmapExportOptions = {
  title?: string;
  subtitle?: string;
  legend?: MindmapLegend;
  /** Largeur cible en px ; renseignée, elle est reportée sur le SVG (sans mise à l'échelle). */
  width?: number;
};

const num = (value: number) => Math.round(value * 100) / 100;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT_STACK =
  "'Figtree','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";

/** Mélange une couleur sur un fond (approximation sRGB) — pour les fonds de nœuds. */
function mix(a: string, b: string, ratio: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r + (pb.r - pa.r) * ratio);
  const g = Math.round(pa.g + (pb.g - pa.g) * ratio);
  const bl = Math.round(pa.b + (pb.b - pa.b) * ratio);
  return `rgb(${r} ${g} ${bl})`;
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

const asColor = (value: string) => (hexToRgb(value) ? value : "#000000");

function nodeText(node: MapNode, palette: MindmapPalette) {
  const spec =
    node.kind === "root"
      ? MINDMAP_NODE_METRICS.ROOT
      : node.kind === "branch"
        ? MINDMAP_NODE_METRICS.BRANCH
        : MINDMAP_NODE_METRICS.CHILD;
  const lineHeight = spec.font * MINDMAP_NODE_METRICS.LINE_HEIGHT;
  const leafHeight = MINDMAP_NODE_METRICS.LEAF_FONT * MINDMAP_NODE_METRICS.LEAF_HEIGHT;
  const titleLines = wrapLabel(node.label, spec.font, spec.maxWidth);
  const leafLines = node.leaves.slice(0, 2).map((leaf) => (leaf.length > 26 ? leaf.slice(0, 25) + "…" : leaf));
  const totalHeight = titleLines.length * lineHeight + leafLines.length * leafHeight;
  const startY = -totalHeight / 2 + lineHeight;

  const isRoot = node.kind === "root";
  const accent = node.criticity === "benin" ? palette.criticity.benin : palette.criticity[node.criticity];
  const fill = isRoot ? palette.rootTo : mix(accent, palette.card, 0.86);
  const textFill = isRoot ? palette.rootFg : palette.fg;
  const stroke = isRoot ? palette.rootFrom : accent;

  const rects: string[] = [];
  if (isRoot) {
    rects.push(
      `<rect x="${num(-node.w / 2)}" y="${num(-node.h / 2)}" width="${node.w}" height="${node.h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`,
    );
  } else {
    rects.push(
      `<rect x="${num(-node.w / 2)}" y="${num(-node.h / 2)}" width="${node.w}" height="${node.h}" rx="11" fill="${fill}" stroke="${stroke}" stroke-opacity="0.55" stroke-width="1.2"/>`,
    );
    // Épine d'accent sur le bord intérieur (côté racine).
    const inner = node.x < 0 ? 1 : -1;
    const spineX = inner > 0 ? -node.w / 2 + 1.5 : node.w / 2 - 5;
    rects.push(
      `<rect x="${num(spineX)}" y="${num(-node.h / 2 + 6)}" width="3.5" height="${num(node.h - 12)}" rx="1.75" fill="${accent}"/>`,
    );
  }

  const tspans = titleLines
    .map(
      (line, index) =>
        `<tspan x="0" y="${num(startY + index * lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const leafTspans = leafLines
    .map(
      (line, index) =>
        `<tspan x="0" y="${num(startY + titleLines.length * lineHeight + index * leafHeight)}" font-size="${MINDMAP_NODE_METRICS.LEAF_FONT}" fill="${palette.muted}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const badge =
    node.kind === "branch" && node.childCount > 0
      ? `<circle cx="${num(node.w / 2 - 7)}" cy="${num(-node.h / 2 + 7)}" r="8.5" fill="${node.expanded ? accent : palette.card}" stroke="${accent}" stroke-width="1.2"/><text x="${num(node.w / 2 - 7)}" y="${num(-node.h / 2 + 7)}" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="${node.expanded ? palette.card : accent}">${node.expanded ? "−" : node.childCount}</text>`
      : "";

  return `<g transform="translate(${node.x} ${node.y})">${rects.join("")}<text text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${spec.font}" font-weight="${isRoot ? 600 : 500}" fill="${textFill}">${tspans}${leafTspans}</text>${badge}</g>`;
}

/**
 * Construit un SVG autonome de la carte. Le PNG haute résolution se fait après
 * coup (rastérisation à ×2 dans le canvas), le SVG restant vectoriel.
 */
export function buildMindmapSvg(
  layout: MapLayout,
  palette: MindmapPalette,
  options: MindmapExportOptions = {},
): string {
  const pad = 28;
  const headerH = options.title ? 58 : 0;
  const legendH = options.legend?.length ? 34 : 0;
  const vb = layout.viewBox;

  const innerW = vb.w;
  const innerH = vb.h;
  const totalW = innerW + pad * 2;
  const totalH = innerH + headerH + legendH + pad * 2;
  const offsetX = pad - vb.x;
  const offsetY = headerH + pad - vb.y;

  const edges = layout.edges
    .map((edge) => {
      const color = asColor(
        palette.criticity[layout.nodes.find((n) => n.id === edge.to)?.criticity ?? "benin"],
      );
      const width = edge.depth === 1 ? 1.9 : 1.5;
      return `<path d="${edge.d}" fill="none" stroke="${color}" stroke-opacity="${edge.depth === 1 ? 0.62 : 0.45}" stroke-width="${width}" stroke-linecap="round"/>`;
    })
    .join("");

  const nodes = layout.nodes.map((node) => nodeText(node, palette)).join("");

  const header = options.title
    ? `<text x="${pad}" y="${pad + 22}" font-family="${FONT_STACK}" font-size="22" font-weight="600" fill="${palette.fg}">${escapeXml(options.title)}</text>` +
      (options.subtitle
        ? `<text x="${pad}" y="${pad + 44}" font-family="${FONT_STACK}" font-size="12.5" fill="${palette.muted}">${escapeXml(options.subtitle)}</text>`
        : "")
    : "";

  const legendY = totalH - pad - 12;
  const legend = options.legend?.length
    ? options.legend
        .map((item, index) => {
          const x = pad + index * 150;
          return `<circle cx="${x + 5}" cy="${legendY}" r="5" fill="${asColor(item.color)}"/><text x="${x + 16}" y="${legendY + 4}" font-family="${FONT_STACK}" font-size="11" fill="${palette.muted}">${escapeXml(item.label)}</text>`;
        })
        .join("")
    : "";

  const widthAttr = options.width ? ` width="${num(options.width)}"` : "";
  const heightAttr = options.width
    ? ` height="${num((options.width * totalH) / totalW)}"`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(totalW)} ${num(totalH)}"${widthAttr}${heightAttr} font-family="${FONT_STACK}"><rect x="0" y="0" width="${num(totalW)}" height="${num(totalH)}" rx="18" fill="${asColor(palette.background)}"/><g transform="translate(${num(offsetX)} ${num(offsetY)})">${edges}${nodes}</g>${header}<g>${legend}</g></svg>`;
}

/** Convertit un SVG autonome en data-URL utilisable par `<img>` (et donc canvas). */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
