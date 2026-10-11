/** TorsoView v8 — illustration médicale (inspirée Gray's / Netter-pro). */

import { useId } from "react";

export type FoyerId =
  | "aortique"
  | "pulmonaire"
  | "erb"
  | "tricuspide"
  | "mitral"
  | "trachee"
  | "sommet-d"
  | "sommet-g"
  | "base-d"
  | "base-g"
  | "axillaire-d"
  | "axillaire-g"
  | "diffus";

interface Foyer {
  id: FoyerId;
  label: string;
  short: string;
  x: number;
  y: number;
  r: number;
}

// Foyers calibrés sur les proportions anatomiques réelles
const CARDIO_FOYERS: Foyer[] = [
  { id: "aortique", label: "Aortique", short: "A", x: 106, y: 80, r: 5 },
  { id: "pulmonaire", label: "Pulmonaire", short: "P", x: 130, y: 78, r: 5 },
  { id: "erb", label: "Erb", short: "E", x: 130, y: 94, r: 4.8 },
  { id: "tricuspide", label: "Tricuspide", short: "T", x: 124, y: 108, r: 4.8 },
  { id: "mitral", label: "Mitral", short: "M", x: 146, y: 152, r: 5.2 },
];

const PULMO_FOYERS: Foyer[] = [
  { id: "trachee", label: "Trachée", short: "Trac", x: 120, y: 20, r: 6 },
  { id: "sommet-d", label: "Sommet D", short: "Somm", x: 70, y: 82, r: 6 },
  { id: "sommet-g", label: "Sommet G", short: "Somm", x: 170, y: 82, r: 6 },
  { id: "axillaire-d", label: "Axillaire D", short: "Axil", x: 40, y: 138, r: 6 },
  { id: "axillaire-g", label: "Axillaire G", short: "Axil", x: 200, y: 138, r: 6 },
  { id: "base-d", label: "Base D", short: "Base", x: 70, y: 198, r: 6.5 },
  { id: "base-g", label: "Base G", short: "Base", x: 170, y: 198, r: 6.5 },
  { id: "diffus", label: "Diffus", short: "Diff", x: 120, y: 240, r: 6.5 },
];

// 12 paires — sy = attache sternale, ey = latéral, ex = rayon
const RIBS = [
  { sy: 66, ey: 82, ex: 50 },
  { sy: 76, ey: 94, ex: 42 },
  { sy: 86, ey: 106, ex: 36 },
  { sy: 96, ey: 118, ex: 31 },
  { sy: 106, ey: 130, ex: 28 },
  { sy: 116, ey: 142, ex: 26 },
  { sy: 126, ey: 152, ex: 25 },
  { sy: 135, ey: 161, ex: 25 },
  { sy: 143, ey: 169, ex: 26 },
  { sy: 150, ey: 176, ex: 29 },
  { sy: 156, ey: 182, ex: 33 },
  { sy: 162, ey: 188, ex: 38 },
];

const GOLD = "#A67C1E";

