import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Download,
  FileCode2,
  Focus,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Minus,
  Network,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { DemarcheContent } from "@/core/demarche";
import { useI18n } from "@/i18n";
import {
  CRITICITY_ORDER,
  criticityLabelKey,
  type Criticity,
} from "@/lib/demarche/criticity";
import { cn } from "@/lib/utils";
import { viewPanelId } from "./view-tabs";
import {
  branchBounds,
  computeMindmapLayout,
  MINDMAP_NODE_METRICS,
  wrapLabel,
  type MapLayout,
  type MapNode,
  type MapRect,
} from "./mindmap-layout";
import {
  buildMindmapSvg,
  svgToDataUrl,
  type MindmapPalette,
} from "./mindmap-export";

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.35;
const FOCUS_PAD = 0.2;

/** Couleur par criticité — palette Oxford (danger/ambre/bleu/succès). */
const CRITICITY_VAR: Record<Criticity, string> = {
  critique: "var(--app-danger)",
  grave: "var(--app-warn)",
  examens: "var(--app-info)",
  benin: "var(--app-success)",
};

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** Arrondi à 3 décimales (et `-0` neutralisé) : la chaîne de style produite doit
 *  être IDENTIQUE côté serveur et côté navigateur, sinon React signale un
 *  mismatch d'hydratation sur l'attribut `style`. */
const round3 = (value: number) => Math.round(value * 1000) / 1000 || 0;

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

