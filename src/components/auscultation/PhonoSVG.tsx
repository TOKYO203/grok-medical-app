import { useId, useMemo } from "react";
import type { PhonoCycle, PhonoEvent } from "@/lib/auscultation/phonocardiogram";

const PX_PER_SEC = 800;

/**
 * Coordonnée SVG à 2 décimales, sous forme de chaîne.
 * Le MÊME calcul flottant ne se sérialise pas forcément pareil selon la version
 * de V8 (serveur Node vs navigateur) : `29.818181818181820` s'écrit
 * `29.818181818181834` ici et `29.81818181818181` là. Ces chaînes différentes
 * déclenchent un mismatch d'hydratation React (et un re-render du sous-arbre).
 * Un arrondi fixe rend le tracé déterministe et allège le DOM.
 */
const coord = (v: number): string => v.toFixed(2);
const Y_BASE_RATIO = 0.74;
const MAX_AMPL_RATIO = 0.58;

const PHASE_FILL: Record<string, { base: string; active: string }> = {
  systole: { base: "rgba(224,90,58,0.08)", active: "rgba(224,90,58,0.22)" },
  diastole: { base: "rgba(30,95,168,0.08)", active: "rgba(30,95,168,0.22)" },
  inspi: { base: "rgba(30,138,95,0.10)", active: "rgba(30,138,95,0.26)" },
  expi: { base: "rgba(200,140,60,0.08)", active: "rgba(200,140,60,0.24)" },
};

// Couleurs par kind. Deux tons pour permettre le dégradé vertical.
// ─── ECG synthétique (P-QRS-T) ─────────────────────────────────────────
// R du QRS est aligné sur B1 (t=0). L'onde P précède, T suit.
const ECG_TOP = 64; // hauteur réservée à l'ECG en haut

function gauss(t: number, center: number, sigma: number, amp: number): number {
  return amp * Math.exp(-Math.pow((t - center) / sigma, 2));
}

/**
 * Fenêtre du tracé, en secondes, avant le QRS.
 * Elle doit dépasser le centre de l'onde P (-160 ms) pour que le P du
 * battement affiché soit réellement dans le cadre : avec 0,10 s il tombait
 * hors fenêtre et l'ECG n'avait pas d'onde P avant le QRS.
 */
const ECG_LEAD_IN = 0.2;
/** Amplitude maximale du tracé ECG, en mV (pic R). */
const ECG_MAX_MV = 1.0;

function ecgAmplitude(t: number): number {
  // Amplitudes réalistes d'un ECG de surface :
  //   P : 0.18 mV (petit dôme arrondi, ~160 ms avant R)
  //   Q : -0.12 mV (petit creux)
  //   R : 1.0 mV (pic principal, aligné sur B1)
  //   S : -0.22 mV (creux post-R)
  //   T : 0.42 mV (dôme large, ~40 % du R)
  let amp = 0;
  amp += gauss(t, -0.16, 0.028, 0.18); // P (avant le QRS, donc t < 0)
  // Complexe QRS centré sur t = 0 (aligné sur B1)
  amp += gauss(t, -0.018, 0.007, -0.12); // Q
  amp += gauss(t, 0, 0.006, 1.0); // R
  amp += gauss(t, 0.022, 0.008, -0.22); // S
  // Onde T : large dôme ~300 ms après le QRS
  amp += gauss(t, 0.3, 0.065, 0.42); // T
  return amp;
}

function ecgPointsPath(cycleDuration: number, yBaseline: number, yTop: number): string {
  const N = 220;
  const range = yBaseline - yTop;
  const pts: string[] = [];
  // Le tracé démarre à -ECG_LEAD_IN (pour inclure l'onde P du battement
  // courant) et se termine à cycleDuration - ECG_LEAD_IN : x reste dans [0, w].
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * cycleDuration - ECG_LEAD_IN;
    // Normalisation : 1 mV (pic R) occupe toute la hauteur du bandeau ECG.
    const y = yBaseline - (ecgAmplitude(t) / ECG_MAX_MV) * range;
    const x = (t + ECG_LEAD_IN) * PX_PER_SEC;
    pts.push(`${i === 0 ? "M" : "L"} ${coord(x)} ${coord(y)}`);
  }
  return pts.join(" ");
}