export function TorsoView({
  mode,
  activeFoyer,
  onFoyerClick,
  height = 260,
}: {
  mode: "cardiaque" | "pulmonaire";
  activeFoyer?: FoyerId;
  onFoyerClick?: (id: FoyerId) => void;
  height?: number;
}) {
  const foyers = mode === "cardiaque" ? CARDIO_FOYERS : PULMO_FOYERS;
  const active = foyers.find((f) => f.id === activeFoyer) ?? foyers[0];

  // Ids SVG préfixés par instance : deux TorsoView sur une même page ne
  // partagent plus leurs <defs> (dégradés/filtres se volaient la définition).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `${uid}-v8-${name}`;

  // La position du stéthoscope DÉRIVE de la prop activeFoyer : un état local
  // resynchronisé par useEffect était redondant (et créait un render en plus).
  const steth = { x: active.x, y: active.y };

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-border)]"
      style={{
        background: "linear-gradient(160deg, #F8F3E7 0%, #EFE6D2 60%, #E8DCC4 100%)",
      }}
    >
      <svg
        viewBox="0 0 240 280"
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Thorax anatomique"
        style={{ display: "block" }}
      >
        <defs>
          {/* Os : crème clair → ombre beige */}
          <linearGradient id={ref("bone")} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#FFF0D4" />
            <stop offset="35%" stopColor="#E5D2A8" />
            <stop offset="75%" stopColor="#C0A670" />
            <stop offset="100%" stopColor="#9A7A48" />
          </linearGradient>
          <linearGradient id={ref("bone-shadow")} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#C9A878" />
            <stop offset="100%" stopColor="#8B6B42" />
          </linearGradient>
          {/* Cartilage costal : bleu-gris */}
          <linearGradient id={ref("cart")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4E2F0" />
            <stop offset="100%" stopColor="#A8C4D8" />
          </linearGradient>
          {/* Cœur réaliste */}
          <radialGradient id={ref("heart")} cx="38%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#F49090" />
            <stop offset="20%" stopColor="#E87D7D" />
            <stop offset="45%" stopColor="#D95050" />
            <stop offset="72%" stopColor="#B83030" />
            <stop offset="100%" stopColor="#7A1818" />
          </radialGradient>
          {/* Poumons très subtils */}
          <radialGradient id={ref("lung")} cx="50%" cy="40%" r="72%">
            <stop offset="0%" stopColor="#DBE8F3" />
            <stop offset="70%" stopColor="#B8D0E8" />
            <stop offset="100%" stopColor="#98B5D2" />
          </radialGradient>
          {/* Peau / tronc */}
          <linearGradient id={ref("skin")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0E4CE" />
            <stop offset="100%" stopColor="#DCC9A8" />
          </linearGradient>
          {/* Aorte */}
          <linearGradient id={ref("aorta")} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#D96060" />
            <stop offset="100%" stopColor="#A03030" />
          </linearGradient>
          {/* Trachée */}
          <linearGradient id={ref("airway")} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#DBE8F3" />
            <stop offset="100%" stopColor="#B8CCE0" />
          </linearGradient>
          <filter id={ref("shadow")} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" />
            <feOffset dx="1.2" dy="2" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.42" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ref("glow")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        {/* Silhouette du tronc — crème clair */}
        <path
          d="M 100 6 L 100 20 Q 100 32 88 42 Q 62 52 38 58 Q 18 62 15 82 Q 14 108 18 138 Q 22 175 26 210 L 28 258 L 212 258 L 214 210 Q 218 175 222 138 Q 226 108 225 82 Q 222 62 202 58 Q 178 52 152 42 Q 140 32 140 20 L 140 6 Z"
          fill={`url(#${ref("skin")})`}
          stroke="#C9AE84"
          strokeWidth="0.9"
          opacity="0.65"
        />

        {/* Creux axillaire gauche / droit */}
        <ellipse cx="38" cy="112" rx="16" ry="20" fill="#D4BC94" opacity="0.25" />
        <ellipse cx="202" cy="112" rx="16" ry="20" fill="#D4BC94" opacity="0.25" />

        {/* Sternum — manubrium + corps + xiphoïde */}
        <g filter={`url(#${ref("shadow")})`}>
          <path
            d="M 114 48 L 126 48 L 126 74 L 114 74 Z"
            fill={`url(#${ref("bone")})`}
            stroke="#8B6B42"
            strokeWidth="0.7"
          />
          <path
            d="M 114 74 L 126 74 L 126 158 L 114 158 Z"
            fill={`url(#${ref("bone")})`}
            stroke="#8B6B42"
            strokeWidth="0.7"
          />

          <path
            d="M 117 158 L 123 158 L 121 176 L 119 176 Z"
            fill={`url(#${ref("bone")})`}
            stroke="#8B6B42"
            strokeWidth="0.6"
          />
        </g>
        {/* Angle de Louis (T4-T5) */}
        <line x1="114" y1="74" x2="126" y2="74" stroke="#8B6B42" strokeWidth="0.6" />

        {/* Clavicules — S-curve */}
        <g filter={`url(#${ref("shadow")})`}>
          <path
            d="M 118 50 Q 96 40 68 42 Q 48 44 38 52"
            fill="none"
            stroke={`url(#${ref("bone")})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 122 50 Q 144 40 172 42 Q 192 44 202 52"
            fill="none"
            stroke={`url(#${ref("bone")})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Highlight supérieur */}
          <path
            d="M 118 49 Q 96 39 68 41 Q 48 43 38 51"
            fill="none"
            stroke="#FFF5DC"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M 122 49 Q 144 39 172 41 Q 192 43 202 51"
            fill="none"
            stroke="#FFF5DC"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>

        {/* Incisure sus-sternale */}
        <path d="M 114 46 Q 120 42 126 46" fill="none" stroke="#8B6B42" strokeWidth="0.6" />

        {/* Poumons en arrière-plan (fantôme bleu-gris) */}
        <path
          d="M 100 68 Q 68 74 52 108 Q 42 148 48 188 Q 58 216 82 224 Q 96 220 100 198 Q 102 160 100 116 Z"
          fill={`url(#${ref("lung")})`}
          opacity="0.92"
        />
        <path
          d="M 140 68 Q 172 74 188 108 Q 198 148 192 188 Q 182 216 158 224 Q 144 220 140 198 Q 138 160 140 116 Z"
          fill={`url(#${ref("lung")})`}
          opacity="0.92"
        />

        {/* 12 paires de côtes — post → angle → ant → cartilage */}
        {RIBS.map((r, i) => {
          const op = 0.85 + (11 - i) * 0.012;
          const xR = 112;
          const xL = 128;
          const cxR = (xR + r.ex) / 2;
          const cxL = (xL + (240 - r.ex)) / 2;
          const isLastTwo = i >= 10;
          const isFalse = i >= 7;
          return (
            <g key={`rib-${i}`} opacity={op}>
              {/* Côte droite */}
              <path
                d={`M ${xR} ${r.sy} Q ${cxR} ${r.sy + 2} ${r.ex} ${r.ey}`}
                fill="none"
                stroke={`url(#${ref("bone")})`}
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path
                d={`M ${xR} ${r.sy - 0.5} Q ${cxR} ${r.sy + 4.4} ${r.ex} ${r.ey - 0.5}`}
                fill="none"
                stroke="#FFF5DC"
                strokeWidth="0.6"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d={`M ${xR} ${r.sy + 0.7} Q ${cxR} ${r.sy + 5.7} ${r.ex} ${r.ey + 0.7}`}
                fill="none"
                stroke="#5A3E1E"
                strokeWidth="0.85"
                strokeLinecap="round"
                opacity="0.95"
              />

              {/* Côte gauche */}
              <path
                d={`M ${xL} ${r.sy} Q ${cxL} ${r.sy + 5} ${240 - r.ex} ${r.ey}`}
                fill="none"
                stroke={`url(#${ref("bone")})`}
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path
                d={`M ${xL} ${r.sy - 0.5} Q ${cxL} ${r.sy + 4.4} ${240 - r.ex} ${r.ey - 0.5}`}
                fill="none"
                stroke="#FFF5DC"
                strokeWidth="0.6"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d={`M ${xL} ${r.sy + 0.7} Q ${cxL} ${r.sy + 5.7} ${240 - r.ex} ${r.ey + 0.7}`}
                fill="none"
                stroke="#5A3E1E"
                strokeWidth="0.85"
                strokeLinecap="round"
                opacity="0.95"
              />

              {/* Cartilages costaux (côtes 1-7 = vraies côtes avec cartilage sternal direct) */}
              {i < 7 && (
                <>
                  {/* Cartilage D — extension vers le sternum */}
                  <path
                    d={`M ${r.ex} ${r.ey} Q ${r.ex + 12} ${r.ey + 4} 114 ${r.sy + 8}`}
                    fill="none"
                    stroke={`url(#${ref("cart")})`}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${r.ex} ${r.ey - 0.4} Q ${r.ex + 12} ${r.ey + 3.6} 114 ${r.sy + 7.6}`}
                    fill="none"
                    stroke="#EAF2F8"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  {/* Cartilage G */}
                  <path
                    d={`M ${240 - r.ex} ${r.ey} Q ${240 - r.ex - 12} ${r.ey + 4} 126 ${r.sy + 8}`}
                    fill="none"
                    stroke={`url(#${ref("cart")})`}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${240 - r.ex} ${r.ey - 0.4} Q ${240 - r.ex - 12} ${r.ey + 3.6} 126 ${r.sy + 7.6}`}
                    fill="none"
                    stroke="#EAF2F8"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </>
              )}
              {/* Fausses côtes (8-10) : cartilage commun */}
              {isFalse && !isLastTwo && (
                <>
                  <path
                    d={`M ${r.ex} ${r.ey} Q ${r.ex + 18} ${r.ey + 6} 120 ${r.ey - 12}`}
                    fill="none"
                    stroke={`url(#${ref("cart")})`}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <path
                    d={`M ${240 - r.ex} ${r.ey} Q ${240 - r.ex - 18} ${r.ey + 6} 120 ${r.ey - 12}`}
                    fill="none"
                    stroke={`url(#${ref("cart")})`}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </>
              )}
            </g>
          );
        })}

        {/* Légende côtes flottantes (11-12) : pointillés */}
        <path
          d="M 30 195 Q 22 200 20 205"
          fill="none"
          stroke="#8B6B42"
          strokeWidth="0.4"
          strokeDasharray="2 2"
          opacity="0.5"
        />
        <path
          d="M 210 195 Q 218 200 220 205"
          fill="none"
          stroke="#8B6B42"
          strokeWidth="0.4"
          strokeDasharray="2 2"
          opacity="0.5"
        />

        {/* Veines jugulaires */}
        <path
          d="M 106 4 L 106 36 Q 108 44 112 48"
          fill="none"
          stroke="#6A8ABA"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.65"
        />
        <path
          d="M 134 4 L 134 36 Q 132 44 128 48"
          fill="none"
          stroke="#6A8ABA"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* Trachée + bronches */}
        <path
          d="M 116 4 L 116 58 Q 118 72 120 78"
          fill="none"
          stroke={`url(#${ref("airway")})`}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 124 4 L 124 58 Q 122 72 120 78"
          fill="none"
          stroke="#9FB8CC"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        {[12, 20, 28, 36, 44, 52].map((y) => (
          <line
            key={`ta-${y}`}
            x1="115.5"
            y1={y}
            x2="124.5"
            y2={y}
            stroke="#9FB8CC"
            strokeWidth="0.5"
          />
        ))}
        <path
          d="M 120 78 Q 106 88 92 100"
          fill="none"
          stroke={`url(#${ref("airway")})`}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 120 78 Q 134 88 148 100"
          fill="none"
          stroke={`url(#${ref("airway")})`}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Cœur — anatomique, 4 cavités visibles */}
        <g filter={`url(#${ref("shadow")})`}>
          {/* Silhouette externe : cône incliné vers la gauche */}
          <path
            d="M 122 100
                   Q 114 108 114 122
                   Q 116 138 124 148
                   Q 130 156 140 156
                   Q 150 150 154 138
                   Q 158 122 152 106
                   Q 146 98 134 96
                   Q 126 96 122 100 Z"
            fill={`url(#${ref("heart")})`}
            stroke="#6B1515"
            strokeWidth="1.1"
          />
        </g>

        {/* OD — oreillette droite (en haut, à gauche) */}
        <path
          d="M 118 106 Q 112 116 116 126 Q 124 122 124 110 Q 122 104 118 106 Z"
          fill="#F09090"
          stroke="#8B2020"
          strokeWidth="0.6"
        />
        {/* OG — oreillette gauche (en haut, à droite) */}
        <path
          d="M 136 102 Q 148 104 154 114 Q 148 118 138 116 Q 132 108 136 102 Z"
          fill="#E87D7D"
          stroke="#8B2020"
          strokeWidth="0.6"
        />
        {/* VD — ventricule droit (masse gauche, plus fine) */}
        <path
          d="M 116 128 Q 124 124 132 130 Q 132 148 126 158 Q 118 152 114 140 Q 112 132 116 128 Z"
          fill="#D96060"
          opacity="0.7"
        />
        {/* VG — ventricule gauche (masse principale, forme de cône) */}
        <path
          d="M 136 130 Q 150 126 154 138 Q 156 152 148 162 Q 138 166 132 156 Q 128 144 136 130 Z"
          fill="#C03838"
          opacity="0.85"
        />

        {/* Sillon interventriculaire antérieur (IVA) */}
        <path
          d="M 134 128 Q 134 144 130 158"
          fill="none"
          stroke="#5A0A0A"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Sillon auriculo-ventriculaire (coronaire) */}
        <path
          d="M 118 128 Q 136 124 152 130"
          fill="none"
          stroke="#9A2525"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Coronaires : IVA + circonflexe + droite */}
        <path
          d="M 134 128 Q 134 148 128 162"
          fill="none"
          stroke="#D03030"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 150 130 Q 154 140 148 152"
          fill="none"
          stroke="#B82828"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M 118 128 Q 116 138 120 146"
          fill="none"
          stroke="#B82828"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Highlight spéculaire (lumière du haut-gauche) */}
        <path
          d="M 122 108 Q 128 104 138 106 Q 130 112 124 116 Q 120 112 122 108 Z"
          fill="#FFFFFF"
          opacity="0.22"
          filter={`url(#${ref("glow")})`}
        />

        {/* Battement cardiaque */}
        <circle
          cx="134"
          cy="132"
          r="22"
          fill="#E85D5D"
          opacity="0.10"
          filter={`url(#${ref("glow")})`}
        >
          <animate attributeName="r" values="22;28;22" dur="1.25s" repeatCount="indefinite" />
          <animate
            attributeName="opacity"
            values="0.10;0.22;0.10"
            dur="1.25s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Aorte */}
        <path
          d="M 148 100 L 148 78"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path
          d="M 148 78 Q 148 62 132 62 Q 118 62 118 78"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path
          d="M 118 78 L 118 95"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M 154 72 Q 155 54 156 40"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 164 72 Q 165 54 166 40"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M 172 76 Q 174 58 176 44"
          fill="none"
          stroke={`url(#${ref("aorta")})`}
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Diaphragme */}
        <path
          d="M 30 218 Q 62 196 120 208 Q 178 196 210 218 Q 196 244 120 248 Q 44 244 30 218 Z"
          fill="#E8D8B0"
          stroke="#B89870"
          strokeWidth="0.7"
          opacity="0.55"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 2.5; 0 0"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d="M 34 216 Q 66 192 120 204"
          fill="none"
          stroke="#B89870"
          strokeWidth="0.4"
          strokeDasharray="3 2"
          opacity="0.6"
        />
        <path
          d="M 120 204 Q 174 192 206 216"
          fill="none"
          stroke="#B89870"
          strokeWidth="0.4"
          strokeDasharray="3 2"
          opacity="0.6"
        />
        <ellipse cx="120" cy="222" rx="20" ry="4" fill="#F5E8C8" opacity="0.5" />

        {/* Repères médio-claviculaires */}
        <line
          x1="72"
          y1="60"
          x2="72"
          y2="252"
          stroke="#A67C1E"
          strokeWidth="0.55"
          strokeDasharray="4 4"
          opacity="0.55"
        />
        <line
          x1="168"
          y1="60"
          x2="168"
          y2="252"
          stroke="#A67C1E"
          strokeWidth="0.55"
          strokeDasharray="4 4"
          opacity="0.55"
        />

        {/* Numéros des espaces intercostaux — côté droit du patient (gauche écran) */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          // EIC 1 = entre côtes 1 et 2 ; progression de ~11px par EIC
          const y = 72 + (n - 1) * 11;
          return (
            <g key={`eic-${n}`}>
              <text
                x="48"
                y={y + 3}
                fontSize="5.6"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                fontWeight={600}
                fill="#7A5A34"
                textAnchor="end"
                opacity="0.85"
              >
                {n}
              </text>
              <line
                x1="50"
                y1={y}
                x2="58"
                y2={y}
                stroke="#7A5A34"
                strokeWidth="0.4"
                opacity="0.6"
              />
            </g>
          );
        })}
        {/* Titre du repère EIC */}
        <text
          x="36"
          y="64"
          fontSize="5"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          fontWeight={700}
          fill="#7A5A34"
          textAnchor="end"
          letterSpacing="0.05em"
        >
          EIC
        </text>

        {/* Repères vertébraux T1 / T4 / T12 */}
        <g opacity="0.55">
          <text
            x="158"
            y="20"
            fontSize="5"
            fontFamily="ui-monospace"
            fill="#7A5A34"
            fontWeight={600}
          >
            T1
          </text>
          <text
            x="158"
            y="180"
            fontSize="5"
            fontFamily="ui-monospace"
            fill="#7A5A34"
            fontWeight={600}
          >
            T12
          </text>
          <line x1="156" y1="18" x2="162" y2="18" stroke="#7A5A34" strokeWidth="0.35" />
          <line x1="156" y1="178" x2="162" y2="178" stroke="#7A5A34" strokeWidth="0.35" />
        </g>

        {/* Lignes axillaires antérieures */}
        <line
          x1="42"
          y1="70"
          x2="42"
          y2="250"
          stroke="#A67C1E"
          strokeWidth="0.4"
          strokeDasharray="2 6"
          opacity="0.35"
        />
        <line
          x1="198"
          y1="70"
          x2="198"
          y2="250"
          stroke="#A67C1E"
          strokeWidth="0.4"
          strokeDasharray="2 6"
          opacity="0.35"
        />

        {/* ═══ Lignes de projection : foyer externe → valve interne ═══ */}
        {mode === "cardiaque" && (
          <g opacity="0.55">
            <path
              d="M 106 82 Q 112 96 124 112"
              fill="none"
              stroke="#A67C1E"
              strokeWidth="0.5"
              strokeDasharray="1.5 2"
              strokeLinecap="round"
            />
            <path
              d="M 132 82 L 130 104"
              fill="none"
              stroke="#A67C1E"
              strokeWidth="0.5"
              strokeDasharray="1.5 2"
              strokeLinecap="round"
            />
            <path
              d="M 132 118 Q 128 124 124 128"
              fill="none"
              stroke="#A67C1E"
              strokeWidth="0.5"
              strokeDasharray="1.5 2"
              strokeLinecap="round"
            />
            <path
              d="M 144 150 Q 141 142 138 134"
              fill="none"
              stroke="#A67C1E"
              strokeWidth="0.5"
              strokeDasharray="1.5 2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Veines pulmonaires */}
        <path
          d="M 108 116 Q 116 114 122 116"
          fill="none"
          stroke="#5A7FB0"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M 108 130 Q 116 128 122 130"
          fill="none"
          stroke="#5A7FB0"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M 158 116 Q 150 114 144 116"
          fill="none"
          stroke="#5A7FB0"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M 158 130 Q 150 128 144 130"
          fill="none"
          stroke="#5A7FB0"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Foyers auscultatoires */}
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
                  <circle cx={f.x} cy={f.y} r={f.r + 3} fill="none" stroke={GOLD} strokeWidth="1.1">
                    <animate
                      attributeName="r"
                      from={f.r + 3}
                      to={f.r + 22}
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.85"
                      to="0"
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx={f.x} cy={f.y} r={f.r + 3} fill="none" stroke={GOLD} strokeWidth="1.1">
                    <animate
                      attributeName="r"
                      from={f.r + 3}
                      to={f.r + 22}
                      dur="1.8s"
                      begin="0.9s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.85"
                      to="0"
                      dur="1.8s"
                      begin="0.9s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}
              <circle
                cx={f.x}
                cy={f.y}
                r={f.r}
                fill={isActive ? GOLD : "#FFFFFF"}
                stroke={isActive ? "#4A3208" : "#5A4020"}
                strokeWidth="1.4"
                style={{ transition: "fill 220ms ease, stroke 220ms ease" }}
              />
              <text
                x={f.x}
                y={f.y + 2.8}
                fontSize="7"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                fontWeight={700}
                fill={isActive ? "#1A1205" : "#2A1E0A"}
                textAnchor="middle"
                style={{ pointerEvents: "none" }}
              >
                {f.short}
              </text>
            </g>
          );
        })}

        {/* Stéthoscope */}
        <g
          style={{
            transform: `translate(${steth.x}px, ${steth.y}px)`,
            transition: "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          pointerEvents="none"
        >
          <g transform="translate(0, -14)">
            <circle r="9" fill="#A67C1E" opacity="0.20" filter={`url(#${ref("glow")})`} />
            <circle r="5" fill="#F5E8C8" stroke={GOLD} strokeWidth="1.2" />
            <circle r="5" fill="none" stroke="#7A5A10" strokeWidth="0.3" />
            <circle r="1.8" fill={GOLD}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="1.4s"
                repeatCount="indefinite"
              />
            </circle>
            <path
              d="M 0 -5 Q -7 -11 -15 -16 Q -22 -21 -28 -16"
              fill="none"
              stroke={GOLD}
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.65"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
