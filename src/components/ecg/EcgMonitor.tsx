import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEcgBeep } from "@/lib/ecg/useEcgBeep";
import type { SoundType } from "@/lib/ecg/sounds";
import type { EcgDeformation } from "@/lib/ecg/deformation";
import { cyclePathMm } from "@/lib/ecg/waveform";
import {
  ECG_GAIN_REDUCED,
  ECG_GAIN_STEPS,
  ECG_NORMS,
  ECG_SWEEP_SECONDS,
  type EcgGain,
} from "@/core/ecg";

/* ═══════════════════════════════════════════════════════════════════════
   Moniteur ECG 12 dérivations — « viewBox natif » en millimètres
   ───────────────────────────────────────────────────────────────────────
   1 unité de viewBox = 1 mm de papier : 25 mm/s en abscisse, N mm/mV en
   ordonnée (N = gain courant). La grille est donc un vrai quadrillage
   1 mm / 5 mm.

   Un SEUL cycle cardiaque est généré par dérivation, puis répété via des
   `<use>` décalés d'une largeur de cycle (périodicité du rythme) ; le
   défilement n'est qu'un `translate` de groupe, appliqué hors React
   (aucun re-render par frame). Les dérivations frontales sont dérivées de
   DI et DII par la loi d'Einthoven (cf. waveform.ts).

   Convention QA : attributs `data-ecg-*` sur le DOM (cf. README.md).
   ═══════════════════════════════════════════════════════════════════════ */

const MM_PER_SEC = ECG_NORMS.paperSpeedMmPerSec; // 25 mm/s
const SWEEP = ECG_SWEEP_SECONDS; // 4 s visibles
const TRACE_MM = SWEEP * MM_PER_SEC; // 100 mm de tracé par colonne

const LEFT_LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "PLETH"] as const;
const RIGHT_LEADS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
const ALL_LEADS: readonly string[] = [...LEFT_LEADS, ...RIGHT_LEADS];

// Mise en page « papier » (mm).
const PAD_X = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 4;
const LABEL_MM = 11;
const COL_W = LABEL_MM + TRACE_MM;
const COL_GAP = 6;
const PANEL_W = 54;
const INNER_H = 126;
const VIEW_W = PAD_X * 2 + COL_W * 2 + COL_GAP * 2 + PANEL_W; // 296 mm
const VIEW_H = PAD_TOP + INNER_H + PAD_BOTTOM; // 140 mm
const COL_L = PAD_X;
const TRACE_L = COL_L + LABEL_MM;
const COL_R = PAD_X + COL_W + COL_GAP;
const TRACE_R = COL_R + LABEL_MM;
const PANEL_X = COL_R + COL_W + COL_GAP;
const ROW_L = INNER_H / LEFT_LEADS.length;
const ROW_R = INNER_H / RIGHT_LEADS.length;

const C_ECG = "#00ff6a";
const C_PLETH = "#00e5ff";
const C_ALERT = "#ff3355";
const MONO = "ui-monospace,monospace";

/** Durée d'un cycle (bornes identiques à waveform.ts). */
function cycleSeconds(bpm: number) {
  return 60 / Math.max(20, Math.min(240, bpm));
}