/** Normalisation recherche : insensible à la casse ET aux accents. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function MindmapView({ content }: { content: DemarcheContent }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState(content.mindmap.root.id);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState<null | "export">(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  /** Vrai dès qu'un glissement dépasse le seuil : évite de déplier en pannant. */
  const draggedRef = useRef(false);
  /** Retour différé en caméra fluide après un coup de molette (zoom non passif). */
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [surface, setSurface] = useState({ w: 360, h: 420 });

  // ── Recherche : une requête déplie automatiquement les branches concernées.
  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return null;
    const ids = new Set<string>();
    for (const branch of content.mindmap.branches) {
      const parts = [
        branch.label,
        branch.detail,
        ...branch.children.flatMap((child) => [
          child.label,
          child.detail ?? "",
          ...(child.leaves ?? []).map((leaf) => leaf.label),
        ]),
      ];
      if (parts.some((part) => normalize(part).includes(needle))) {
        ids.add(branch.id);
        for (const child of branch.children) {
          const childText = [child.label, child.detail ?? "", ...(child.leaves ?? []).map((l) => l.label)];
          if (childText.some((part) => normalize(part).includes(needle))) ids.add(child.id);
        }
      }
    }
    if (normalize(content.mindmap.root.label).includes(needle)) ids.add(content.mindmap.root.id);
    return ids;
  }, [content, query]);

  const effectiveExpanded = useMemo(() => {
    if (!matches) return expanded;
    const next = new Set(expanded);
    for (const branch of content.mindmap.branches) {
      if (matches.has(branch.id)) next.add(branch.id);
    }
    return next;
  }, [expanded, matches, content]);

  const layout = useMemo(
    () => computeMindmapLayout(content.mindmap, effectiveExpanded),
    [content, effectiveExpanded],
  );
  const byId = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
  const selected = byId.get(selectedId) ?? layout.nodes[0];

  const spotlightNodes = useMemo(() => {
    if (!spotlight) return null;
    const ids = new Set<string>([spotlight, layout.rootId]);
    for (const node of layout.nodes) if (node.branchId === spotlight) ids.add(node.id);
    return ids;
  }, [spotlight, layout]);

  // ── Mesure de la surface (+ re-mesure à l'entrée/sortie plein écran).
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const update = () => setSurface({ w: node.clientWidth || 360, h: node.clientHeight || 420 });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [full]);

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menu) setMenu(null);
        else if (spotlight) setSpotlight(null);
        else setFull(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [full, menu, spotlight]);

  const vb = layout.viewBox;
  const viewW = vb.w / zoom;
  const viewH = vb.h / zoom;
  const pxPerUnit = Math.min(surface.w / viewW, surface.h / viewH);

  // ── Caméra : le `viewBox` du SVG reste celui de la carte ; le zoom et le
  //    déplacement vivent dans le `transform` CSS d'un <g class="mm-camera">,
  //    interpolé par le navigateur (transition déclarative, zéro re-render par
  //    image). L'origine `center` du groupe = centre du `viewBox`, donc
  //    `translate(-zoom·pan) scale(zoom)` centre exactement la zone visée.
  const viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  const cameraTransform = `translate(${round3(-zoom * pan.x)}px, ${round3(-zoom * pan.y)}px) scale(${round3(zoom)})`;

  // Fond (trame + voile) très large : en zoom arrière ou en déplacement, on ne
  // voit jamais de vide sous la carte.
  const world = { x: vb.x - vb.w, y: vb.y - vb.h, w: vb.w * 3, h: vb.h * 3 };

  // ── Échelonnement des animations d'entrée : vague du cœur vers l'extérieur.
  //    Chaque nœud reçoit un délai `--mm-delay` ; la clé de voûte est qu'il ne
  //    dépend QUE de la topologie (déterministe), donc SSR et client rendent la
  //    même chaîne (même au centième près).
  const nodeDelays = useMemo(() => {
    const delays = new Map<string, number>();
    let branchIndex = 0;
    const childIndex = new Map<string, number>();
    for (const node of layout.nodes) {
      if (node.kind === "root") {
        delays.set(node.id, 0);
      } else if (node.kind === "branch") {
        delays.set(node.id, 90 + Math.min(branchIndex, 8) * 42);
        branchIndex += 1;
      } else {
        const key = node.branchId ?? "";
        const seen = childIndex.get(key) ?? 0;
        childIndex.set(key, seen + 1);
        delays.set(node.id, 190 + Math.min(seen, 6) * 38);
      }
    }
    return delays;
  }, [layout]);

  /** Réglage de la caméra : DIRECT pendant un geste (le doigt commande), FLUIDE
   *  pour les mouvements programmés (zoom, cadrage). Écrit en DOM — jamais dans
   *  un état React — car la valeur bascule à chaque `pointermove`. */
  const clearWheelIdle = useCallback(() => {
    if (wheelIdle.current !== null) {
      clearTimeout(wheelIdle.current);
      wheelIdle.current = null;
    }
  }, []);

  const setCameraMode = useCallback(
    (mode: "smooth" | "instant") => {
      clearWheelIdle();
      surfaceRef.current?.setAttribute("data-mm-camera", mode);
    },
    [clearWheelIdle],
  );

  /** Cadre la vue sur un rectangle monde (auto-zoom à l'ouverture d'une branche). */
  const focusBounds = useCallback(
    (target: MapLayout, rect: MapRect) => {
      setCameraMode("smooth");
    const box = target.viewBox;
    const needW = (rect.maxX - rect.minX) * (1 + FOCUS_PAD);
    const needH = (rect.maxY - rect.minY) * (1 + FOCUS_PAD);
    const next = clampZoom(Math.min(box.w / Math.max(needW, 1), box.h / Math.max(needH, 1)));
    setZoom(next);
    setPan({
      x: (rect.minX + rect.maxX) / 2 - (box.x + box.w / 2),
      y: (rect.minY + rect.maxY) / 2 - (box.y + box.h / 2),
    });
    },
    [setCameraMode],
  );

  const fitAll = useCallback(() => {
    // Reprendre la caméra « fluide » : si elle vient d'un coup de molette, la
    // transition CSS est encore coupée et le recentrage serait instantané.
    setCameraMode("smooth");
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [setCameraMode]);

  function setExpandedAnd(next: Set<string>, focusId: string | null) {
    setExpanded(next);
    if (focusId) {
      const nextLayout = computeMindmapLayout(content.mindmap, next);
      focusBounds(nextLayout, branchBounds(nextLayout, focusId));
    }
  }

  function toggleBranch(id: string) {
    const next = new Set(expanded);
    const willExpand = !next.has(id);
    if (willExpand) next.add(id);
    else next.delete(id);
    setSelectedId(id);
    if (spotlight && spotlight !== id && willExpand) setSpotlight(null);
    setExpandedAnd(next, willExpand ? id : null);
    if (!willExpand) {
      // Repli : on recadre pour ne pas laisser la vue perdue dans le vide.
      setZoom((z) => clampZoom(z));
    }
  }

  function toggleSpotlight(id: string) {
    const next = spotlight === id ? null : id;
    setSpotlight(next);
    setSelectedId(id);
    if (next) {
      const withChildren = new Set(expanded);
      withChildren.add(id);
      setExpanded(withChildren);
      const nextLayout = computeMindmapLayout(content.mindmap, withChildren);
      focusBounds(nextLayout, branchBounds(nextLayout, id));
    }
  }

  function onNodeActivate(node: MapNode) {
    setSelectedId(node.id);
    if (node.kind === "branch" && node.childCount > 0) toggleBranch(node.id);
  }

  const allExpanded = content.mindmap.branches.every((branch) => expanded.has(branch.id));

  // ── Pan / pincement.
  function onPointerDown(event: React.PointerEvent) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Geste en cours : la caméra suit le doigt au pixel près (aucune transition).
    setCameraMode("instant");
    if (pointers.current.size === 1) {
      draggedRef.current = false;
      dragRef.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      dragRef.current = null;
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clampZoom((pinchRef.current.zoom * dist) / pinchRef.current.dist));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) draggedRef.current = true;
    setPan({
      x: drag.originX - (event.clientX - drag.x) / pxPerUnit,
      y: drag.originY - (event.clientY - drag.y) / pxPerUnit,
    });
  }

  function endPointer(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) {
      dragRef.current = null;
      // Geste terminé : la caméra redevient fluide pour les mouvements animés.
      setCameraMode("smooth");
    }
  }

  // ── Molette : zoom non passif (sinon le navigateur scrolle la page).
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Direct pendant la molette, fluide dès qu'elle s'arrête (240 ms).
      el.setAttribute("data-mm-camera", "instant");
      if (wheelIdle.current !== null) clearTimeout(wheelIdle.current);
      wheelIdle.current = setTimeout(() => {
        wheelIdle.current = null;
        el.setAttribute("data-mm-camera", "smooth");
      }, 240);
      setZoom((z) => clampZoom(z * Math.exp(-event.deltaY * 0.0016)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelIdle.current !== null) clearTimeout(wheelIdle.current);
    };
  }, [full]);

  // ── Navigation clavier : flèches = nœud voisin le plus proche dans la direction.
  function onKeyDown(event: React.KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (keys.includes(event.key)) {
      event.preventDefault();
      const candidates = layout.nodes.filter((node) => node.id !== selected.id);
      if (!candidates.length) return;
      const dir = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key]!;
      let best: MapNode | null = null;
      let bestScore = Infinity;
      for (const node of candidates) {
        const dx = node.x - selected.x;
        const dy = node.y - selected.y;
        const proj = dx * dir[0] + dy * dir[1];
        if (proj <= 4) continue;
        const ortho = Math.abs(dx * dir[1] - dy * dir[0]);
        const score = ortho * 2 + Math.abs(proj);
        if (score < bestScore) {
          bestScore = score;
          best = node;
        }
      }
      if (best) setSelectedId(best.id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNodeActivate(selected);
    }
    if (event.key === "Escape") {
      if (spotlight) setSpotlight(null);
      else if (query) setQuery("");
    }
  }

  // ── Export autonome (SVG / PNG), couleurs résolues dans le thème courant.
  function palette(): MindmapPalette {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    return {
      background: v("--app-surface", "#ffffff"),
      card: v("--app-card", "#ffffff"),
      fg: v("--app-fg", "#1F1A14"),
      muted: v("--app-muted", "#5E4D35"),
      border: v("--app-border", "#A67C1E"),
      rootFrom: v("--app-primary", "#3E4A2A"),
      rootTo: v("--app-primary", "#3E4A2A"),
      rootFg: v("--app-primary-fg", "#ffffff"),
      criticity: {
        critique: v("--app-danger", "#8B2E1F"),
        grave: v("--app-warn", "#A67C1E"),
        examens: v("--app-info", "#1B4B77"),
        benin: v("--app-success", "#4F6B2D"),
      },
    };
  }

  function exportSvgString(): string {
    const colors = palette();
    return buildMindmapSvg(layout, colors, {
      title: content.title,
      subtitle: content.subtitle,
      legend: CRITICITY_ORDER.map((criticity) => ({
        label: t(criticityLabelKey(criticity)),
        color: colors.criticity[criticity],
      })),
    });
  }

  function download(name: string, href: string) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function doExportSvg() {
    const svg = exportSvgString();
    download(
      `${content.slug}-carte-mentale.svg`,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
    setMenu(null);
  }

  function doExportPng() {
    const svg = exportSvgString();
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        download(`${content.slug}-carte-mentale.png`, url);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
    };
    img.src = svgToDataUrl(svg);
    setMenu(null);
  }

  // ── Corps de la carte (rendu en ligne, ou dans l'overlay plein écran).
  const mapBody = (
    <div className={cn("flex min-h-0 flex-col gap-3", full && "h-full")}>
      <div className="relative flex flex-wrap items-center gap-1.5" data-mindmap-toolbar>
        <label className="relative flex h-8 min-w-[8.5rem] flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-2.5 size-3.5 text-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("demarche.map.search")}
            aria-label={t("demarche.map.searchAria")}
            data-mindmap-search
            className="h-8 w-full rounded-[var(--radius-sm)] bg-card pl-8 pr-7 text-[12px] text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle focus-visible:shadow-[var(--shadow-border),0_0_0_3px_var(--app-primary-soft)]"
          />
          {query ? (
            <button
              type="button"
              aria-label={t("demarche.map.clear")}
              data-mindmap-clear
              onClick={() => setQuery("")}
              className="absolute right-1.5 flex size-5 items-center justify-center rounded-full text-subtle hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </label>
        <ToolButton
          onClick={() =>
            setExpandedAnd(
              allExpanded ? new Set() : new Set(content.mindmap.branches.map((b) => b.id)),
              null,
            )
          }
          label={t(allExpanded ? "demarche.map.collapseAll" : "demarche.map.expandAll")}
          data-mindmap-expand-all={allExpanded ? "collapse" : "expand"}
        >
          {allExpanded ? (
            <ChevronsDownUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronsUpDown className="size-3.5" aria-hidden />
          )}
        </ToolButton>
        <ToolButton
          onClick={() => setZoom((z) => clampZoom(z / ZOOM_STEP))}
          label={t("demarche.map.zoomOut")}
          data-mindmap-zoom="out"
          disabled={zoom <= MIN_ZOOM}
        >
          <Minus className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton
          onClick={() => setZoom((z) => clampZoom(z * ZOOM_STEP))}
          label={t("demarche.map.zoomIn")}
          data-mindmap-zoom="in"
          disabled={zoom >= MAX_ZOOM}
        >
          <Plus className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton onClick={fitAll} label={t("demarche.map.reset")} data-mindmap-zoom="reset">
          <Crosshair className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton
          onClick={() => setFull((value) => !value)}
          label={t(full ? "demarche.map.exitFullscreen" : "demarche.map.fullscreen")}
          data-mindmap-fullscreen={full ? "on" : "off"}
          active={full}
        >
          {full ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
        </ToolButton>
        <ToolButton
          onClick={() => setMenu(menu ? null : "export")}
          label={t("demarche.map.export")}
          data-mindmap-export="menu"
          active={menu === "export"}
        >
          <Download className="size-4" aria-hidden />
        </ToolButton>
        {/* Menu ancré sur la BARRE, pas sur le bouton : la barre se replie sur
            plusieurs lignes en mobile et un menu aligné sur le bouton sortait de
            l'écran par la gauche (impossible à cliquer). `right-0` ici = bord droit
            du panneau, toujours visible ; largeur plafonnée à la fenêtre. */}
        {menu === "export" ? (
          <div className="absolute right-0 top-full z-30 mt-1 w-40 max-w-[calc(100vw-1rem)] overflow-hidden rounded-[var(--radius-md)] bg-card py-1 shadow-[var(--shadow-md)]">
            <MenuItem
              onClick={doExportPng}
              icon={<ImageIcon className="size-3.5" aria-hidden />}
              label={t("demarche.map.exportPng")}
              data-mindmap-export="png"
            />
            <MenuItem
              onClick={doExportSvg}
              icon={<FileCode2 className="size-3.5" aria-hidden />}
              label={t("demarche.map.exportSvg")}
              data-mindmap-export="svg"
            />
          </div>
        ) : null}
      </div>

      <div
        ref={surfaceRef}
        data-mindmap-surface
        data-mindmap-count={layout.nodes.length}
        data-mindmap-spotlight={spotlight ?? ""}
        data-mindmap-zoom-level={zoom.toFixed(2)}
        data-mm-camera="smooth"
        className={cn(
          "mm-surface relative overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]",
          full ? "min-h-0 flex-1" : "h-[26rem]",
        )}
        style={{ touchAction: "none" }}
      >
        {/* `onPointerDownCapture` : TOUT nouveau geste remet le drapeau
            « glissement » à zéro. Sans cela, un nœud touché juste après un
            déplacement restait inerte — son `onPointerDown` stoppe la propagation
            (le gestionnaire de la surface ne s'exécute donc pas) et le drapeau
            restait bloqué à `true`. */}
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="mm-canvas size-full cursor-grab active:cursor-grabbing"
          onPointerDownCapture={() => {
            draggedRef.current = false;
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onKeyDown={onKeyDown}
          role="group"
          tabIndex={0}
          aria-label={t("demarche.map.hint")}
        >
          <defs>
            <pattern id="mm-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className="mm-dot" />
            </pattern>
            <radialGradient id="mm-root" cx="35%" cy="28%" r="85%">
              <stop offset="0%" stopColor="var(--app-primary)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--app-primary)" stopOpacity="0.7" />
            </radialGradient>
            <filter id="mm-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.16" />
            </filter>
          </defs>
          {/* Caméra : tout le contenu est dans ce groupe, dont le `transform` CSS
              anime zoom et déplacement. La trame et le voile débordent largement
              pour qu'un zoom arrière ou un déplacement ne révèle jamais de vide. */}
          <g className="mm-camera" style={{ transform: cameraTransform }}>
            <rect
              x={world.x}
              y={world.y}
              width={world.w}
              height={world.h}
              fill="url(#mm-dots)"
              className="mm-grid"
              aria-hidden
            />
          {spotlightNodes ? (
            <rect
                x={world.x}
                y={world.y}
                width={world.w}
                height={world.h}
                className="mm-spotlight-veil mm-veil-in"
              aria-hidden
              onClick={() => setSpotlight(null)}
            />
          ) : null}

          <g className="mm-edges">
            {layout.edges.map((edge) => {
                const dim = spotlightNodes
                  ? !(spotlightNodes.has(edge.from) && spotlightNodes.has(edge.to))
                  : false;
              const active = selectedId === edge.to || selectedId === edge.from;
                // Le flux ne s'allume qu'APRÈS un choix : sur la vue d'ensemble
                // (racine sélectionnée) les sept arêtes brilleraient ensemble et
                // satureraient la carte. Le mouvement garde ainsi un sens.
                const flowing = active && !dim && selected.kind !== "root";
                const delay = nodeDelays.get(edge.to) ?? 0;
              return (
                  <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={edge.d}
                      pathLength={1}
                  fill="none"
                  stroke={CRITICITY_VAR[edge.criticity]}
                  className={cn("mm-edge", dim && "mm-dim", active && "mm-edge--active")}
                  strokeOpacity={edge.depth === 1 ? 0.6 : 0.42}
                  strokeWidth={edge.depth === 1 ? 2 : 1.5}
                  strokeLinecap="round"
                      style={{ "--mm-delay": `${delay}ms` } as CSSVars}
                />
                    {flowing ? (
                      <path
                        d={edge.d}
                        pathLength={1}
                        className="mm-edge-flow"
                        stroke={CRITICITY_VAR[edge.criticity]}
                        strokeOpacity={0.9}
                      />
                    ) : null}
                  </g>
              );
            })}
          </g>

          <g className="mm-nodes">
            {layout.nodes.map((node) => (
              <NodeShape
                key={node.id}
                node={node}
                  delay={nodeDelays.get(node.id) ?? 0}
                selected={node.id === selectedId}
                dim={spotlightNodes ? !spotlightNodes.has(node.id) : false}
                matched={matches ? matches.has(node.id) : null}
                onActivate={() => {
                  if (draggedRef.current) return;
                  onNodeActivate(node);
                }}
                onSpotlight={() => {
                  if (draggedRef.current) return;
                  if (node.kind === "branch" && node.childCount > 0) toggleSpotlight(node.id);
                }}
                labels={{
                  expand: t("demarche.map.expand", { label: node.label }),
                  collapse: t("demarche.map.collapse", { label: node.label }),
                  children: t("demarche.map.children", { count: node.childCount }),
                  spotlight: t("demarche.map.focus"),
                }}
              />
            ))}
          </g>
          </g>
        </svg>

        {spotlight ? (
          <div className="pointer-events-auto absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-card/95 px-1.5 py-1 text-[11px] shadow-[var(--shadow-border)] backdrop-blur">
            <button
              type="button"
              data-mindmap-exit-focus
              onClick={() => setSpotlight(null)}
              className="rounded-full px-2 py-0.5 font-medium text-muted hover:text-fg"
            >
              {t("demarche.map.overview")}
            </button>
            <span aria-hidden className="text-subtle">
              ›
            </span>
            <span className="truncate px-1 font-semibold text-fg">
              {byId.get(spotlight)?.label ?? ""}
            </span>
          </div>
        ) : null}

        {matches && matches.size === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="rounded-full bg-card/95 px-3 py-1 text-[11px] font-medium text-muted shadow-[var(--shadow-border)]">
              {t("demarche.map.noMatch")}
            </span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-2 text-[10px] font-medium text-subtle">
          <span data-mindmap-node-count>
            {t("demarche.map.nodes", { count: layout.nodes.length })}
          </span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span data-mindmap-zoom-label>{Math.round(zoom * 100)} %</span>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
        data-mindmap-legend
        aria-label={t("demarche.map.legend")}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {t("demarche.map.legend")}
        </span>
        {CRITICITY_ORDER.map((criticity) => (
          <span key={criticity} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: CRITICITY_VAR[criticity] }}
            />
            {t(criticityLabelKey(criticity))}
          </span>
        ))}
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-subtle sm:flex">
          <Focus className="size-3" aria-hidden />
          {t("demarche.map.spotlightHint")}
        </span>
      </div>

      {/* `key` = effet de fondu à CHAQUE changement de sélection : le panneau est
          volontairement remonté pour rejouer l'animation d'entrée. */}
      <div
        key={selected.id}
        className="optimus-card mm-detail-in p-4"
        data-mindmap-detail={selected.id}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <Network className="size-3.5" aria-hidden />
            {selected.kind === "root" ? t("demarche.map.root") : t("demarche.map.branch")}
          </p>
          {selected.kind !== "root" ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: CRITICITY_VAR[selected.criticity],
                background: `color-mix(in oklab, ${CRITICITY_VAR[selected.criticity]} 14%, transparent)`,
              }}
            >
              {t(criticityLabelKey(selected.criticity))}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-display text-base font-medium">{selected.label}</p>
        {selected.detail ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{selected.detail}</p>
        ) : null}
        {selected.leaves.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {selected.leaves.map((leaf, index) => (
              <li key={index} className="flex gap-2 text-[12px] leading-snug text-muted">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {leaf}
              </li>
            ))}
          </ul>
        ) : null}
        {selected.kind === "branch" && selected.childCount > 0 ? (
          <button
            type="button"
            data-mindmap-focus={selected.id}
            onClick={() => toggleSpotlight(selected.id)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted hover:text-fg"
          >
            <Focus className="size-3.5" aria-hidden />
            {spotlight === selected.id ? t("demarche.map.exitFocus") : t("demarche.map.focus")}
          </button>
        ) : null}
      </div>
    </div>
  );

  const panel = (
    <div
      id={viewPanelId("mindmap")}
      role="tabpanel"
      aria-labelledby="vue-tab-mindmap"
      data-demarche-panel="mindmap"
      className="space-y-3"
    >
      {mapBody}
    </div>
  );

  if (!full) return panel;

  if (typeof document === "undefined") return panel;
  return createPortal(
    <div
      data-mindmap-fullscreen-overlay
      className="fixed inset-0 z-[120] flex flex-col gap-3 overflow-hidden bg-bg p-3 sm:p-4"
    >
      {mapBody}
    </div>,
    document.body,
  );
}

function ToolButton({
  children,
  label,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...rest}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center gap-1 rounded-[var(--radius-sm)] bg-card px-2 text-[11px] font-medium text-muted shadow-[var(--shadow-border)] transition-colors hover:text-fg disabled:opacity-40",
        active && "text-accent",
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      {...rest}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-muted hover:bg-secondary hover:text-fg"
    >
      {icon}
      {label}
    </button>
  );
}

