import { useEffect, useId, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   ECG Cinéma — simulateur d'ECG animé temps réel
   ───────────────────────────────────────────────────────────────────
   Simule un tracé ECG synthétique (onde P, QRS, onde T) et l'anime
   comme un moniteur d'oscilloscope. Chaque onde est un segment
   animable indépendamment avec reveal progressif.
   ═══════════════════════════════════════════════════════════════════ */

const SVG_W = 1200;
const SVG_H = 320;
const PADDING_X = 40;
const PADDING_Y = 20;

type EcgPoint = { x: number; y: number };
type Label = { t: number; text: string; y: number };

/** Simule un ECG synthétique (P, QRS, T) sur `cycles` cycles. */
function generateEcg(bpm: number, cycles: number) {
  const cycleSec = 60 / bpm;
  const totalSec = cycleSec * cycles;
  const samplesPerSec = 500;
  const points: EcgPoint[] = [];

  const baseline = 0;
  const ampP = 0.12;
  const ampQ = -0.15;
  const ampR = 1.0;
  const ampS = -0.25;
  const ampT = 0.28;

  const gauss = (t: number, mu: number, sigma: number, amp: number) =>
    amp * Math.exp(-((t - mu) ** 2) / (2 * sigma * sigma));

  for (let t = 0; t <= totalSec; t += 1 / samplesPerSec) {
    const phase = t % cycleSec;
    let v = baseline;

    // Onde P (0.10 - 0.22 s)
    v += gauss(phase, 0.16, 0.025, ampP);

    // Complexe QRS (0.24 - 0.32 s)
    v += gauss(phase, 0.26, 0.008, ampQ);
    v += gauss(phase, 0.28, 0.010, ampR);
    v += gauss(phase, 0.30, 0.010, ampS);

    // Onde T (0.40 - 0.55 s)
    v += gauss(phase, 0.47, 0.040, ampT);

    const x = PADDING_X + (t / totalSec) * (SVG_W - 2 * PADDING_X);
    const y = SVG_H / 2 - v * ((SVG_H - 2 * PADDING_Y) / 2);
    points.push({ x, y });
  }
  return { points, cycleSec, totalSec };
}

function pointsToPath(points: EcgPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)},${first.y.toFixed(1)} ` +
    rest.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function EcgCinema({
  bpm = 75,
  cycles = 6,
  autoPlay = true,
}: {
  bpm?: number;
  cycles?: number;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0); // 0 → 1
  const [speed, setSpeed] = useState(1);
  // `useId` est stable entre serveur et client ; on le nettoie des `:` pour en
  // faire des identifiants SVG utilisables dans `url(#…)`.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const { points, cycleSec, totalSec } = useMemo(
    () => generateEcg(bpm, cycles),
    [bpm, cycles],
  );
  const path = useMemo(() => pointsToPath(points), [points]);

  /**
   * Longueur du tracé, calculée géométriquement (somme des segments) plutôt que
   * mesurée par `getTotalLength()` après montage :
   *  • identique côté serveur et client — le tracé est donc déjà « bon » au
   *    premier rendu (pas de flash où il serait invisible) ;
   *  • aucune mesure DOM ni état post-hydratation à synchroniser ;
   *  • déterministe : `stroke-dasharray` reste une valeur purement dérivée.
   */
  const pathLen = useMemo(() => {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    // Arrondi au centième de pixel : les derniers bits d'un flottant diffèrent
    // entre le runtime serveur (Node) et le navigateur, ce qui rendrait les
    // attributs SSR et client différents → React signalerait un mismatch
    // d'hydratation. Au centième, les deux valeurs sont identiques.
    return Math.round(total * 100) / 100;
  }, [points]);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - (progress * totalSec * 1000) / speed;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(((t - start) * speed) / (totalSec * 1000), 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, totalSec]);

  const replay = () => {
    setProgress(0);
    setPlaying(true);
  };

  // Labels : apparaissent quand le curseur les dépasse
  const labels: Label[] = useMemo(() => {
    const out: Label[] = [];
    for (let c = 0; c < cycles; c++) {
      const base = c * cycleSec;
      out.push({ t: (base + 0.16) / totalSec, text: "P", y: SVG_H / 2 - 30 });
      out.push({ t: (base + 0.28) / totalSec, text: "QRS", y: SVG_H / 2 - 75 });
      out.push({ t: (base + 0.47) / totalSec, text: "T", y: SVG_H / 2 - 40 });
    }
    return out;
  }, [cycles, cycleSec, totalSec]);

  const cursorX = PADDING_X + progress * (SVG_W - 2 * PADDING_X);
  const liveBpm = Math.round(bpm);

  return (
    <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
      {/* Contrôles — `flex-wrap` : sur mobile les constantes passent à la ligne
          au lieu de déborder horizontalement. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
          type="button"
          onClick={() => {
            // Tracé terminé : relancer depuis le début plutôt que de rester figé.
            if (!playing && progress >= 1) {
              setProgress(0);
              setPlaying(true);
              return;
            }
            setPlaying((v) => !v);
          }}
          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-border)] transition-transform active:scale-95"
          aria-label={playing ? "Pause" : progress >= 1 ? "Relire" : "Lecture"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          onClick={replay}
          className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted transition-colors hover:text-fg"
          aria-label="Rejouer"
        >
          <RotateCcw className="size-4" />
        </button>

        <div className="ml-2 flex items-center gap-1 rounded-full bg-secondary px-2 py-1">
          <Gauge className="size-3 text-subtle" aria-hidden />
          {[1, 2, 4].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSpeed(v)}
              aria-pressed={speed === v}
              aria-label={`Vitesse ×${v}`}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                speed === v ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
              )}
            >
              ×{v}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="flex items-center gap-1 text-red-500">
            ♥ <span className="font-semibold">{liveBpm}</span>
            <span className="text-subtle">bpm</span>
          </span>
          <span className="text-subtle">·</span>
          <span className="text-muted">PR 160ms</span>
          <span className="text-subtle">·</span>
          <span className="text-muted">QRS 90ms</span>
        </div>
      </div>

      {/* Tracé */}
      <div className="overflow-hidden rounded-[var(--radius-md)] bg-[#FDF3F0] p-2 shadow-[inset_0_0_0_1px_rgb(180_40_40_/_0.08)]">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block w-full"
          style={{ height: "auto", aspectRatio: `${SVG_W}/${SVG_H}` }}
          aria-label={`ECG animé à ${liveBpm} bpm`}
        >
          {/* Grille millimétrée */}
          <defs>
            <pattern
              id={`${uid}-minor`}
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F4C4C0" strokeWidth="0.5" />
            </pattern>
            <pattern
              id={`${uid}-major`}
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <rect width="50" height="50" fill={`url(#${uid}-minor)`} />
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#E89A94" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill={`url(#${uid}-major)`} />

          {/* Ligne de base */}
          <line
            x1={PADDING_X}
            y1={SVG_H / 2}
            x2={SVG_W - PADDING_X}
            y2={SVG_H / 2}
            stroke="#E89A94"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />

          {/* Tracé ECG animé */}
          {/*
            Révélation progressive : on anime le décalage du tiret.
            ⚠️ Ces deux valeurs DOIVENT être des attributs de présentation SVG,
            pas des propriétés `style` : en CSS, une longueur sans unité (hors
            `0`) est invalide — le navigateur l'ignorait silencieusement et le
            tracé restait invisible. En attribut, l'unité utilisateur est implicite.
          */}
          <path
            d={path}
            fill="none"
            stroke="#1F1A14"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={Math.round(pathLen * (1 - progress) * 100) / 100}
          />

          {/* Curseur de balayage */}
          {playing && progress > 0 && progress < 1 ? (
            <line
              x1={cursorX}
              y1={PADDING_Y}
              x2={cursorX}
              y2={SVG_H - PADDING_Y}
              stroke="#A67C1E"
              strokeWidth="1.5"
              opacity="0.9"
            />
          ) : null}

          {/* Labels révélés au timing */}
          {labels.map((lbl, i) => (
            <text
              key={i}
              x={PADDING_X + (lbl.t * (SVG_W - 2 * PADDING_X))}
              y={lbl.y}
              fontSize="11"
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              fill="#A67C1E"
              style={{
                opacity: progress >= lbl.t ? 1 : 0,
                transition: "opacity 200ms ease-out",
              }}
              textAnchor="middle"
            >
              {lbl.text}
            </text>
          ))}
        </svg>
      </div>

      <p className="mt-2 text-[11px] text-subtle">
        Prototype — simulateur ECG synthétique (rythme sinusal {liveBpm} bpm).
      </p>
    </div>
  );
}
