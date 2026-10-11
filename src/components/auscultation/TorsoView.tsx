/**
 * TorsoView v3 — schéma anatomique du thorax.
 *
 * Couches (de l'arrière vers l'avant) :
 *   1. Contour du tronc + cou
 *   2. Pectoraux (ombres douces)
 *   3. Cage thoracique : 12 paires de côtes + cartilages
 *   4. Sternum (manubrium + corps) + clavicules
 *   5. Poumons en fantôme + scissures obliques
 *   6. Cœur stylisé (4 cavités) + aorte + artère pulmonaire
 *   7. Trachée + carène + bronches souches
 *   8. Diaphragme bi-coupole
 *   9. Lignes de repère (médio-claviculaire, axillaire)
 *  10. Foyers auscultatoires interactifs
 *
 * ViewBox 220 × 280. Aucune dépendance externe.
 */

import { useEffect, useState } from "react";

export type FoyerId =
  | "aortique" | "pulmonaire" | "erb" | "tricuspide" | "mitral"
  | "trachee" | "sommet-d" | "sommet-g" | "base-d" | "base-g"
  | "axillaire-d" | "axillaire-g" | "diffus";

interface Foyer {
  id: FoyerId;
  label: string;
  short: string;
  x: number;
  y: number;
  r: number;
}

const CARDIO_FOYERS: Foyer[] = [
  { id: "aortique",   label: "Aortique",   short: "Aort", x: 92,  y: 68,  r: 7.5 },
  { id: "pulmonaire", label: "Pulmonaire", short: "Pulm", x: 128, y: 68,  r: 7.5 },
  { id: "erb",        label: "Erb",        short: "Erb",  x: 128, y: 90,  r: 7 },
  { id: "tricuspide", label: "Tricuspide", short: "Tric", x: 128, y: 112, r: 7 },
  { id: "mitral",     label: "Mitral",     short: "Mitr", x: 145, y: 142, r: 8.5 },
];

const PULMO_FOYERS: Foyer[] = [
  { id: "trachee",     label: "Trachée",     short: "Trac", x: 110, y: 32,  r: 6.5 },
  { id: "sommet-d",    label: "Sommet D",    short: "Somm", x: 78,  y: 60,  r: 7.5 },
  { id: "sommet-g",    label: "Sommet G",    short: "Somm", x: 142, y: 60,  r: 7.5 },
  { id: "axillaire-d", label: "Axillaire D", short: "Axil", x: 52,  y: 110, r: 7.5 },
  { id: "axillaire-g", label: "Axillaire G", short: "Axil", x: 168, y: 110, r: 7.5 },
  { id: "base-d",      label: "Base D",      short: "Base", x: 78,  y: 185, r: 8 },
  { id: "base-g",      label: "Base G",      short: "Base", x: 142, y: 185, r: 8 },
  { id: "diffus",      label: "Diffus",      short: "Diff", x: 110, y: 232, r: 8 },
];

const GOLD = "#A67C1E";

// Couleurs anatomiques
const C = {
  skin:        "rgba(200,180,150,0.20)",
  skinSoft:    "rgba(200,180,150,0.08)",
  bone:        "rgba(220,200,160,0.42)",
  boneLight:   "rgba(220,200,160,0.26)",
  cartilage:   "rgba(200,180,160,0.30)",
  lung:        "rgba(90,150,190,0.06)",
  lungStroke:  "rgba(90,150,190,0.22)",
  heart:       "rgba(180,70,70,0.10)",
  heartStroke: "rgba(210,90,90,0.42)",
  vessel:      "rgba(200,110,90,0.40)",
  airway:      "rgba(150,180,200,0.45)",
  diaphragm:   "rgba(180,150,120,0.22)",
  refLine:     "rgba(166,124,30,0.18)",
};

// Génère une côte (arc supérieur + inférieur = épaisseur)
function ribPath(cx: number, cy: number, side: 1 | -1): string {
  const sx = cx + side * 14;
  const ex = cx + side * 40;
  const ey = cy + 22;
  return `M ${sx} ${cy} Q ${cx + side * 34} ${cy + 2} ${ex} ${ey}`;
}

