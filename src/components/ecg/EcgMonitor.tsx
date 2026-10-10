import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEcgBeep } from "@/lib/ecg/useEcgBeep";
import type { SoundType } from "@/lib/ecg/sounds";

/* ═══════════════════════════════════════════════════════════════════
   EcgMonitor — Moniteur 12 dérivations + plein écran
   Layout : 2 colonnes de traces + panneau chiffres à droite
   ═══════════════════════════════════════════════════════════════════ */

const PX = 20;
const SWEEP = 4;

type Pt = { t: number; v: number };

function gauss(t: number, mu: number, a: number, s: number) {
  const d = t - mu;
  return a * Math.exp(-(d * d) / (2 * s * s));
}

/* Waveform par dérivation : II, III, aVR, aVL, aVF, V1-V6 */
type WaveSpec = { P: number; Q: number; R: number; S: number; T: number };

const WAVES: Record<string, WaveSpec> = {
  II:   { P:  0.15, Q: -0.10, R:  1.20, S: -0.30, T:  0.30 },
  III:  { P:  0.10, Q: -0.08, R:  0.70, S: -0.20, T:  0.20 },
  aVR:  { P: -0.15, Q:  0.05, R: -1.00, S:  0.20, T: -0.25 },
  aVL:  { P:  0.08, Q: -0.05, R:  0.60, S: -0.15, T:  0.15 },
  aVF:  { P:  0.12, Q: -0.08, R:  0.85, S: -0.20, T:  0.22 },
  V1:   { P:  0.08, Q: -0.05, R:  0.35, S: -0.80, T: -0.15 },
  V2:   { P:  0.10, Q: -0.05, R:  0.55, S: -0.95, T:  0.05 },
  V3:   { P:  0.12, Q: -0.08, R:  0.80, S: -0.60, T:  0.20 },
  V4:   { P:  0.14, Q: -0.10, R:  1.10, S: -0.40, T:  0.28 },
  V5:   { P:  0.15, Q: -0.10, R:  1.25, S: -0.25, T:  0.32 },
  V6:   { P:  0.15, Q: -0.10, R:  1.10, S: -0.20, T:  0.30 },
};

function buildWave(bpm: number, seconds: number, w: WaveSpec): Pt[] {
  const cy = 60 / bpm;
  const n = Math.round(seconds * 400);
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / 400;
    const ph = t % cy;
    let v = 0;
    v += gauss(ph, 0.16, w.P, 0.025);
    v += gauss(ph, 0.26, w.Q, 0.008);
    v += gauss(ph, 0.28, w.R, 0.010);
    v += gauss(ph, 0.30, w.S, 0.010);
    v += gauss(ph, 0.47, w.T, 0.040);
    out.push({ t, v });
  }
  return out;
}

function buildPleth(bpm: number, seconds: number): Pt[] {
  const cy = 60 / bpm;
  const n = Math.round(seconds * 200);
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / 200;
    const ph = t % cy;
    let v = 0;
    v += gauss(ph, 0.18, 1.0, 0.045);
    v += gauss(ph, 0.36, 0.30, 0.055);
    out.push({ t, v });
  }
  return out;
}

function pathFor(pts: Pt[], win: number, start: number, yMid: number, amp: number, wIn: number): string {
  let d = "";
  let started = false;
  for (const p of pts) {
    if (p.t < start || p.t > start + win) continue;
    const x = PX + ((p.t - start) / win) * wIn;
    const y = yMid - p.v * amp;
    d += (started ? "L " : "M ") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    started = true;
  }
  return d.trim();
}

