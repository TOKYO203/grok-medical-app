import { useEffect, useMemo, useRef, useState } from "react";
import { useEcgBeep } from "@/lib/ecg/useEcgBeep";

/* ═══════════════════════════════════════════════════════════════════
   EcgMonitor — Moniteur de signes vitaux multi-trace
   ECG II + aVR + PLETH · panneau chiffres (HR / NIBP / SpO2)
   ═══════════════════════════════════════════════════════════════════ */

const W = 1200;
const H = 400;
const PX = 20;

type Pt = { t: number; v: number };

function gauss(t: number, mu: number, a: number, s: number) {
  const d = t - mu;
  return a * Math.exp(-(d * d) / (2 * s * s));
}

function buildEcg(bpm: number, seconds: number, inverted = false): Pt[] {
  const cy = 60 / bpm;
  const n = Math.round(seconds * 500);
  const out: Pt[] = [];
  const sign = inverted ? -1 : 1;
  for (let i = 0; i <= n; i++) {
    const t = i / 500;
    const ph = t % cy;
    let v = 0;
    v += gauss(ph, 0.16, 0.15, 0.025);
    v += gauss(ph, 0.26, -0.15, 0.008);
    v += gauss(ph, 0.28, 1.20, 0.010);
    v += gauss(ph, 0.30, -0.35, 0.010);
    v += gauss(ph, 0.47, 0.30, 0.040);
    out.push({ t, v: v * sign });
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
    // onde de pouls : montée rapide + dicrotisme
    let v = 0;
    v += gauss(ph, 0.18, 1.0, 0.045);
    v += gauss(ph, 0.36, 0.30, 0.055);
    out.push({ t, v });
  }
  return out;
}

function pathFor(pts: Pt[], win: number, start: number, yMid: number, amp: number): string {
  const wIn = W - 2 * PX;
  const hIn = amp;
  let d = "";
  let started = false;
  for (const p of pts) {
    if (p.t < start || p.t > start + win) continue;
    const x = PX + ((p.t - start) / win) * wIn;
    const y = yMid - p.v * hIn;
    d += (started ? "L " : "M ") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    started = true;
  }
  return d.trim();
}