const KIND_PALETTE: Record<string, { top: string; bot: string; line: string }> = {
  s1: { top: "#ff8060", bot: "#c04020", line: "#e05a3a" },
  s2: { top: "#ff8060", bot: "#c04020", line: "#e05a3a" },
  s3: { top: "#ffd060", bot: "#a07000", line: "#d99000" },
  s4: { top: "#ffd060", bot: "#a07000", line: "#d99000" },
  murmur: { top: "#7ec0ff", bot: "#1d5fa0", line: "#4a90d9" },
  click: { top: "#cfa0ff", bot: "#6030a0", line: "#a06abf" },
  os: { top: "#cfa0ff", bot: "#6030a0", line: "#a06abf" },
  rub: { top: "#e0b070", bot: "#805020", line: "#c08a40" },
  crackle: { top: "#70e0a0", bot: "#1a7040", line: "#3aa06e" },
  continuous: { top: "#7ec0ff", bot: "#1d5fa0", line: "#4a90d9" },
  breath: { top: "#90d0a8", bot: "#2a7048", line: "#5aa07a" },
};

function eventPath(ev: PhonoEvent, yBase: number, maxH: number): string {
  const t = ev.startTime * PX_PER_SEC;
  const d = ev.duration * PX_PER_SEC;
  const h = ev.amplitude * maxH;
  const top = yBase - h;
  const x0 = t,
    x1 = t + d,
    mid = (x0 + x1) / 2;

  const yB = coord(yBase);
  const yT = coord(top);

  switch (ev.shape) {
    case "impulse":
      return `M ${coord(x0)} ${yB} Q ${coord(x0 + d * 0.15)} ${yT} ${coord(x0 + d * 0.35)} ${yT} Q ${coord(mid)} ${yT} ${coord(x1)} ${yB}`;
    case "plateau":
      return `M ${coord(x0)} ${yB} L ${coord(x0 + d * 0.06)} ${yT} L ${coord(x1 - d * 0.06)} ${yT} L ${coord(x1)} ${yB} Z`;
    case "crescendo":
      return `M ${coord(x0)} ${yB} L ${coord(x1)} ${yT} L ${coord(x1)} ${yB} Z`;
    case "decrescendo":
      return `M ${coord(x0)} ${yT} L ${coord(x1)} ${yB} L ${coord(x0)} ${yB} Z`;
    case "crescendo-decrescendo":
      return `M ${coord(x0)} ${yB} Q ${coord(mid)} ${coord(top - h * 0.1)} ${coord(x1)} ${yB} Z`;
    case "rumble": {
      const pts = [`M ${coord(x0)} ${yB}`, `L ${coord(x0)} ${yT}`];
      const steps = 30;
      for (let i = 1; i <= steps; i++) {
        const x = x0 + (d * i) / steps;
        const amp = Math.sin((i / steps) * Math.PI * 8) * h * 0.14;
        pts.push(`L ${coord(x)} ${coord(top + Math.abs(amp))}`);
      }
      pts.push(`L ${coord(x1)} ${yB}`);
      return pts.join(" ") + " Z";
    }
    case "burst": {
      const pts = [`M ${coord(x0)} ${yB}`];
      const steps = 10;
      for (let i = 1; i < steps; i++) {
        const x = x0 + (d * i) / steps;
        const amp = Math.sin((i / steps) * Math.PI * 3) * h * 0.3;
        pts.push(`L ${coord(x)} ${coord(top + Math.abs(amp))}`);
      }
      pts.push(`L ${coord(x1)} ${yB} Z`);
      return pts.join(" ");
    }
    default:
      return `M ${coord(x0)} ${yB} Q ${coord(x0 + d * 0.15)} ${yT} ${coord(mid)} ${yT} Q ${coord(x1 - d * 0.2)} ${yT} ${coord(x1)} ${yB}`;
  }
}