export function EcgMonitor({
  bpm = 75,
  soundType = "bip_normal",
  autoStart = true,
}: {
  bpm?: number;
  soundType?: SoundType;
  autoStart?: boolean;
}) {
  const secs = 60;
  const waves = useMemo(() => {
    const obj: Record<string, Pt[]> = {};
    for (const k of Object.keys(WAVES)) obj[k] = buildWave(bpm, secs, WAVES[k]);
    obj.PLETH = buildPleth(bpm, secs);
    return obj;
  }, [bpm]);

  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(autoStart);
  const [sound, setSound] = useState(false);
  const [full, setFull] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now() - cursor * 1000;
    const tick = (now: number) => {
      const t = ((now - (startRef.current ?? now)) / 1000) % secs;
      setCursor(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, secs]);

  useEcgBeep({ enabled: sound && playing, bpm, soundType });

  useEffect(() => {
    const onFsChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
      } catch {
        /* ignore */
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }

  const winStart = Math.max(0, Math.min(cursor - SWEEP * 0.85, secs - SWEEP));
  const sweepT = (cursor - winStart) / SWEEP;

  // Layout : largeur totale 1600, hauteur 460 en normal, auto en full
  const W = 1600;
  const H = full ? 900 : 460;
  const COL_GAP = 20;
  const PANEL_W = 260;
  const colW = (W - PANEL_W - COL_GAP * 2) / 2;
  const colL = PX;
  const colR = PX + colW + COL_GAP;
  const panelX = PX + colW * 2 + COL_GAP * 2;
  const top = 42;
  const bottom = 16;
  const innerH = H - top - bottom;

  // Colonne gauche : II, aVR, III, PLETH (4 traces)
  const leftTraces = ["II", "aVR", "III", "PLETH"];
  // Colonne droite : V1-V6 (6 traces)
  const rightTraces = ["V1", "V2", "V3", "V4", "V5", "V6"];
  const rowL = innerH / leftTraces.length;
  const rowR = innerH / rightTraces.length;
  const ampL = rowL * 0.40;
  const ampR = rowR * 0.40;

  return (
    <div
      ref={containerRef}
      className={
        "overflow-hidden bg-black ring-1 ring-black/60 shadow-[var(--shadow-md)] " +
        (full ? "rounded-none" : "rounded-[var(--radius-xl)]")
      }
    >
      {/* Barre statut */}
      <div className="flex items-center gap-3 border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          MONITOR · 12 DÉRIVATIONS
        </span>
        <span className="hidden sm:inline text-white/30">25 mm/s · 10 mm/mV</span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
          >
            {playing ? "❙❙" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => setSound((v) => !v)}
            aria-label={sound ? "Couper le son" : "Activer le son"}
            className={
              "rounded-full px-2 py-0.5 text-[10px] transition-colors " +
              (sound ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/40")
            }
          >
            {sound ? "🔊" : "🔈"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={full ? "Quitter le plein écran" : "Plein écran"}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
          >
            {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        style={{ aspectRatio: `${W}/${H}`, maxHeight: full ? "calc(100vh - 40px)" : undefined }}
        aria-label={`Moniteur ECG 12 dérivations à ${bpm} bpm`}
      >
        <defs>
          <pattern id="ecg-min" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,255,100,0.06)" strokeWidth="0.4" />
          </pattern>
          <pattern id="ecg-maj" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="url(#ecg-min)" />
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,255,100,0.14)" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#ecg-maj)" />

        {/* Séparateur des 2 colonnes */}
        <line x1={colR - COL_GAP / 2} y1={top} x2={colR - COL_GAP / 2} y2={H - bottom} stroke="rgba(255,255,255,0.06)" />

        {/* Colonne gauche */}
        {leftTraces.map((name, i) => {
          const yMid = top + rowL * (i + 0.5);
          const isPleth = name === "PLETH";
          return (
            <g key={name}>
              <line x1={colL + 24} y1={yMid} x2={colL + colW} y2={yMid} stroke={isPleth ? "rgba(0,220,255,0.15)" : "rgba(0,255,100,0.12)"} strokeWidth="0.5" />
              <text x={colL} y={yMid + 4} fontSize="11" fontFamily="ui-monospace,monospace" fill={isPleth ? "#00e5ff" : "#00ff6a"} fontWeight="700">
                {name}
              </text>
              <path
                d={pathFor(waves[name], SWEEP, winStart, yMid, ampL, colW - 24)}
                fill="none"
                stroke={isPleth ? "#00e5ff" : "#00ff6a"}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${isPleth ? "rgba(0,229,255,0.6)" : "rgba(0,255,106,0.6)"})` }}
              />
            </g>
          );
        })}

        {/* Colonne droite */}
        {rightTraces.map((name, i) => {
          const yMid = top + rowR * (i + 0.5);
          return (
            <g key={name}>
              <line x1={colR + 24} y1={yMid} x2={colR + colW} y2={yMid} stroke="rgba(0,255,100,0.12)" strokeWidth="0.5" />
              <text x={colR} y={yMid + 4} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">
                {name}
              </text>
              <path
                d={pathFor(waves[name], SWEEP, winStart, yMid, ampR, colW - 24)}
                fill="none"
                stroke="#00ff6a"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 4px rgba(0,255,106,0.5))" }}
              />
            </g>
          );
        })}

        {/* Sweep line (2 colonnes) */}
        {playing ? (
          <>
            <line x1={colL + 24 + sweepT * (colW - 24)} y1={top} x2={colL + 24 + sweepT * (colW - 24)} y2={H - bottom} stroke="rgba(0,255,106,0.28)" strokeWidth="1" />
            <line x1={colR + 24 + sweepT * (colW - 24)} y1={top} x2={colR + 24 + sweepT * (colW - 24)} y2={H - bottom} stroke="rgba(0,255,106,0.28)" strokeWidth="1" />
          </>
        ) : null}

        {/* Panneau chiffres */}
        <line x1={panelX - COL_GAP / 2} y1={top} x2={panelX - COL_GAP / 2} y2={H - bottom} stroke="rgba(255,255,255,0.08)" />
        <text x={panelX} y={top + 18} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">ECG</text>
        <text x={W - PX} y={top + 18} fontSize="11" fontFamily="ui-monospace,monospace" fill="#ff3355" textAnchor="end">♥</text>
        <text x={panelX} y={top + 78} fontSize="52" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">{bpm}</text>
        <text x={panelX + 70} y={top + 78} fontSize="11" fontFamily="ui-monospace,monospace" fill="rgba(0,255,106,0.5)">bpm</text>

        <line x1={panelX - COL_GAP / 2} y1={top + 100} x2={W - PX} y2={top + 100} stroke="rgba(255,255,255,0.08)" />
        <text x={panelX} y={top + 120} fontSize="11" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">NIBP</text>
        <text x={panelX} y={top + 168} fontSize="32" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">117</text>
        <text x={panelX + 65} y={top + 168} fontSize="22" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">81</text>
        <text x={panelX} y={top + 188} fontSize="9" fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)">mmHg</text>

        <line x1={panelX - COL_GAP / 2} y1={top + 210} x2={W - PX} y2={top + 210} stroke="rgba(255,255,255,0.08)" />
        <text x={panelX} y={top + 230} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">SpO₂</text>
        <text x={panelX} y={top + 288} fontSize="48" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">97</text>
        <text x={panelX + 70} y={top + 288} fontSize="14" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">%</text>

        <line x1={panelX - COL_GAP / 2} y1={top + 310} x2={W - PX} y2={top + 310} stroke="rgba(255,255,255,0.08)" />
        <text x={panelX} y={top + 330} fontSize="11" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">TEMP</text>
        <text x={panelX} y={top + 380} fontSize="36" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">37.0</text>
        <text x={panelX + 80} y={top + 380} fontSize="12" fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.4)">°C</text>
      </svg>
    </div>
  );
}