export function EcgMonitor({
  bpm = 75,
  soundType = "bip_normal",
  deformation,
  autoStart = true,
}: {
  bpm?: number;
  soundType?: SoundType;
  deformation?: EcgDeformation;
  autoStart?: boolean;
}) {
  const [playing, setPlaying] = useState(autoStart);
  const [sound, setSound] = useState(false);
  const [full, setFull] = useState(false);
  const [gainManual, setGainManual] = useState<EcgGain | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });

  // Groupes défilants : transform mis à jour hors React (perf).
  const leftScrollRef = useRef<SVGGElement | null>(null);
  const rightScrollRef = useRef<SVGGElement | null>(null);

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cid = (lead: string) => `ecgcyc${uid}${lead.replace(/[^a-zA-Z0-9]/g, "")}`;
  const clipL = `ecgclipL${uid}`;
  const clipR = `ecgclipR${uid}`;
  const gridMin = `ecggmin${uid}`;
  const gridMaj = `ecggmaj${uid}`;

  /*
   * Gain : automatique (5 mm/mV sur MOBILE EN PAYSAGE, où les lignes sont
   * courtes) sauf si l'utilisateur a choisi un palier à la main.
   * Plancher volontaire à 5 mm/mV — jamais 2,5 (cf. README).
   */
  const autoReduced = viewport.w < 900 && viewport.w >= viewport.h;
  const gain: EcgGain = gainManual ?? (autoReduced ? ECG_GAIN_REDUCED : 10);
  const reduced = gain < 10;

  // Un cycle par dérivation (mémoïsé) — jamais recalculé pendant le scroll.
  const cycles = useMemo(() => {
    const out: Record<string, { d: string; cycleSec: number; widthMm: number }> = {};
    for (const lead of ALL_LEADS) {
      out[lead] = cyclePathMm(lead, {
        bpm,
        def: deformation,
        gainMmPerMv: gain,
        mmPerSec: MM_PER_SEC,
      });
    }
    return out;
  }, [bpm, deformation, gain]);

  const cycleSec = cycleSeconds(bpm);

  // Défilement : on ne touche QUE le transform des deux colonnes (aucun re-render).
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const phase = (((now - start) / 1000) % cycleSec) * MM_PER_SEC;
      const tf = `translate(${(-phase).toFixed(3)},0)`;
      leftScrollRef.current?.setAttribute("transform", tf);
      rightScrollRef.current?.setAttribute("transform", tf);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, cycleSec]);

  useEcgBeep({ enabled: sound && playing, bpm, soundType });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [full]);

  const leadNode = (lead: string, x: number, yMid: number) => {
    const c = cycles[lead];
    const copies = Math.ceil(TRACE_MM / c.widthMm) + 2;
    const isPleth = lead === "PLETH";
    return (
      <g
        key={lead}
        transform={`translate(${x},${yMid.toFixed(2)})`}
        data-ecg-lead={lead}
        data-ecg-baseline={yMid.toFixed(2)}
        data-ecg-cycle-mm={c.widthMm.toFixed(2)}
      >
        {Array.from({ length: copies }, (_, k) => (
          <use
            key={k}
            href={`#${cid(lead)}`}
            x={(k * c.widthMm).toFixed(2)}
            data-ecg-cycle={k}
            fill="none"
            stroke={isPleth ? C_PLETH : C_ECG}
            strokeWidth={0.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>
    );
  };

  return (
    <div
      data-ecg-monitor=""
      data-ecg-bpm={bpm}
      data-ecg-gain={gain}
      data-ecg-reduced={reduced ? "true" : "false"}
      data-ecg-leads={ALL_LEADS.join(" ")}
      className={
        "overflow-hidden bg-black ring-1 ring-black/60 shadow-[var(--shadow-md)] " +
        (full ? "fixed inset-0 z-50 rounded-none" : "relative rounded-[var(--radius-xl)]")
      }
    >
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          MONITOR<span className="hidden sm:inline"> · 12 DÉRIVATIONS</span>
        </span>
        <span
          data-ecg-gain-label=""
          className={reduced ? "font-semibold text-amber-400" : "hidden text-white/30 sm:inline"}
        >
          25 mm/s · {gain} mm/mV
        </span>
        {reduced ? (
          <span
            data-ecg-gain-badge=""
            className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/40"
          >
            Gain réduit
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <span className="flex items-center rounded-full bg-white/5 p-0.5" data-ecg-gain-toggle="">
            {ECG_GAIN_STEPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGainManual(g)}
                aria-pressed={gain === g}
                aria-label={`Gain ${g} mm/mV`}
                data-ecg-set-gain={g}
                className={
                  "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors " +
                  (gain === g ? "bg-emerald-400/25 text-emerald-200" : "text-white/45 hover:bg-white/10")
                }
              >
                <span className="hidden sm:inline">Gain </span>
                {g}
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? "Pause" : "Lecture"}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
          >
            {playing ? "❙❙" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => setSound((v) => !v)}
            aria-label={sound ? "Couper le son" : "Activer le son"}
            className={
              "rounded-full px-2 py-0.5 text-[10px] " +
              (sound ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/40")
            }
          >
            {sound ? "🔊" : "🔈"}
          </button>
          <button
            type="button"
            onClick={() => setFull((v) => !v)}
            aria-label={full ? "Quitter le plein écran" : "Plein écran"}
            data-ecg-fullscreen=""
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
          >
            {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </span>
      </div>

      {full ? (
        <div className="pointer-events-none absolute bottom-2 right-3 z-10 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/60">
          📱 Tourne en paysage
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={full ? "block h-[calc(100vh-32px)] w-full" : "block w-full"}
        style={full ? undefined : { aspectRatio: `${VIEW_W}/${VIEW_H}` }}
        preserveAspectRatio="xMidYMid meet"
        data-ecg-svg=""
        data-ecg-viewbox={`0 0 ${VIEW_W} ${VIEW_H}`}
        data-ecg-sweep={SWEEP}
        data-ecg-mm-per-sec={MM_PER_SEC}
        data-ecg-mm-per-mv={gain}
        aria-label={`Moniteur ECG 12 dérivations à ${bpm} bpm — gain ${gain} mm/mV`}
        role="img"
      >
        <defs>
          <pattern id={gridMin} width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(0,255,100,0.07)" strokeWidth="0.09" />
          </pattern>
          <pattern id={gridMaj} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill={`url(#${gridMin})`} />
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(0,255,100,0.15)" strokeWidth="0.16" />
          </pattern>
          <clipPath id={clipL}>
            <rect x={TRACE_L} y={PAD_TOP} width={TRACE_MM} height={INNER_H} />
          </clipPath>
          <clipPath id={clipR}>
            <rect x={TRACE_R} y={PAD_TOP} width={TRACE_MM} height={INNER_H} />
          </clipPath>
          {/* Un seul cycle par dérivation — répété par <use> ensuite. */}
          {ALL_LEADS.map((lead) => (
            <path key={lead} id={cid(lead)} d={cycles[lead].d} fill="none" />
          ))}
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gridMaj})`} data-ecg-grid="" />
        <line
          x1={COL_R - COL_GAP / 2}
          y1={PAD_TOP}
          x2={COL_R - COL_GAP / 2}
          y2={VIEW_H - PAD_BOTTOM}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.12"
        />

        {/* Colonne gauche — cycles répétés, défilement par translate. */}
        <g clipPath={`url(#${clipL})`}>
          <g ref={leftScrollRef} data-ecg-scroll="left">
            {LEFT_LEADS.map((lead, i) => leadNode(lead, TRACE_L, PAD_TOP + ROW_L * (i + 0.5)))}
          </g>
        </g>
        {/* Colonne droite */}
        <g clipPath={`url(#${clipR})`}>
          <g ref={rightScrollRef} data-ecg-scroll="right">
            {RIGHT_LEADS.map((lead, i) => leadNode(lead, TRACE_R, PAD_TOP + ROW_R * (i + 0.5)))}
          </g>
        </g>

        {/* Lignes de base + libellés (statiques, non clippés). */}
        {LEFT_LEADS.map((lead, i) => {
          const yMid = PAD_TOP + ROW_L * (i + 0.5);
          return (
            <g key={lead}>
              <line x1={TRACE_L} y1={yMid} x2={TRACE_L + TRACE_MM} y2={yMid} stroke="rgba(0,255,100,0.05)" strokeWidth="0.06" />
              <text x={COL_L} y={yMid + 1.2} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={lead === "PLETH" ? C_PLETH : C_ECG}>
                {lead}
              </text>
            </g>
          );
        })}
        {RIGHT_LEADS.map((lead, i) => {
          const yMid = PAD_TOP + ROW_R * (i + 0.5);
          return (
            <g key={lead}>
              <line x1={TRACE_R} y1={yMid} x2={TRACE_R + TRACE_MM} y2={yMid} stroke="rgba(0,255,100,0.05)" strokeWidth="0.06" />
              <text x={COL_R} y={yMid + 1.2} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={C_ECG}>
                {lead}
              </text>
            </g>
          );
        })}

        {/* Curseur de balayage (bord droit du tracé). */}
        <line x1={TRACE_L + TRACE_MM} y1={PAD_TOP} x2={TRACE_L + TRACE_MM} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(0,255,106,0.45)" strokeWidth="0.35" data-ecg-cursor="left" />
        <line x1={TRACE_R + TRACE_MM} y1={PAD_TOP} x2={TRACE_R + TRACE_MM} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(0,255,106,0.45)" strokeWidth="0.35" data-ecg-cursor="right" />

        {/* Panneau de constantes. */}
        <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP} x2={PANEL_X - COL_GAP / 2} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
        <text x={PANEL_X} y={PAD_TOP + 5} fontSize="3.6" fontFamily={MONO} fontWeight="700" fill={C_ECG}>ECG</text>
        <text x={VIEW_W - PAD_X} y={PAD_TOP + 5.4} fontSize="4.4" fontFamily={MONO} fill={C_ALERT} textAnchor="end">♥</text>
        <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 8} x2={VIEW_W - PAD_X} y2={PAD_TOP + 8} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
        <text x={PANEL_X} y={PAD_TOP + 26} fontSize="15" fontFamily={MONO} fontWeight="700" fill={C_ECG}>{bpm}</text>
        <text x={PANEL_X + 23} y={PAD_TOP + 26} fontSize="3.4" fontFamily={MONO} fill="rgba(0,255,106,0.5)">bpm</text>
        <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 32} x2={VIEW_W - PAD_X} y2={PAD_TOP + 32} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
        <text x={PANEL_X} y={PAD_TOP + 40} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill="#ffffff">NIBP</text>
        <text x={PANEL_X} y={PAD_TOP + 52} fontSize="9" fontFamily={MONO} fontWeight="700" fill="#ffffff">117</text>
        <text x={PANEL_X + 17} y={PAD_TOP + 52} fontSize="6.5" fontFamily={MONO} fontWeight="700" fill="#ffffff">81</text>
        <text x={PANEL_X} y={PAD_TOP + 58} fontSize="2.6" fontFamily={MONO} fill="rgba(255,255,255,0.35)">mmHg</text>
        <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 62} x2={VIEW_W - PAD_X} y2={PAD_TOP + 62} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
        <text x={PANEL_X} y={PAD_TOP + 70} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>SpO₂</text>
        <text x={PANEL_X} y={PAD_TOP + 86} fontSize="12" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>97</text>
        <text x={PANEL_X + 25} y={PAD_TOP + 86} fontSize="4" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>%</text>
        <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 92} x2={VIEW_W - PAD_X} y2={PAD_TOP + 92} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
        <text x={PANEL_X} y={PAD_TOP + 100} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill="#ffffff">TEMP</text>
        <text x={PANEL_X} y={PAD_TOP + 114} fontSize="9" fontFamily={MONO} fontWeight="700" fill="#ffffff">37.0</text>
        <text x={PANEL_X + 22} y={PAD_TOP + 114} fontSize="3" fontFamily={MONO} fill="rgba(255,255,255,0.4)">°C</text>
      </svg>
    </div>
  );
}
