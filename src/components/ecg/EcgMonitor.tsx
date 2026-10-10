import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEcgBeep } from "@/lib/ecg/useEcgBeep";
import type { SoundType } from "@/lib/ecg/sounds";
import { baseWave, stOffsetMv, type EcgDeformation } from "@/lib/ecg/deformation";

const PX = 20;
const SWEEP = 4; // secondes visibles
const SAMPLES = 400; // échantillons/s

type Pt = { t: number; v: number };

function gauss(t: number, mu: number, a: number, s: number) {
  const d = t - mu;
  return a * Math.exp(-(d * d) / (2 * s * s));
}

function buildWave(bpm: number, seconds: number, lead: string, def?: EcgDeformation): Pt[] {
  const w = baseWave(lead);
  const cy = 60 / bpm;
  const n = Math.round(seconds * SAMPLES);
  const out: Pt[] = [];
  const sMult = def?.wideQrs ? 2.4 : 1.0;
  const peakT = def?.peakedT ? 2.0 : 1.0;
  const pAmp = def?.pAbsent ? 0 : w.P.a;
  const tInverted = def?.tInverted?.includes(lead) ?? false;
  const tAmp = tInverted ? -Math.abs(w.T.a) * 1.4 : w.T.a;
  const st = stOffsetMv(lead, def);
  const saw = def?.sawTooth ? 1 : 0;
  for (let i = 0; i <= n; i++) {
    const t = i / SAMPLES;
    const ph = t % cy;
    let v = 0;
    v += gauss(ph, 0.16, pAmp, 0.025);
    v += gauss(ph, 0.26, w.Q.a, 0.008 * sMult);
    v += gauss(ph, 0.28, w.R.a, 0.010 * sMult);
    v += gauss(ph, 0.30, w.S.a, 0.010 * sMult);
    if (ph > 0.28 && ph < 0.42 && st !== 0) v += st;
    v += gauss(ph, 0.47, tAmp * peakT, 0.040);
    if (saw) v += 0.15 * Math.sin(ph * 2 * Math.PI * 5);
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
    out.push({ t, v: gauss(ph, 0.18, 1.0, 0.045) + gauss(ph, 0.36, 0.30, 0.055) });
  }
  return out;
}

/* Path "complet" (60s) calculé UNE fois par (bpm, deformation, lead).
   L'animation n'update que `strokeDashoffset` → 60 fps stable. */