export function PhonoSVG({
  cycle,
  playheadSec,
  height = 220,
}: {
  cycle: PhonoCycle;
  playheadSec?: number;
  height?: number;
}) {
  const w = cycle.durationSec * PX_PER_SEC;
  // Le bandeau ECG réserve le haut : le phonocardiogramme se répartit sur la
  // hauteur RESTANTE. Calculer maxH sur la hauteur totale faisait déborder
  // dans la bande ECG tout événement d'amplitude > 0,96 (ex. B1 éclaté du RM).
  const phonoH = height - ECG_TOP;
  const yBase = ECG_TOP + phonoH * Y_BASE_RATIO;
  const maxH = phonoH * MAX_AMPL_RATIO;
  const ph = typeof playheadSec === "number" ? playheadSec : -1;

  // Largeur révélée : si pas de lecture (ph < 0) → tout visible.
  // Sinon, on révèle progressivement jusqu'au playhead.
  const revealWidth = ph < 0 ? w + 20 : Math.max(0, ph * PX_PER_SEC) + 2;

  // Identifiant stable serveur/client. Math.random() en render produisait deux
  // valeurs différentes au SSR et à l'hydratation → mismatch React et
  // recréation des <defs>.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Tracé ECG : ne dépend pas du playhead → calculé une fois par cycle,
  // et réutilisé par les deux <path> (contour flouté + tracé net).
  const ecgPath = useMemo(
    () => ecgPointsPath(cycle.durationSec, ECG_TOP - 8, 18),
    [cycle.durationSec],
  );

  // Graduations axe temporel tous les 100 ms
  const ticks: number[] = [];
  for (let t = 0; t <= cycle.durationSec + 0.001; t += 0.1) {
    ticks.push(Number(t.toFixed(2)));
  }

  // Détection d'annotation clinique : COM (clic d'ouverture mitral)
  const hasOS = cycle.events.some((e) => e.kind === "os");

  return (
    <svg
      viewBox={`0 0 ${coord(w)} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      data-phono-cycle={cycle.durationSec}
      role="img"
      aria-label="Phonocardiogramme"
      style={{ display: "block", background: "#04060a" }}
    >
      <defs>
        {Object.entries(KIND_PALETTE).map(([kind, p]) => (
          <linearGradient key={kind} id={`grad-${uid}-${kind}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={p.top} stopOpacity="0.95" />
            <stop offset="60%" stopColor={p.line} stopOpacity="0.75" />
            <stop offset="100%" stopColor={p.bot} stopOpacity="0.25" />
          </linearGradient>
        ))}
        <radialGradient id={`ph-glow-${uid}`}>
          <stop offset="0%" stopColor="#A67C1E" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#A67C1E" stopOpacity="0" />
        </radialGradient>
        <filter id={`ph-blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <pattern id={`ph-grid-${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(166,124,30,0.10)"
            strokeWidth="0.6"
          />
        </pattern>
        <linearGradient id={`ph-bar-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#A67C1E" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffd060" stopOpacity="0.9" />
        </linearGradient>
        <clipPath id={`reveal-clip-${uid}`}>
          <rect x="-20" y="0" width={coord(revealWidth + 20)} height={height} />
        </clipPath>
      </defs>

      <rect width={coord(w)} height={height} fill={`url(#ph-grid-${uid})`} />

      {/* ═══ Bandeau ECG synchrone ═══ */}
      <g>
        {/* Label ECG */}
        <text
          x="4"
          y="14"
          fontSize="8"
          fontFamily="-apple-system, system-ui, sans-serif"
          fill="rgba(90,200,140,0.85)"
          fontWeight={700}
          letterSpacing="0.14em"
        >
          ECG
        </text>
        {/* Baseline ECG */}
        <line
          x1={0}
          y1={ECG_TOP - 8}
          x2={coord(w)}
          y2={ECG_TOP - 8}
          stroke="rgba(90,200,140,0.2)"
          strokeWidth="0.5"
        />
        {/* Tracé P-QRS-T */}
        <g clipPath={`url(#reveal-clip-${uid})`}>
          <path
            d={ecgPath}
            fill="none"
            stroke="rgba(90,204,140,0.35)"
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={`url(#ph-blur-${uid})`}
          />
          <path
            d={ecgPath}
            fill="none"
            stroke="#5ACC8C"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
        {/* Ligne séparatrice ECG / PHONO */}
        <line
          x1={0}
          y1={ECG_TOP}
          x2={coord(w)}
          y2={ECG_TOP}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />
        {/* Label PHONO */}
        <text
          x="4"
          y={ECG_TOP + 14}
          fontSize="8"
          fontFamily="-apple-system, system-ui, sans-serif"
          fill="rgba(255,140,120,0.75)"
          fontWeight={700}
          letterSpacing="0.14em"
        >
          PHONO
        </text>
      </g>

      {cycle.phases.map((phase, i) => {
        const active = ph >= phase.start && ph < phase.end;
        const colors = PHASE_FILL[phase.color] ?? { base: "transparent", active: "transparent" };
        return (
          <rect
            key={`ph-${i}`}
            x={coord(phase.start * PX_PER_SEC)}
            y={ECG_TOP}
            width={coord((phase.end - phase.start) * PX_PER_SEC)}
            height={coord(yBase - ECG_TOP)}
            fill={active ? colors.active : colors.base}
            style={{ transition: "fill 180ms ease-out" }}
          />
        );
      })}

      {cycle.phases.map((phase, i) => {
        const active = ph >= phase.start && ph < phase.end;
        return (
          <text
            key={`phl-${i}`}
            x={coord(((phase.start + phase.end) / 2) * PX_PER_SEC)}
            y={ECG_TOP + 30}
            fontSize={11}
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fill={active ? "#A67C1E" : "rgba(255,255,255,0.30)"}
            textAnchor="middle"
            letterSpacing="0.16em"
            style={{ transition: "fill 180ms ease-out" }}
          >
            {phase.label.toUpperCase()}
          </text>
        );
      })}

      {/* Graduations axe temporel */}
      {ticks.map((t) => {
        const x = coord(t * PX_PER_SEC);
        const isMajor = Math.abs(t % 0.2) < 0.001;
        return (
          <g key={`tick-${t}`}>
            <line
              x1={x}
              y1={coord(yBase + 2)}
              x2={x}
              y2={coord(yBase + (isMajor ? 8 : 5))}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.5"
            />
            {isMajor && t > 0 && (
              <text
                x={x}
                y={coord(yBase + 18)}
                fontSize={7.5}
                fontFamily="ui-monospace"
                fill="rgba(255,255,255,0.32)"
                textAnchor="middle"
              >
                {Math.round(t * 1000)}
              </text>
            )}
          </g>
        );
      })}

      {/* Événements avec gradients + glow */}
      {cycle.events.map((ev, i) => {
        const palette = KIND_PALETTE[ev.kind] ?? { top: "#888", bot: "#333", line: "#999" };
        const active = ph >= ev.startTime && ph < ev.startTime + ev.duration;
        const d = eventPath(ev, yBase, maxH);

        return (
          <g key={`ev-${i}`} clipPath={`url(#reveal-clip-${uid})`}>
            {active && (
              <path d={d} fill={palette.line} opacity={0.55} filter={`url(#ph-blur-${uid})`} />
            )}
            <path
              d={d}
              fill={`url(#grad-${uid}-${ev.kind})`}
              stroke={palette.line}
              strokeWidth={active ? 1.6 : 0.7}
              opacity={active ? 1 : 0.9}
              style={{ transition: "opacity 140ms ease-out, stroke-width 140ms ease-out" }}
            />
            {ev.label && (
              <text
                x={coord((ev.startTime + ev.duration / 2) * PX_PER_SEC)}
                y={coord(yBase + 34)}
                fontSize={9.5}
                fontFamily="ui-monospace"
                fill={active ? palette.top : palette.line}
                textAnchor="middle"
                style={{ transition: "fill 140ms ease-out" }}
              >
                {ev.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Annotation clinique : COM +80ms */}
      {hasOS &&
        (() => {
          const os = cycle.events.find((e) => e.kind === "os");
          const b2 = cycle.events.find((e) => e.kind === "s2");
          if (!os || !b2) return null;
          const delayMs = Math.round((os.startTime - b2.startTime - b2.duration) * 1000);
          const x = coord((os.startTime + os.duration / 2) * PX_PER_SEC);
          return (
            <g>
              <line
                x1={coord((b2.startTime + b2.duration) * PX_PER_SEC)}
                y1={coord(yBase - maxH * 0.9)}
                x2={x}
                y2={coord(yBase - maxH * 0.9)}
                stroke="rgba(166,124,30,0.55)"
                strokeWidth="0.6"
                strokeDasharray="2 2"
              />
              <text
                x={coord(((b2.startTime + b2.duration + os.startTime) / 2) * PX_PER_SEC)}
                y={coord(yBase - maxH * 0.9 - 4)}
                fontSize={8}
                fontFamily="ui-monospace"
                fill="#A67C1E"
                textAnchor="middle"
              >
                COM +{delayMs}ms
              </text>
            </g>
          );
        })()}

      {/* Playhead */}
      {ph >= 0 && (
        <g>
          <circle
            cx={ph * PX_PER_SEC}
            cy={yBase}
            r={30}
            fill={`url(#ph-glow-${uid})`}
            opacity={0.75}
          />
          <rect
            x={ph * PX_PER_SEC - 0.6}
            y={0}
            width={1.2}
            height={height}
            fill="#A67C1E"
            opacity={0.95}
          />
          <circle
            cx={ph * PX_PER_SEC}
            cy={yBase}
            r={3.4}
            fill="#A67C1E"
            stroke="#fff"
            strokeWidth={0.6}
          />
        </g>
      )}

      {/* Barre de progression */}
      {ph >= 0 && (
        <rect
          x={0}
          y={height - 4}
          width={(ph / cycle.durationSec) * w}
          height={4}
          fill={`url(#ph-bar-${uid})`}
        />
      )}
    </svg>
  );
}
