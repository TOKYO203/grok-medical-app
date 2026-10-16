/**
 * Moteur de disposition de la carte mentale — « radial tidy » déterministe.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  MODÈLE GÉOMÉTRIQUE (et pourquoi il ne peut PAS y avoir de chevauchement)
 * ══════════════════════════════════════════════════════════════════════════
 *  1. La racine occupe le centre (0,0).
 *  2. Les branches occupent un anneau de rayon R1 ; chacune reçoit un SECTEUR
 *     angulaire proportionnel à son poids (1 repliée, 1 + n enfants dépliée) :
 *     une branche qui déplie 6 enfants s'écarte pour leur faire de la place.
 *  3. Les enfants dépliés occupent un anneau de rayon R2, répartis DANS le
 *     secteur de leur branche (donc jamais entre les secteurs voisins).
 *  4. R1 et R2 sont calculés pour que TOUTE paire de nœuds obéisse à la même
 *     inégalité conservatrice. Un rectangle tient dans le disque de rayon
 *     d/2 avec d = hypot(w + GAP, h + GAP). Si la distance entre deux centres
 *     vaut au moins (d_i + d_j)/2, les deux disques sont disjoints, donc les
 *     rectangles aussi. Or :
 *       • même anneau  : distance = 2·R·sin(Δ/2) ≥ max(d)  ⇒  R = max(d) / (2·sin(Δmin/2))
 *         avec Δmin le plus petit écart angulaire entre voisins (trié, bouclé).
 *       • anneaux ≠    : distance ≥ |R2 − R1| ≥ (max d_branche + max d_enfant)/2.
 *       • racine       : R1 ≥ (d_racine + d_branche)/2 + GAP.
 *     On a donc une PREUVE, pas une impression : rendre les anneaux plus grands
 *     ne peut que renforcer la marge.
 *
 * Le module est PUR (aucun DOM, aucune dépendance) : il est testé sous Node, et
 * ses coordonnées sont arrondies au centième pour que le rendu SSR et le rendu
 * navigateur produisent EXACTEMENT la même chaîne (anti-mismatch hydratation).
 */
import type { Mindmap } from "@/core/demarche";
import { toneCriticity, type Criticity } from "@/lib/demarche/criticity";

export type MapNodeKind = "root" | "branch" | "child";

export type MapNode = {
  id: string;
  label: string;
  kind: MapNodeKind;
  criticity: Criticity;
  detail?: string;
  leaves: string[];
  branchId?: string;
  childCount: number;
  expanded: boolean;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Angle du nœud depuis le centre (radians). */
  angle: number;
  /** Distance du nœud au centre (unités monde). */
  radius: number;
};

/** Arête parent → enfant, prête à poser : géométrie courbe déjà calculée. */
export type MapEdge = {
  from: string;
  to: string;
  /** Chemin SVG (`M … C …`) qui part du bord du parent et finit au bord de l'enfant. */
  d: string;
  criticity: Criticity;
  depth: number;
};

export type MapRect = { minX: number; minY: number; maxX: number; maxY: number };

export type MapLayout = {
  nodes: MapNode[];
  edges: MapEdge[];
  rect: MapRect;
  viewBox: { x: number; y: number; w: number; h: number };
  rootId: string;
};

/** Rayon du secteur d'enfants réellement occupé (0.92) — laisse une gouttière
 *  entre les secteurs voisins, la séparation finale étant garantie par Δmin. */