function fullPath(pts: Pt[], yMid: number, amp: number, xStart: number, xWidth: number, dur: number): string {
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const x = xStart + (p.t / dur) * xWidth;
    const y = yMid - p.v * amp;
    d += (i === 0 ? "M " : "L ") + x.toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return d.trim();
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
  const secs = 60;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(autoStart);
  const [sound, setSound] = useState(false);
  const [full, setFull] = useState(false);
  const [dims, setDims] = useState({ w: 1600, h: 460 });
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  // Layout
  const W = dims.w;
  const H = dims.h;
  const COL_GAP = 16;
  const PANEL_W = full ? 300 : 240;
  const colW = (W - PANEL_W - COL_GAP * 2 - PX * 2) / 2;
  const colL = PX;
  const colR = PX + colW + COL_GAP;
  const panelX = PX + colW * 2 + COL_GAP * 2;
  const top = 42;
  const bottom = 16;
  const innerH = H - top - bottom;
  const leftTraces = ["II", "aVR", "III", "PLETH"];
  const rightTraces = ["V1", "V2", "V3", "V4", "V5", "V6"];
  const rowL = innerH / leftTraces.length;
  const rowR = innerH / rightTraces.length;
  const ampL = rowL * 0.38;
  const ampR = rowR * 0.38;
  const traceW_L = colW - 28;
  const traceW_R = colW - 28;

  // ═══ PERF : paths calculés UNE fois, animation via strokeDashoffset ═══
  const paths = useMemo(() => {
    const p: Record<string, string> = {};
    for (let i = 0; i < leftTraces.length; i++) {
      const name = leftTraces[i];
      const yMid = top + rowL * (i + 0.5);
      const wave = name === "PLETH" ? buildPleth(bpm, secs) : buildWave(bpm, secs, name, deformation);
      p[`L:${name}`] = fullPath(wave, yMid, ampL, colL + 28, traceW_L, secs);
    }
    for (let i = 0; i < rightTraces.length; i++) {
      const name = rightTraces[i];
      const yMid = top + rowR * (i + 0.5);
      const wave = buildWave(bpm, secs, name, deformation);
      p[`R:${name}`] = fullPath(wave, yMid, ampR, colR + 28, traceW_R, secs);
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, deformation, W, H, full]);

  // Animation
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

  // Responsive dims
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (full) {
        const landscape = w >= h;
        setDims(landscape ? { w: 1800, h: Math.round(1800 * (h / w)) } : { w: 1000, h: 800 });
      } else {
        const landscape = w >= h;
        setDims(landscape ? { w: 1600, h: 460 } : { w: 1000, h: 560 });
      }
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [full]);

  // Pseudo-fullscreen : overlay CSS, pas de bandeau Android
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [full]);

  // Fraction du path déjà parcourue (0 → 1)
  const progress = cursor / secs;

  return (
    <div
      className={
        "overflow-hidden bg-black ring-1 ring-black/60 shadow-[var(--shadow-md)] " +
        (full ? "fixed inset-0 z-50 rounded-none" : "relative rounded-[var(--radius-xl)]")
      }
    >
      <div className="flex items-center gap-3 border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          MONITOR · 12 DÉRIVATIONS
        </span>
        <span className="hidden sm:inline text-white/30">25 mm/s · 10 mm/mV</span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setPlaying((v) => !v)} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20">
            {playing ? "❙❙" : "▶"}
          </button>
          <button type="button" onClick={() => setSound((v) => !v)} aria-label={sound ? "Couper le son" : "Activer le son"}
            className={"rounded-full px-2 py-0.5 text-[10px] transition-colors " + (sound ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/40")}>
            {sound ? "🔊" : "🔈"}
          </button>
          <button type="button" onClick={() => setFull((v) => !v)} aria-label={full ? "Quitter" : "Plein écran"}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20">
            {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </span>
      </div>

      {full ? (
        <div className="pointer-events-none absolute bottom-2 right-3 z-10 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/60">
          📱 Tourne ton téléphone en paysage
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={full ? "block h-[calc(100vh-32px)] w-full" : "block w-full"}
        style={full ? undefined : { aspectRatio: `${W}/${H}` }}
        preserveAspectRatio="xMidYMid meet"
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

        <line x1={colR - COL_GAP / 2} y1={top} x2={colR - COL_GAP / 2} y2={H - bottom} stroke="rgba(255,255,255,0.06)" />

        {/* Colonne gauche */}
        {leftTraces.map((name, i) => {
          const yMid = top + rowL * (i + 0.5);
          const isPleth = name === "PLETH";
          return (
            <g key={name}>
              <line x1={colL + 28} y1={yMid} x2={colL + colW} y2={yMid} stroke={isPleth ? "rgba(0,220,255,0.15)" : "rgba(0,255,100,0.12)"} strokeWidth="0.5" />
              <text x={colL} y={yMid + 4} fontSize="11" fontFamily="ui-monospace,monospace" fill={isPleth ? "#00e5ff" : "#00ff6a"} fontWeight="700">{name}</text>
              <path d={paths[`L:${name}`]} fill="none" stroke={isPleth ? "#00e5ff" : "#00ff6a"} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${isPleth ? "rgba(0,229,255,0.6)" : "rgba(0,255,106,0.6)"})`, strokeDasharray: `${progress * 10000} ${10000}` }} />
            </g>
          );
        })}

        {/* Colonne droite */}
        {rightTraces.map((name, i) => {
          const yMid = top + rowR * (i + 0.5);
          return (
            <g key={name}>
              <line x1={colR + 28} y1={yMid} x2={colR + colW} y2={yMid} stroke="rgba(0,255,100,0.12)" strokeWidth="0.5" />
              <text x={colR} y={yMid + 4} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">{name}</text>
              <path d={paths[`R:${name}`]} fill="none" stroke="#00ff6a" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 4px rgba(0,255,106,0.5))", strokeDasharray: `${progress * 10000} ${10000}` }} />
            </g>
          );
        })}

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