function NodeShape({
  node,
  delay,
  selected,
  dim,
  matched,
  onActivate,
  onSpotlight,
  labels,
}: {
  node: MapNode;
  /** Délai d'entrée de la vague (ms), posé en variable CSS `--mm-delay`. */
  delay: number;
  selected: boolean;
  dim: boolean;
  matched: boolean | null;
  onActivate: () => void;
  onSpotlight: () => void;
  labels: { expand: string; collapse: string; children: string; spotlight: string };
}) {
  const spec =
    node.kind === "root"
      ? MINDMAP_NODE_METRICS.ROOT
      : node.kind === "branch"
        ? MINDMAP_NODE_METRICS.BRANCH
        : MINDMAP_NODE_METRICS.CHILD;
  const lineHeight = spec.font * MINDMAP_NODE_METRICS.LINE_HEIGHT;
  const leafHeight = MINDMAP_NODE_METRICS.LEAF_FONT * MINDMAP_NODE_METRICS.LEAF_HEIGHT;
  const titleLines = wrapLabel(node.label, spec.font, spec.maxWidth);
  const leafLines = node.leaves
    .slice(0, 2)
    .map((leaf) => (leaf.length > 26 ? leaf.slice(0, 25) + "…" : leaf));
  const totalHeight = titleLines.length * lineHeight + leafLines.length * leafHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;

  const isRoot = node.kind === "root";
  const accent = CRITICITY_VAR[node.criticity];
  const clickable = node.kind === "branch" && node.childCount > 0;
  const label = clickable ? (node.expanded ? labels.collapse : labels.expand) : node.label;
  const inner = node.x < 0 ? 1 : -1;

  return (
    <>
    <g
        className={cn(
          "mm-node",
          dim && "mm-dim",
          matched === true && "mm-match",
          matched === false && "mm-search-dim",
        )}
      style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
      data-mindmap-node={node.id}
      data-mindmap-kind={node.kind}
      data-mindmap-criticity={node.criticity}
      data-mindmap-expanded={node.expanded ? "true" : "false"}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={label}
      aria-describedby={`${node.id}-children`}
      aria-pressed={clickable ? node.expanded : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSpotlight();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    >
        <title>
          {node.label}
          {clickable ? ` — ${labels.spotlight}` : ""}
        </title>
        {/* Le contenu vit dans ce groupe animé : l'entrée (scale + fondu) est
          déclenchée à CHAQUE montage, et le survol y applique son propre scale.
          Le groupe parent, lui, porte la translation (jamais animée ici). */}
        <g className="mm-node-inner" style={{ "--mm-delay": `${delay}ms` } as CSSVars}>
          {node.criticity === "critique" ? (
            <rect
              className="mm-halo"
              x={-node.w / 2 - 5}
              y={-node.h / 2 - 5}
              width={node.w + 10}
              height={node.h + 10}
              rx={13}
              style={{ "--mm-delay": `${delay}ms` } as CSSVars}
            />
          ) : null}
          {selected ? (
            <rect
              className="mm-ping"
              x={-node.w / 2 - 5}
              y={-node.h / 2 - 5}
              width={node.w + 10}
              height={node.h + 10}
              rx={15}
              stroke="var(--app-accent)"
              strokeWidth={2}
            />
          ) : null}
      {selected ? (
        <rect
          className="mm-ring"
          x={-node.w / 2 - 5}
          y={-node.h / 2 - 5}
          width={node.w + 10}
          height={node.h + 10}
          rx={15}
          fill="none"
          stroke="var(--app-accent)"
          strokeWidth={2}
        />
      ) : null}
      <rect
        className="mm-node-card"
        x={-node.w / 2}
        y={-node.h / 2}
        width={node.w}
        height={node.h}
        rx={isRoot ? 14 : 11}
        fill={isRoot ? "url(#mm-root)" : `color-mix(in oklab, ${accent} 13%, var(--app-card))`}
        stroke={isRoot ? "var(--app-accent)" : accent}
        strokeOpacity={isRoot ? 0.9 : 0.6}
        strokeWidth={isRoot ? 1.6 : 1.2}
        filter={isRoot ? "url(#mm-shadow)" : undefined}
      />
      {!isRoot ? (
        <rect
          className="mm-spine"
          x={inner > 0 ? -node.w / 2 + 1.5 : node.w / 2 - 5}
          y={-node.h / 2 + 6}
          width={3.5}
          height={Math.max(6, node.h - 12)}
          rx={1.75}
          fill={accent}
        />
      ) : null}
      <text
        textAnchor="middle"
        dominantBaseline="central"
            style={{
              fontSize: spec.font,
              fontWeight: isRoot ? 600 : 500,
              fill: isRoot ? "var(--app-primary-fg)" : "var(--app-fg)",
            }}
      >
        {titleLines.map((line, index) => (
          <tspan key={index} x={0} y={startY + index * lineHeight}>
            {line}
          </tspan>
        ))}
        {leafLines.map((line, index) => (
          <tspan
            key={`leaf-${index}`}
            x={0}
            y={startY + titleLines.length * lineHeight + index * leafHeight}
            style={{ fontSize: MINDMAP_NODE_METRICS.LEAF_FONT, fill: "var(--app-muted)" }}
          >
            {line}
          </tspan>
        ))}
      </text>
      {clickable ? (
        <>
          <circle
            className="mm-badge"
            cx={node.w / 2 - 7}
            cy={-node.h / 2 + 7}
            r={8.5}
            fill={node.expanded ? accent : "var(--app-card)"}
            stroke={accent}
            strokeWidth={1.2}
          />
          <text
            x={node.w / 2 - 7}
            y={-node.h / 2 + 7}
            textAnchor="middle"
            dominantBaseline="central"
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  fill: node.expanded ? "var(--app-primary-fg)" : accent,
                }}
          >
            {node.expanded ? "−" : node.childCount}
          </text>
        </>
      ) : null}
        </g>
      </g>
      {/* Description hors du groupe du nœud : `sr-only` (position absolue,
          découpe) fausse `getBBox()`/`getBoundingClientRect()` du <g>, ce qui
          décalait tout test de survol/pointage visant le centre du nœud. Le lien
          `aria-describedby` reste valide (résolution par identifiant). */}
      <text id={`${node.id}-children`} className="sr-only">
        {labels.children}
      </text>
    </>
  );
}