const SECTOR_FILL = 0.92;
const ROOT = { font: 15, maxWidth: 120, padX: 12, padY: 9 };
const BRANCH = { font: 12, maxWidth: 85, padX: 9, padY: 6 };
const CHILD = { font: 11.5, maxWidth: 105, padX: 9, padY: 6 };
const LEAF_FONT = 10;
const LINE_HEIGHT = 1.24;
const LEAF_HEIGHT = 1.3;
const CHAR_RATIO = 0.56;
const GAP = 12;
const PAD = 12;
type Spec = { font: number; maxWidth: number; padX: number; padY: number };
const charWidth = (font: number) => font * CHAR_RATIO;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function wrapLabel(text: string, font: number, maxWidth: number): string[] {
  const maxChars = Math.max(6, Math.floor(maxWidth / charWidth(font)));
  // Tokenize : coupe aux espaces ET aux tirets (garde le tiret à la fin).
  // "Cardio-vasculaires" → ["Cardio-", "vasculaires"] → 2 lignes lisibles,
  // au lieu d'un "Cardio-vascula/ires" en plein milieu d'un mot.
  const words = text.match(/[^\s-]+-?|\S+/g) ?? [text];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function measure(label: string, leaves: string[], spec: Spec) {
  const lines = wrapLabel(label, spec.font, spec.maxWidth);
  const leafLines = leaves.slice(0, 2);
  const longest = Math.max(
    ...lines.map((line) => line.length * charWidth(spec.font)),
    ...leafLines.map((line) => Math.min(line.length, 26) * charWidth(LEAF_FONT)),
    0,
  );
  const w = Math.min(spec.maxWidth, Math.ceil(longest) + spec.padX * 2);
  const titleHeight = lines.length * spec.font * LINE_HEIGHT;
  const leafHeight = leafLines.length * LEAF_FONT * LEAF_HEIGHT;
  const h = Math.ceil(titleHeight + leafHeight + spec.padY * 2);
  return { w, h };
}

/** Diamètre du disque qui contient le nœud (marge incluse). */
function disc(node: { w: number; h: number }) {
  return Math.hypot(node.w + GAP, node.h + GAP);
}

/** Plus petit écart angulaire entre deux voisins d'un jeu d'angles trié (bouclé).
 *  Renvoie 0 quand il n'y a pas de contrainte possible (< 2 nœuds). */
export function minAngularGap(sortedAngles: number[]): number {
  if (sortedAngles.length < 2) return 0;
  let min = Infinity;
  for (let i = 0; i < sortedAngles.length; i += 1) {
    const a = sortedAngles[i];
    const b = sortedAngles[(i + 1) % sortedAngles.length];
    const gap = i === sortedAngles.length - 1 ? b + Math.PI * 2 - a : b - a;
    if (gap < min) min = gap;
  }
  return min;
}

/** Point du bord d'un rectangle, dans la direction (ux, uy) depuis son centre. */
function boundary(cx: number, cy: number, w: number, h: number, ux: number, uy: number) {
  const tx = Math.abs(ux) > 1e-6 ? w / 2 / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? h / 2 / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}

/** Direction « vers l'extérieur » d'un nœud : radiale, ou axiale pour la racine. */
function outward(node: MapNode): { x: number; y: number } {
  const len = Math.hypot(node.x, node.y);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: node.x / len, y: node.y / len };
}

/**
 * Chemin courbe parent → enfant. La courbe quitte le parent vers l'extérieur et
 * entre dans l'enfant par l'intérieur : un « S » doux, jamais une droite, qui
 * donne le rendu organique des cartes mentales professionnelles.
 */
function edgePath(parent: MapNode, child: MapNode): string {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const start = boundary(parent.x, parent.y, parent.w, parent.h, ux, uy);
  const end = boundary(child.x, child.y, child.w, child.h, -ux, -uy);
  const outP = outward(parent);
  const outC = outward(child);
  const bow = dist * 0.42;
  const c1x = start.x + outP.x * bow;
  const c1y = start.y + outP.y * bow;
  const c2x = end.x - outC.x * bow;
  const c2y = end.y - outC.y * bow;
  const n = (v: number) => round2(v);
  return `M ${n(start.x)} ${n(start.y)} C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(end.x)} ${n(end.y)}`;
}