export function TorsoView({
  mode,
  activeFoyer,
  onFoyerClick,
  height = 180,
}: {
  mode: "cardiaque" | "pulmonaire";
  activeFoyer?: FoyerId;
  onFoyerClick?: (id: FoyerId) => void;
  height?: number;
}) {
  const foyers = mode === "cardiaque" ? CARDIO_FOYERS : PULMO_FOYERS;
  const active = foyers.find((f) => f.id === activeFoyer) ?? foyers[0];

  const [steth, setSteth] = useState({ x: active.x, y: active.y });
  useEffect(() => {
    setSteth({ x: active.x, y: active.y });
  }, [active.x, active.y]);

  // 12 paires de côtes — coordonnées Y décroissantes
  const ribLevels = [72, 84, 96, 108, 120, 132, 144, 155, 165, 174, 182, 190];

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-b from-card via-card to-secondary/20"
      style={{ perspective: "1000px" }}
    >
      <div
        style={{
          transform: "rotateX(6deg)",
          transformStyle: "preserve-3d",
          transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <svg
          viewBox="0 0 220 280"
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Schéma anatomique thoracique"
          style={{ display: "block" }}
        >
          <defs>
            <radialGradient id="tv-bg" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="rgba(166,124,30,0.07)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="tv-heart" cx="55%" cy="55%" r="60%">
              <stop offset="0%" stopColor="rgba(200,80,80,0.18)" />
              <stop offset="100%" stopColor="rgba(180,70,70,0.06)" />
            </radialGradient>
            <radialGradient id="tv-lung" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="rgba(90,150,190,0.10)" />
              <stop offset="100%" stopColor="rgba(90,150,190,0.02)" />
            </radialGradient>
            <linearGradient id="tv-skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
            </linearGradient>
            <filter id="tv-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id="tv-heartbeat" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>

          <rect width="220" height="280" fill="url(#tv-bg)" />

          {/* ═══ COUCHE 1 — Contour du tronc + cou ═══ */}
          <path
            d="M 92 6 Q 100 0 110 0 Q 120 0 128 6
               L 130 22 Q 155 14 178 26
               Q 200 38 208 66 L 212 110 Q 214 140 212 170
               Q 210 220 205 268 L 205 274 L 15 274 L 15 268
               Q 10 220 8 170 Q 6 140 8 110 L 12 66
               Q 20 38 42 26 Q 65 14 90 22 Z"
            fill="url(#tv-skin)"
            stroke={C.skin}
            strokeWidth="1.2"
          />

          {/* Pectoraux (ombres) */}
          <path
            d="M 30 70 Q 60 55 105 60 Q 100 100 90 135 Q 55 130 35 105 Z"
            fill={C.skinSoft}
          />
          <path
            d="M 190 70 Q 160 55 115 60 Q 120 100 130 135 Q 165 130 185 105 Z"
            fill={C.skinSoft}
          />

          {/* ═══ COUCHE 2 — Poumons en fantôme ═══ */}
          {/* Poumon droit (à gauche de l'écran = côté patient D) */}
          <path
            d="M 92 62 Q 68 68 56 100 Q 50 130 56 165 Q 62 195 78 210
               Q 88 205 92 185 Q 94 155 92 120 Z"
            fill="url(#tv-lung)"
            stroke={C.lungStroke}
            strokeWidth="0.7"
            opacity="0.9"
          />
          {/* Poumon gauche (à droite de l'écran) */}
          <path
            d="M 128 62 Q 152 68 164 100 Q 170 130 164 165
               Q 158 195 142 210 Q 132 205 128 185
               Q 126 155 128 120 Z"
            fill="url(#tv-lung)"
            stroke={C.lungStroke}
            strokeWidth="0.7"
            opacity="0.9"
          />
          {/* Scissures obliques */}
          <path
            d="M 56 108 Q 75 118 92 112"
            stroke={C.lungStroke}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            fill="none"
          />
          <path
            d="M 164 108 Q 145 118 128 112"
            stroke={C.lungStroke}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            fill="none"
          />

          {/* ═══ COUCHE 3 — Cage thoracique ═══ */}
          {/* 12 paires de côtes */}
          {ribLevels.map((y, i) => {
            const opacity = Math.max(0.32, 0.62 - i * 0.03);
            const width = i >= 9 ? 0.9 : 0.75;
            return (
              <g key={`rib-${i}`} opacity={opacity}>
                {/* Côte droite (côté gauche de l'écran) */}
                <path
                  d={ribPath(110, y, -1)}
                  fill="none"
                  stroke={C.bone}
                  strokeWidth={width}
                  strokeLinecap="round"
                />
                {/* Côte gauche (côté droit de l'écran) */}
                <path
                  d={ribPath(110, y, 1)}
                  fill="none"
                  stroke={C.bone}
                  strokeWidth={width}
                  strokeLinecap="round"
                />
                {/* Cartilage costal antérieur (segment sternal) */}
                {i < 8 && (
                  <>
                    <path
                      d={`M ${110 - 22 - i * 0.5} ${y + 4} Q ${110 - 14} ${y + 10} ${110 - 6} ${y + 13}`}
                      fill="none"
                      stroke={C.cartilage}
                      strokeWidth="0.6"
                    />
                    <path
                      d={`M ${110 + 22 + i * 0.5} ${y + 4} Q ${110 + 14} ${y + 10} ${110 + 6} ${y + 13}`}
                      fill="none"
                      stroke={C.cartilage}
                      strokeWidth="0.6"
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* ═══ COUCHE 4 — Sternum + clavicules ═══ */}
          {/* Manubrium */}
          <rect
            x="105" y="58" width="10" height="18" rx="1.5"
            fill="rgba(220,200,160,0.10)"
            stroke={C.bone}
            strokeWidth="0.75"
          />
          {/* Corps du sternum */}
          <rect
            x="105" y="78" width="10" height="95" rx="2"
            fill="rgba(220,200,160,0.08)"
            stroke={C.bone}
            strokeWidth="0.75"
          />
          {/* Ligne médiane */}
          <line x1="110" y1="58" x2="110" y2="175" stroke={C.boneLight} strokeWidth="0.4" strokeDasharray="2 2" />

          {/* Clavicules avec double courbure */}
          <path
            d="M 42 42 Q 70 28 105 40 Q 118 44 118 46"
            fill="none"
            stroke={C.bone}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path
            d="M 178 42 Q 150 28 115 40 Q 102 44 102 46"
            fill="none"
            stroke={C.bone}
            strokeWidth="1.15"
            strokeLinecap="round"
          />

          {/* ═══ COUCHE 5 — Cœur + gros vaisseaux ═══ */}
          {/* Cœur stylisé (4 cavités) */}
          <g opacity="0.95">
            {/* Contour global */}
            <path
              d="M 118 92 Q 134 84 148 96
                 Q 158 108 154 130
                 Q 148 152 132 162
                 Q 118 168 110 160
                 Q 104 148 106 128
                 Q 108 104 118 92 Z"
              fill="url(#tv-heart)"
              stroke={C.heartStroke}
              strokeWidth="0.85"
            />
            {/* Oreillette droite */}
            <path
              d="M 118 92 Q 128 90 132 100 Q 128 110 118 108 Q 114 100 118 92 Z"
              fill="rgba(180,70,70,0.10)"
              stroke={C.heartStroke}
              strokeWidth="0.5"
            />
            {/* Ventricule gauche (masse principale) */}
            <path
              d="M 132 102 Q 152 108 154 128 Q 150 152 132 162 Q 122 158 126 130 Q 128 110 132 102 Z"
              fill="rgba(180,70,70,0.14)"
              stroke={C.heartStroke}
              strokeWidth="0.55"
            />

            {/* Battement subtil */}
            <circle cx="138" cy="128" r="22" fill="rgba(200,80,80,0.10)" filter="url(#tv-heartbeat)">
              <animate attributeName="r" values="20;24;20" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Aorte ascendante + crosse + descendante */}
          <path
            d="M 130 100 Q 130 78 145 68 Q 158 60 165 70 Q 172 82 168 100 Q 165 120 168 150"
            fill="none"
            stroke={C.vessel}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          {/* Tronc artériel pulmonaire */}
          <path
            d="M 122 100 Q 118 80 126 68 Q 132 60 138 68 Q 142 76 138 92"
            fill="none"
            stroke={C.vessel}
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* ═══ COUCHE 6 — Trachée + bronches ═══ */}
          {/* Trachée */}
          <path
            d="M 108 10 L 108 55 Q 110 65 110 75"
            fill="none"
            stroke={C.airway}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 112 10 L 112 55 Q 110 65 110 75"
            fill="none"
            stroke="rgba(150,180,200,0.20)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Anneaux trachéaux */}
          {[14, 20, 26, 32, 38, 44, 50].map((y) => (
            <line
              key={`tra-${y}`}
              x1="107" y1={y} x2="113" y2={y}
              stroke="rgba(150,180,200,0.25)"
              strokeWidth="0.5"
            />
          ))}
          {/* Carène + bronches souches */}
          <path
            d="M 110 75 Q 100 82 88 92"
            fill="none"
            stroke={C.airway}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 110 75 Q 120 82 132 92"
            fill="none"
            stroke={C.airway}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Bronches lobaires (segments) */}
          <path d="M 92 94 Q 86 100 80 105" fill="none" stroke={C.airway} strokeWidth="0.8" opacity="0.6" />
          <path d="M 128 94 Q 134 100 140 105" fill="none" stroke={C.airway} strokeWidth="0.8" opacity="0.6" />

          {/* ═══ COUCHE 7 — Diaphragme bi-coupole ═══ */}
          <path
            d="M 30 220 Q 60 200 110 208 Q 160 200 190 220 Q 180 240 110 244 Q 40 240 30 220 Z"
            fill="rgba(180,150,120,0.05)"
            stroke={C.diaphragm}
            strokeWidth="0.8"
          />
          <path
            d="M 30 220 Q 60 200 110 208 Q 160 200 190 220"
            fill="none"
            stroke="rgba(180,150,120,0.15)"
            strokeWidth="0.5"
            strokeDasharray="3 2"
          />

          {/* ═══ COUCHE 8 — Lignes de repère médicales ═══ */}
          {/* Ligne médio-claviculaire D */}
          <line
            x1="72" y1="46" x2="72" y2="240"
            stroke={C.refLine}
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          {/* Ligne médio-claviculaire G */}
          <line
            x1="148" y1="46" x2="148" y2="240"
            stroke={C.refLine}
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          {/* Ligne axillaire antérieure D */}
          <line
            x1="42" y1="70" x2="42" y2="220"
            stroke={C.refLine}
            strokeWidth="0.4"
            strokeDasharray="2 5"
          />
          {/* Ligne axillaire antérieure G */}
          <line
            x1="178" y1="70" x2="178" y2="220"
            stroke={C.refLine}
            strokeWidth="0.4"
            strokeDasharray="2 5"
          />

          {/* ═══ COUCHE 9 — Foyers auscultatoires ═══ */}
          {foyers.map((f) => {
            const isActive = f.id === activeFoyer;
            return (
              <g
                key={f.id}
                onClick={() => onFoyerClick?.(f.id)}
                style={{ cursor: onFoyerClick ? "pointer" : "default" }}
                data-foyer={f.id}
                data-active={isActive ? "true" : "false"}
              >
                {isActive && (
                  <>
                    <circle cx={f.x} cy={f.y} r={f.r + 3} fill="none" stroke={GOLD} strokeWidth="0.8">
                      <animate attributeName="r" from={f.r + 3} to={f.r + 22} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={f.x} cy={f.y} r={f.r + 3} fill="none" stroke={GOLD} strokeWidth="0.8">
                      <animate attributeName="r" from={f.r + 3} to={f.r + 22} dur="1.8s" begin="0.9s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={f.x} cy={f.y} r={f.r + 6} fill="rgba(166,124,30,0.14)" filter="url(#tv-glow)" />
                  </>
                )}
                <circle
                  cx={f.x} cy={f.y} r={f.r}
                  fill={isActive ? GOLD : "rgba(20,20,20,0.55)"}
                  stroke={isActive ? GOLD : "rgba(255,255,255,0.5)"}
                  strokeWidth="0.9"
                  style={{ transition: "fill 220ms ease, stroke 220ms ease" }}
                />
                <text
                  x={f.x} y={f.y + 2.8} fontSize="6"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fontWeight={700}
                  fill={isActive ? "#0d0d0d" : "rgba(255,255,255,0.82)"}
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {f.short}
                </text>
              </g>
            );
          })}

          {/* ═══ Stéthoscope animé ═══ */}
          <g
            style={{
              transform: `translate(${steth.x}px, ${steth.y}px)`,
              transition: "transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            pointerEvents="none"
          >
            <g transform="translate(0, -22)">
              <circle r="13" fill="rgba(166,124,30,0.20)" filter="url(#tv-glow)" />
              <circle r="7.5" fill="#0d0d0d" stroke={GOLD} strokeWidth="1.1" />
              <circle r="3" fill={GOLD}>
                <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <path
                d="M 0 -7.5 Q -8 -16 -18 -22 Q -28 -28 -34 -22"
                fill="none"
                stroke={GOLD}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Ombre portée 3D */}
      <div className="pointer-events-none absolute inset-x-12 -bottom-1 h-3 rounded-full bg-black/55 blur-md" />
    </div>
  );
}
