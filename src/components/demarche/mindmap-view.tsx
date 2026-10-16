import { useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { CalloutTone, DemarcheContent, Mindmap } from "@/core/demarche";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { viewPanelId } from "./view-tabs";

const CANVAS = 1000;
const R_BRANCH = 250;
const R_CHILD = 470;

const TONE_RING: Record<CalloutTone, string> = {
  urgence: "ring-danger/40 bg-danger/10",
  prudence: "ring-warn/45 bg-warn/10",
  reflexe: "ring-primary/35 bg-primary-soft",
  retenir: "ring-accent/40 bg-accent/10",
  memo: "ring-border bg-surface",
};

type LaidNode = {
  id: string;
  label: string;
  kind: "root" | "branch" | "child";
  tone?: CalloutTone;
  detail?: string;
  leaves: string[];
  x: number;
  y: number;
};

type LaidEdge = { from: string; to: string };

function layout(map: Mindmap): { nodes: LaidNode[]; edges: LaidEdge[] } {
  const center = CANVAS / 2;
  const nodes: LaidNode[] = [
    {
      id: map.root.id,
      label: map.root.label,
      kind: "root",
      detail: map.root.detail,
      leaves: [],
      x: center,
      y: center,
    },
  ];
  const edges: LaidEdge[] = [];
  const byId = new Map<string, LaidNode>([[map.root.id, nodes[0]]]);
  const count = map.branches.length;

  map.branches.forEach((branch, branchIndex) => {
    const angle = (-90 + branchIndex * (360 / count)) * (Math.PI / 180);
    const node: LaidNode = {
      id: branch.id,
      label: branch.label,
      kind: "branch",
      tone: branch.tone,
      detail: branch.detail,
      leaves: [],
      x: center + Math.cos(angle) * R_BRANCH,
      y: center + Math.sin(angle) * R_BRANCH,
    };
    nodes.push(node);
    byId.set(node.id, node);
    edges.push({ from: map.root.id, to: node.id });

    const childCount = branch.children.length;
    const spreadDeg = Math.min(58, (360 / count) * 0.85);
    branch.children.forEach((child, childIndex) => {
      const offsetDeg =
        childCount <= 1 ? 0 : (childIndex - (childCount - 1) / 2) * (spreadDeg / (childCount - 1));
      const childAngle = angle + offsetDeg * (Math.PI / 180);
      const childNode: LaidNode = {
        id: child.id,
        label: child.label,
        kind: "child",
        tone: branch.tone,
        detail: child.detail,
        leaves: (child.leaves ?? []).map((leaf) => leaf.label),
        x: center + Math.cos(childAngle) * R_CHILD,
        y: center + Math.sin(childAngle) * R_CHILD,
      };
      nodes.push(childNode);
      byId.set(childNode.id, childNode);
      edges.push({ from: branch.id, to: childNode.id });
    });
  });

  return { nodes, edges };
}

export function MindmapView({ content }: { content: DemarcheContent }) {
  const { t } = useI18n();
  const { nodes, edges } = layout(content.mindmap);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const [scale, setScale] = useState(0.62);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [selectedId, setSelectedId] = useState(content.mindmap.root.id);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  const selected = byId.get(selectedId) ?? nodes[0];

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    setDrag({ x: event.clientX, y: event.clientY });
    setOrigin({ x: tx, y: ty });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setTx(origin.x + (event.clientX - drag.x));
    setTy(origin.y + (event.clientY - drag.y));
  }

  const clampScale = (value: number) => Math.min(1.6, Math.max(0.35, value));

  return (
    <div
      id={viewPanelId("mindmap")}
      role="tabpanel"
      aria-labelledby="vue-tab-mindmap"
      data-demarche-panel="mindmap"
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-subtle">{t("demarche.map.hint")}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("demarche.map.zoomOut")}
            onClick={() => setScale((value) => clampScale(value - 0.15))}
            className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-card text-muted shadow-[var(--shadow-border)]"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("demarche.map.zoomIn")}
            onClick={() => setScale((value) => clampScale(value + 0.15))}
            className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-card text-muted shadow-[var(--shadow-border)]"
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("demarche.map.reset")}
            onClick={() => {
              setScale(0.62);
              setTx(0);
              setTy(0);
            }}
            className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-card text-muted shadow-[var(--shadow-border)]"
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        data-mindmap-surface
        className="relative h-[26rem] overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: CANVAS,
            height: CANVAS,
            marginLeft: -CANVAS / 2,
            marginTop: -CANVAS / 2,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          <svg
            viewBox={`0 0 ${CANVAS} ${CANVAS}`}
            className="absolute inset-0 size-full"
            aria-hidden
          >
            {edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="var(--app-border)"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const active = node.id === selectedId;
            return (
              <button
                key={node.id}
                type="button"
                data-mindmap-node={node.id}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelectedId(node.id)}
                style={{
                  left: node.x,
                  top: node.y,
                  transform: "translate(-50%, -50%)",
                }}
                className={cn(
                  "absolute max-w-[11.5rem] rounded-[var(--radius-md)] px-2.5 py-1.5 text-center text-[12px] leading-tight shadow-[var(--shadow-border)] ring-1 transition-shadow",
                  node.kind === "root" && "bg-primary px-4 py-2 text-sm font-semibold text-primary-fg ring-primary",
                  node.kind !== "root" && (node.tone ? TONE_RING[node.tone] : "bg-card ring-border"),
                  active && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--app-accent)_45%,transparent)]",
                )}
              >
                <span className={cn("font-medium", node.kind === "root" ? "" : "text-fg")}>
                  {node.label}
                </span>
                {node.leaves.map((leaf) => (
                  <span key={leaf} className="mt-1 block text-[10px] font-normal text-muted">
                    {leaf}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="optimus-card p-4" data-mindmap-detail={selected.id}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {selected.kind === "root" ? t("demarche.map.root") : t("demarche.map.branch")}
        </p>
        <p className="mt-1 font-display text-base font-medium">{selected.label}</p>
        {selected.detail ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{selected.detail}</p>
        ) : null}
      </div>
    </div>
  );
}