function boundsOf(nodes: MapNode[]): MapRect {
  return {
    minX: Math.min(...nodes.map((node) => node.x - node.w / 2)),
    minY: Math.min(...nodes.map((node) => node.y - node.h / 2)),
    maxX: Math.max(...nodes.map((node) => node.x + node.w / 2)),
    maxY: Math.max(...nodes.map((node) => node.y + node.h / 2)),
  };
}

function viewBoxOf(rect: MapRect) {
  return {
    x: round2(rect.minX - PAD),
    y: round2(rect.minY - PAD),
    w: round2(rect.maxX - rect.minX + 2 * PAD),
    h: round2(rect.maxY - rect.minY + 2 * PAD),
  };
}

export function computeMindmapLayout(map: Mindmap, expanded: Set<string>): MapLayout {
  const nodes: MapNode[] = [];

  const rootBox = measure(map.root.label, [], ROOT);
  const root: MapNode = {
    id: map.root.id,
    label: map.root.label,
    kind: "root",
    criticity: "benin",
    detail: map.root.detail,
    leaves: [],
    childCount: map.branches.length,
    expanded: true,
    depth: 0,
    x: 0,
    y: 0,
    w: rootBox.w,
    h: rootBox.h,
    angle: 0,
    radius: 0,
  };
  nodes.push(root);

  const n = map.branches.length;
  if (n === 0) {
    const rect = boundsOf(nodes);
    return { nodes, edges: [], rect, viewBox: viewBoxOf(rect), rootId: root.id };
  }

  const branchBoxes = map.branches.map((branch) => measure(branch.label, [], BRANCH));
  const weights = map.branches.map((branch) =>
    expanded.has(branch.id) ? 1 + branch.children.length : 1,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  // ── Sectors : chaque branche reçoit une part de 2π proportionnelle à son poids.
  let cursor = -Math.PI / 2;
  const placements = map.branches.map((branch, i) => {
    const span = (weights[i] / totalWeight) * Math.PI * 2;
    const entry = {
      branch,
      index: i,
      span,
      start: cursor,
      center: cursor + span / 2,
      box: branchBoxes[i],
      expanded: expanded.has(branch.id),
    };
    cursor += span;
    return entry;
  });

  // ── Anneau 1 : rayon garantissant dégagement de la racine ET non-chevauchement.
  const rootDisc = disc(root);
  const branchDiscs = branchBoxes.map(disc);
  const maxBranchDisc = Math.max(...branchDiscs);
  let ring1 = 0;
  placements.forEach((p) => {
    ring1 = Math.max(ring1, rootDisc / 2 + branchDiscs[p.index] / 2 + GAP);
  });
  const gap1 = minAngularGap(placements.map((p) => p.center).sort((a, b) => a - b));
  if (gap1 > 1e-6) ring1 = Math.max(ring1, maxBranchDisc / (2 * Math.sin(gap1 / 2)));
  const R1 = Math.max(112, ring1);

  const nodeById = new Map<string, MapNode>();
  nodeById.set(root.id, root);
  const edgeSpecs: { parent: MapNode; child: MapNode }[] = [];

  placements.forEach((p) => {
    const node: MapNode = {
      id: p.branch.id,
      label: p.branch.label,
      kind: "branch",
      criticity: toneCriticity(p.branch.tone),
      detail: p.branch.detail,
      leaves: [],
      childCount: p.branch.children.length,
      expanded: p.expanded,
      depth: 1,
      x: round2(Math.cos(p.center) * R1),
      y: round2(Math.sin(p.center) * R1),
      w: p.box.w,
      h: p.box.h,
      angle: round2(p.center),
      radius: R1,
    };
    nodes.push(node);
    nodeById.set(node.id, node);
    edgeSpecs.push({ parent: root, child: node });
  });

  // ── Anneau 2 : enfants répartis dans le secteur de leur branche.
  const opened = placements.filter((p) => p.expanded && p.branch.children.length > 0);
  if (opened.length > 0) {
    const entries: { parent: MapNode; child: Mindmap["branches"][number]["children"][number]; angle: number; box: { w: number; h: number } }[] = [];
    opened.forEach((p) => {
      const parent = nodeById.get(p.branch.id);
      if (!parent) return;
      const k = p.branch.children.length;
      const usable = p.span * SECTOR_FILL;
      const step = usable / k;
      p.branch.children.forEach((child, j) => {
        const box = measure(child.label, (child.leaves ?? []).map((leaf) => leaf.label), CHILD);
        entries.push({
          parent,
          child,
          angle: p.center - usable / 2 + (j + 0.5) * step,
          box,
        });
      });
    });

    const childDiscs = entries.map((entry) => disc(entry.box));
    const maxChildDisc = Math.max(...childDiscs);
    const gap2 = minAngularGap(entries.map((entry) => entry.angle).sort((a, b) => a - b));
    // Séparation radiale anneau 1 ↔ anneau 2 (disques disjoints).
    let R2 = R1 + (maxBranchDisc + maxChildDisc) / 2;
    if (gap2 > 1e-6) R2 = Math.max(R2, maxChildDisc / (2 * Math.sin(gap2 / 2)));

    entries.forEach((entry) => {
      const node: MapNode = {
        id: entry.child.id,
        label: entry.child.label,
        kind: "child",
        criticity: entry.parent.criticity,
        detail: entry.child.detail,
        leaves: (entry.child.leaves ?? []).map((leaf) => leaf.label),
        branchId: entry.parent.id,
        childCount: 0,
        expanded: false,
        depth: 2,
        x: round2(Math.cos(entry.angle) * R2),
        y: round2(Math.sin(entry.angle) * R2),
        w: entry.box.w,
        h: entry.box.h,
        angle: round2(entry.angle),
        radius: R2,
      };
      nodes.push(node);
      nodeById.set(node.id, node);
      edgeSpecs.push({ parent: entry.parent, child: node });
    });
  }

  const edges: MapEdge[] = edgeSpecs.map(({ parent, child }) => ({
    from: parent.id,
    to: child.id,
    d: edgePath(parent, child),
    criticity: child.criticity,
    depth: child.depth,
  }));

  const rect = boundsOf(nodes);
  return { nodes, edges, rect, viewBox: viewBoxOf(rect), rootId: root.id };
}

export const MINDMAP_NODE_METRICS = {
  ROOT,
  BRANCH,
  CHILD,
  LEAF_FONT,
  LINE_HEIGHT,
  LEAF_HEIGHT,
  PAD,
};

/** Raccord : rayon minimal qui écarte `count` nœuds de même taille sur un anneau. */
export function radiusForRing(count: number, nw: number, nh: number): number {
  if (count <= 1) return 0;
  const step = (Math.PI * 2) / count;
  const chord = Math.hypot(nw + GAP, nh + GAP);
  return chord / (2 * Math.sin(step / 2));
}

export function rectsOverlap(a: MapNode, b: MapNode, margin = 0): boolean {
  return (
    a.x - a.w / 2 - margin < b.x + b.w / 2 &&
    b.x - b.w / 2 - margin < a.x + a.w / 2 &&
    a.y - a.h / 2 - margin < b.y + b.h / 2 &&
    b.y - b.h / 2 - margin < a.y + a.h / 2
  );
}

export function findAnyOverlap(nodes: MapNode[], gap = 0): boolean {
  for (let i = 0; i < nodes.length; i += 1)
    for (let j = i + 1; j < nodes.length; j += 1)
      if (rectsOverlap(nodes[i], nodes[j], gap)) return true;
  return false;
}

export function countNodes(layout: MapLayout): number {
  return layout.nodes.length;
}

/** Boîte englobante d'un sous-arbre (branche + ses enfants), pour l'auto-cadrage. */
export function branchBounds(layout: MapLayout, branchId: string): MapRect {
  const members = layout.nodes.filter(
    (node) => node.id === branchId || node.branchId === branchId,
  );
  return boundsOf(members.length ? members : layout.nodes);
}