export function EcgMonitor({
  bpm = 75,
  secondsWindow = 4,
  totalSeconds = 60,
  autoStart = true,
}: {
  bpm?: number;
  label?: string;
  secondsWindow?: number;
  totalSeconds?: number;
  autoStart?: boolean;
}) {
  const ecgII = useMemo(() => buildEcg(bpm, totalSeconds, false), [bpm, totalSeconds]);
  const ecgAvr = useMemo(() => buildEcg(bpm, totalSeconds, true), [bpm, totalSeconds]);
  const pleth = useMemo(() => buildPleth(bpm, totalSeconds), [bpm, totalSeconds]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(autoStart);
  const [sound, setSound] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now() - cursor * 1000;
    const tick = (now: number) => {
      const t = ((now - (startRef.current ?? now)) / 1000) % totalSeconds;
      setCursor(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, totalSeconds]);

  useEcgBeep({ enabled: sound && playing, bpm });

  const winStart = Math.max(0, Math.min(cursor - secondsWindow * 0.85, totalSeconds - secondsWindow));
  const sweepX = PX + ((cursor - winStart) / secondsWindow) * (W - 2 * PX);

  // Répartition : 3 traces empilées à gauche + panneau à droite
  const tracesTop = 40;
  const tracesHeight = H - tracesTop - 20;
  const rowH = tracesHeight / 3;
  const yII = tracesTop + rowH * 0.5;
  const yAvr = tracesTop + rowH * 1.5;
  const yPleth = tracesTop + rowH * 2.5;
  const TRACE_W = W * 0.72;
  const amp = rowH * 0.42;

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] bg-black ring-1 ring-black/60 shadow-[var(--shadow-md)]">
      {/* Barre statut haut */}
      <div className="flex items-center gap-3 border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          MONITOR
        </span>
        <span className="text-white/30">25 mm/s</span>
        <span className="text-white/30">10 mm/mV</span>
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
            className={"rounded-full px-2 py-0.5 text-[10px] transition-colors " + (sound ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/40")}
          >
            {sound ? "🔊" : "🔈"}
          </button>
        </span>
      </div>

      <div className="flex">
        {/* Zone traces */}
        <div className="relative flex-1 bg-black">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ aspectRatio: `${W}/${H}` }} aria-label="Moniteur de signes vitaux">
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

            {/* Séparateurs */}
            <line x1={0} y1={tracesTop + rowH} x2={TRACE_W} y2={tracesTop + rowH} stroke="rgba(255,255,255,0.05)" />
            <line x1={0} y1={tracesTop + rowH * 2} x2={TRACE_W} y2={tracesTop + rowH * 2} stroke="rgba(255,255,255,0.05)" />

            {/* Ligne de base par trace */}
            <line x1={PX} y1={yII} x2={TRACE_W - PX} y2={yII} stroke="rgba(0,255,100,0.15)" strokeWidth="0.5" />
            <line x1={PX} y1={yAvr} x2={TRACE_W - PX} y2={yAvr} stroke="rgba(0,255,100,0.15)" strokeWidth="0.5" />
            <line x1={PX} y1={yPleth} x2={TRACE_W - PX} y2={yPleth} stroke="rgba(0,220,255,0.20)" strokeWidth="0.5" />

            {/* Tracés */}
            <path d={pathFor(ecgII, secondsWindow, winStart, yII, amp)} fill="none" stroke="#00ff6a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px rgba(0,255,106,0.6))" }} />
            <path d={pathFor(ecgAvr, secondsWindow, winStart, yAvr, amp)} fill="none" stroke="#00ff6a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px rgba(0,255,106,0.4))" }} />
            <path d={pathFor(pleth, secondsWindow, winStart, yPleth, amp)} fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px rgba(0,229,255,0.6))" }} />

            {/* Sweep */}
            {playing ? <line x1={sweepX} y1={tracesTop} x2={sweepX} y2={H - 20} stroke="rgba(0,255,106,0.28)" strokeWidth="1" /> : null}

            {/* Labels dérivations */}
            <text x={10} y={yII + 4} fontSize="12" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">II</text>
            <text x={10} y={yAvr + 4} fontSize="12" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700" opacity="0.7">aVR</text>
            <text x={10} y={yPleth + 4} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">PLETH</text>

            {/* Limite zone chiffres */}
            <line x1={TRACE_W} y1={tracesTop} x2={TRACE_W} y2={H - 20} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* ─── PANNEAU CHIFFRES ─── */}
            {/* ECG header */}
            <text x={TRACE_W + 15} y={tracesTop + 18} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">ECG</text>
            <text x={W - PX} y={tracesTop + 18} fontSize="11" fontFamily="ui-monospace,monospace" fill="#ff3355" textAnchor="end">♥</text>
            <text x={TRACE_W + 15} y={tracesTop + 90} fontSize="52" fontFamily="ui-monospace,monospace" fill="#00ff6a" fontWeight="700">{bpm}</text>
            <text x={TRACE_W + 15 + 70} y={tracesTop + 90} fontSize="11" fontFamily="ui-monospace,monospace" fill="rgba(0,255,106,0.5)">bpm</text>

            {/* NIBP */}
            <line x1={TRACE_W} y1={tracesTop + 110} x2={W} y2={tracesTop + 110} stroke="rgba(255,255,255,0.08)" />
            <text x={TRACE_W + 15} y={tracesTop + 130} fontSize="11" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">NIBP</text>
            <text x={TRACE_W + 15} y={tracesTop + 180} fontSize="32" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">117</text>
            <text x={TRACE_W + 15 + 65} y={tracesTop + 180} fontSize="22" fontFamily="ui-monospace,monospace" fill="#ffffff" fontWeight="700">81</text>
            <text x={TRACE_W + 15} y={tracesTop + 200} fontSize="9" fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)">mmHg</text>

            {/* SpO2 */}
            <line x1={TRACE_W} y1={tracesTop + 225} x2={W} y2={tracesTop + 225} stroke="rgba(255,255,255,0.08)" />
            <text x={TRACE_W + 15} y={tracesTop + 245} fontSize="11" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">SpO₂</text>
            <text x={TRACE_W + 15} y={tracesTop + 305} fontSize="48" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">97</text>
            <text x={TRACE_W + 15 + 70} y={tracesTop + 305} fontSize="14" fontFamily="ui-monospace,monospace" fill="#00e5ff" fontWeight="700">%</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
