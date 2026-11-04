/**
 * TorsoView v11 — illustration thoracique vectorielle semi-réaliste.
 *
 * Historique qualité :
 * - v9 : foyers posés sur la planche 490 de Gray (1918) = organes isolés,
 *   sans repères de surface → placement faux (foyer mitral trop médial/bas).
 * - v10 : torse SVG schématique — positions exactes, rendu jugé trop plat.
 * - v11 : rendu semi-réaliste (modelé de la peau, ombres et lumières
 *   douces, clavicules/sternum en relief, silhouettes cardiaque et
 *   pulmonaires en filigrane) MAIS géométrie des repères strictement
 *   identique à la v10, donc positions de foyers toujours vérifiables :
 *
 *   Aortique   : 2ᵉ EIC droit, bord sternal droit (image : gauche du sternum)
 *   Pulmonaire : 2ᵉ EIC gauche, bord sternal gauche
 *   Erb        : 3ᵉ EIC gauche, bord sternal gauche
 *   Tricuspide : 4ᵉ-5ᵉ EIC, bord sternal gauche inférieur
 *   Mitral     : pointe apexienne, 5ᵉ EIC gauche sur la ligne
 *                médio-claviculaire (image : droite, ligne pointillée)
 *   Trachée    : incisure jugulaire
 *   Sommets    : au-dessus des clavicules ; Axillaires : latéraux,
 *                mi-thorax ; Bases : bases pulmonaires.
 *
 * Convention image : vue antérieure → la droite du PATIENT est à GAUCHE
 * de l'image (suffixes -d / -g = côté patient). Le cœur et les champs
 * pulmonaires en filigrane respectent cette convention (2/3 du cœur à
 * gauche du patient = à droite de l'image).
 */

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
  /** Position en % de la largeur du schéma (0–100). */
  x: number;
  /** Position en % de la hauteur du schéma (0–100). */
  y: number;
  /** Rayon du marqueur, en unités du viewBox (600 × 585). */
  r: number;
}

/**
 * Foyers cardiaques calés sur les repères du torse (vue de face) :
 * - sternum : x = 50 %, de l'incisure jugulaire au xiphoïde ;
 *   angle de Louis repère les 2ᵉ EIC ;
 * - ligne médio-claviculaire gauche : x = 71,7 % (pointillés).
 */
const CARDIO_FOYERS: Foyer[] = [
  // 2ᵉ EIC droit, bord sternal droit → légèrement à gauche de l'image.
  { id: "aortique", label: "Aortique", short: "A", x: 47.5, y: 27.5, r: 15 },
  // 2ᵉ EIC gauche, bord sternal gauche.
  { id: "pulmonaire", label: "Pulmonaire", short: "P", x: 52.5, y: 27.5, r: 15 },
  // 3ᵉ EIC gauche, bord sternal gauche.
  { id: "erb", label: "Erb", short: "E", x: 52.5, y: 32.5, r: 14 },
  // 4ᵉ-5ᵉ EIC, partie basse du sternum.
  { id: "tricuspide", label: "Tricuspide", short: "T", x: 51.5, y: 39.5, r: 14 },
  // Pointe : 5ᵉ EIC gauche, ligne médio-claviculaire (droite de l'image).
  { id: "mitral", label: "Mitral", short: "M", x: 71.7, y: 45.5, r: 15 },
];

const PULMO_FOYERS: Foyer[] = [
  // Incisure jugulaire.
  { id: "trachee", label: "Trachée", short: "Trac", x: 50, y: 17.5, r: 16 },
  // Sommets pulmonaires : au-dessus des clavicules.
  { id: "sommet-d", label: "Sommet D", short: "Somm", x: 37.5, y: 16.5, r: 16 },
  { id: "sommet-g", label: "Sommet G", short: "Somm", x: 62.5, y: 16.5, r: 16 },
  // Champs axillaires : mi-thorax, latéraux.
  { id: "axillaire-d", label: "Axillaire D", short: "Axil", x: 23, y: 42, r: 16 },
  { id: "axillaire-g", label: "Axillaire G", short: "Axil", x: 77, y: 42, r: 16 },
  // Bases pulmonaires.
  { id: "base-d", label: "Base D", short: "Base", x: 35, y: 63, r: 17 },
  { id: "base-g", label: "Base G", short: "Base", x: 65, y: 63, r: 17 },
  // Champ diffus antérieur.
  { id: "diffus", label: "Diffus", short: "Diff", x: 50, y: 67, r: 17 },
];

const GOLD = "#A67C1E";
const SKIN_LIGHT = "#F6D7B4";
const SKIN_BASE = "#E8B98F";
const SKIN_MID = "#D8A276";
const SKIN_SHADOW = "#BE8558";
const SKIN_DEEP = "#9C6642";
const GUIDE = "#C4A96B";

/** Silhouette du torse (cou + épaules + cage, coupée au rebord costal). */
const TORSO_PATH =
  "M 262 22 " +
  "C 262 58, 250 78, 208 92 " +
  "C 150 108, 108 122, 98 152 " +
  "C 90 178, 94 216, 102 272 " +
  "C 112 340, 124 420, 138 470 " +
  "L 462 470 " +
  "C 476 420, 488 340, 498 272 " +
  "C 506 216, 510 178, 502 152 " +
  "C 492 122, 450 108, 392 92 " +
  "C 350 78, 338 58, 338 22 Z";

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
  // partagent plus leurs <defs>.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `${uid}-v11-${name}`;

  // La position du stéthoscope dérive de la prop activeFoyer.
  const steth = { x: active.x * 6, y: active.y * 5.85 };

  return (
    <figure
      className="relative m-0 overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-border)]"
      style={{
        background: "linear-gradient(160deg, #FBF7EC 0%, #F2EADA 55%, #E9DFC9 100%)",
      }}
    >
      <div className="relative mx-auto w-full">
        {/*
          Illustration thoracique antérieure (600 × 585). La droite du
          patient est à gauche de l'image. Le modelé (ombres/lumières)
          est clippé sur la silhouette ; les repères (incisure jugulaire,
          clavicules, angle de Louis, sternum, lignes médio-claviculaires)
          gardent la géométrie exacte de la v10, sur laquelle les foyers
          sont calés.
        */}
        <svg
          viewBox="0 0 600 585"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="block w-full select-none"
          role="img"
          aria-label={
            mode === "cardiaque"
              ? "Foyers d'auscultation cardiaque sur un thorax antérieur"
              : "Zones d'auscultation pulmonaire sur un thorax antérieur"
          }
          style={{ display: "block" }}
        >
          <defs>
            <filter id={ref("glow")} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <filter id={ref("soft2")} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            <filter id={ref("soft4")} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id={ref("soft8")} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id={ref("soft14")} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <linearGradient id={ref("skin")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SKIN_LIGHT} />
              <stop offset="55%" stopColor={SKIN_BASE} />
              <stop offset="100%" stopColor={SKIN_MID} />
            </linearGradient>
            <radialGradient id={ref("chestLight")} cx="50%" cy="34%" r="62%">
              <stop offset="0%" stopColor="#FFF3E2" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#FFF3E2" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FFF3E2" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={ref("areola")} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#B5754F" />
              <stop offset="100%" stopColor="#9C6642" />
            </radialGradient>
            <clipPath id={ref("clip")}>
              <path d={TORSO_PATH} />
            </clipPath>
          </defs>

          {/* Corps : silhouette + fond de peau */}
          <path
            d={TORSO_PATH}
            fill={`url(#${ref("skin")})`}
            stroke={SKIN_SHADOW}
            strokeWidth="2"
            strokeOpacity="0.55"
          />

          {/*
            Modelé — tout ce calque est clippé sur la silhouette, donc
            les flous ne débordent jamais sur le fond de la carte.
          */}
          <g clipPath={`url(#${ref("clip")})`}>
            {/* Halo central : lumière diffuse sur le haut du sternum */}
            <rect x="0" y="0" width="600" height="585" fill={`url(#${ref("chestLight")})`} />

            {/* Flancs : assombrissement latéral (volume de la cage) */}
            <path
              d="M 114 168 C 102 214, 106 272, 116 340 C 124 400, 134 446, 148 474"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="34"
              opacity="0.5"
              filter={`url(#${ref("soft8")})`}
            />
            <path
              d="M 486 168 C 498 214, 494 272, 484 340 C 476 400, 466 446, 452 474"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="34"
              opacity="0.5"
              filter={`url(#${ref("soft8")})`}
            />

            {/* Creux des épaules (attache des deltoïdes) */}
            <path
              d="M 100 156 C 128 132, 162 118, 204 106"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="22"
              opacity="0.3"
              filter={`url(#${ref("soft8")})`}
            />
            <path
              d="M 500 156 C 472 132, 438 118, 396 106"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="22"
              opacity="0.3"
              filter={`url(#${ref("soft8")})`}
            />

            {/* Cou : ombres latérales des sterno-cléido-mastoïdiens */}
            <path
              d="M 268 28 C 262 66, 254 94, 238 114"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="12"
              opacity="0.4"
              filter={`url(#${ref("soft4")})`}
            />
            <path
              d="M 332 28 C 338 66, 346 94, 362 114"
              fill="none"
              stroke={SKIN_SHADOW}
              strokeWidth="12"
              opacity="0.4"
              filter={`url(#${ref("soft4")})`}
            />
            {/* Base du cou : ombre portée du maxillaire */}
            <ellipse
              cx="300"
              cy="30"
              rx="52"
              ry="20"
              fill={SKIN_DEEP}
              opacity="0.28"
              filter={`url(#${ref("soft8")})`}
            />

            {/* Encisure jugulaire (creux suprasternal) */}
            <ellipse cx="300" cy="124" rx="15" ry="8" fill={SKIN_DEEP} opacity="0.4" filter={`url(#${ref("soft2")})`} />
            <path
              d="M 286 132 Q 300 143, 314 132"
              fill="none"
              stroke="#FFEFD9"
              strokeWidth="3"
              opacity="0.55"
              filter={`url(#${ref("soft2")})`}
            />

            {/* Clavicules — arête en relief : ombre dessous + lumière dessus */}
            {/* Côté image-gauche (droite du patient) */}
            <path
              d="M 108 150 Q 205 108, 296 122"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="7"
              opacity="0.4"
              filter={`url(#${ref("soft4")})`}
            />
            <path
              d="M 108 148 Q 205 106, 296 118"
              fill="none"
              stroke="#FFF0DB"
              strokeWidth="3.4"
              opacity="0.7"
              filter={`url(#${ref("soft2")})`}
            />
            {/* Côté image-droite (gauche du patient) */}
            <path
              d="M 492 150 Q 395 108, 304 122"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="7"
              opacity="0.4"
              filter={`url(#${ref("soft4")})`}
            />
            <path
              d="M 492 148 Q 395 106, 304 118"
              fill="none"
              stroke="#FFF0DB"
              strokeWidth="3.4"
              opacity="0.7"
              filter={`url(#${ref("soft2")})`}
            />

            {/* Sternum : gouttière médiane + angle de Louis */}
            <path
              d="M 300 136 L 300 382"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="13"
              opacity="0.22"
              filter={`url(#${ref("soft4")})`}
            />
            <path d="M 291 150 L 291 368" fill="none" stroke="#FFF0DB" strokeWidth="3" opacity="0.35" filter={`url(#${ref("soft2")})`} />
            <path d="M 309 150 L 309 368" fill="none" stroke="#FFF0DB" strokeWidth="3" opacity="0.35" filter={`url(#${ref("soft2")})`} />
            <path d="M 288 158 L 312 158" fill="none" stroke={SKIN_DEEP} strokeWidth="6" opacity="0.3" filter={`url(#${ref("soft2")})`} />

            {/* Relief des grands pectoraux : sillon sous-pectorale */}
            <path
              d="M 300 302 C 258 322, 208 324, 164 300"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="9"
              opacity="0.2"
              filter={`url(#${ref("soft4")})`}
            />
            <path
              d="M 300 302 C 342 322, 392 324, 436 300"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="9"
              opacity="0.2"
              filter={`url(#${ref("soft4")})`}
            />

            {/* Arcs costaux : très discrets, liseré clair au-dessus d'une ombre */}
            {[195, 247, 299, 351].map((y) => (
              <g key={y}>
                <path
                  d={`M 150 ${y} Q 300 ${y + 30}, 450 ${y}`}
                  fill="none"
                  stroke="#FFEFD9"
                  strokeWidth="4"
                  opacity="0.14"
                  filter={`url(#${ref("soft2")})`}
                />
                <path
                  d={`M 150 ${y + 7} Q 300 ${y + 37}, 450 ${y + 7}`}
                  fill="none"
                  stroke={SKIN_DEEP}
                  strokeWidth="3"
                  opacity="0.08"
                  filter={`url(#${ref("soft2")})`}
                />
              </g>
            ))}

            {/* Mamelons : repère des lignes médio-claviculaires */}
            {[
              { cx: 172, cy: 296 },
              { cx: 428, cy: 296 },
            ].map((n) => (
              <g key={n.cx}>
                <ellipse cx={n.cx} cy={n.cy + 3} rx="13" ry="6" fill={SKIN_DEEP} opacity="0.18" filter={`url(#${ref("soft2")})`} />
                <circle cx={n.cx} cy={n.cy} r="13" fill={`url(#${ref("areola")})`} opacity="0.85" />
                <circle cx={n.cx} cy={n.cy} r="5" fill="#8A5636" />
                <circle cx={n.cx - 2} cy={n.cy - 2} r="1.8" fill="#FFE9D2" opacity="0.7" />
              </g>
            ))}

            {/* Rebord costal : crête en lumière + ombre sous-jacente */}
            <path
              d="M 300 388 Q 216 420, 168 462"
              fill="none"
              stroke="#FFEFD9"
              strokeWidth="4"
              opacity="0.4"
              filter={`url(#${ref("soft2")})`}
            />
            <path
              d="M 300 394 Q 220 428, 174 468"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="8"
              opacity="0.24"
              filter={`url(#${ref("soft4")})`}
            />
            <path
              d="M 300 388 Q 384 420, 432 462"
              fill="none"
              stroke="#FFEFD9"
              strokeWidth="4"
              opacity="0.4"
              filter={`url(#${ref("soft2")})`}
            />
            <path
              d="M 300 394 Q 380 428, 426 468"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="8"
              opacity="0.24"
              filter={`url(#${ref("soft4")})`}
            />

            {/* Silhouettes en filigrane : champs pulmonaires */}
            <path
              d={
                "M 196 100 C 172 106, 156 128, 150 165 " +
                "C 144 210, 146 270, 152 320 " +
                "C 156 350, 166 372, 182 380 " +
                "C 206 388, 240 382, 268 362 " +
                "C 282 350, 286 300, 284 240 " +
                "C 283 190, 278 140, 262 116 " +
                "C 246 100, 216 96, 196 100 Z"
              }
              fill="#5E86B8"
              fillOpacity="0.08"
              stroke="#4C6FA0"
              strokeOpacity="0.35"
              strokeWidth="1.6"
              strokeDasharray="6 5"
            />
            <path
              d={
                "M 404 100 C 428 106, 444 128, 450 165 " +
                "C 456 210, 454 270, 448 320 " +
                "C 444 350, 434 372, 418 380 " +
                "C 394 388, 360 382, 334 362 " +
                "C 322 352, 316 330, 318 288 " +
                "C 320 240, 330 196, 346 164 " +
                "C 360 138, 384 96, 404 100 Z"
              }
              fill="#5E86B8"
              fillOpacity="0.08"
              stroke="#4C6FA0"
              strokeOpacity="0.35"
              strokeWidth="1.6"
              strokeDasharray="6 5"
            />

            {/* Silhouette en filigrane : cœur, apex sur le foyer mitral */}
            <path
              d={
                "M 296 160 " +
                "C 318 146, 348 148, 366 166 " +
                "C 388 190, 414 224, 432 250 " +
                "C 441 263, 440 274, 426 272 " +
                "C 402 269, 372 260, 350 249 " +
                "C 324 236, 302 214, 294 192 " +
                "C 290 180, 290 168, 296 160 Z"
              }
              fill="#B85C5C"
              fillOpacity="0.1"
              stroke="#A04646"
              strokeOpacity="0.4"
              strokeWidth="1.6"
              strokeDasharray="6 5"
            />

            {/* Lignes médio-claviculaires (repère du foyer mitral) */}
            <path d="M 172 160 L 176 430" stroke={GUIDE} strokeWidth="1.6" strokeDasharray="5 6" opacity="0.45" fill="none" />
            <path d="M 428 160 L 424 430" stroke={GUIDE} strokeWidth="1.6" strokeDasharray="5 6" opacity="0.45" fill="none" />
          </g>

          {/*
            Calque interactif : chaque marqueur tombe sur son repère —
            aortique/pulmonaire encadrent le sternum au niveau de l'angle
            de Louis, mitral sur la ligne médio-claviculaire droite de
            l'image (apex de la silhouette cardiaque).
          */}
          {foyers.map((f) => {
            const cx = f.x * 6;
            const cy = f.y * 5.85;
            const isActive = f.id === activeFoyer;
            return (
              <g
                key={f.id}
                onClick={() => onFoyerClick?.(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFoyerClick?.(f.id);
                  }
                }}
                role={onFoyerClick ? "button" : undefined}
                tabIndex={onFoyerClick ? 0 : -1}
                aria-label={mode === "cardiaque" ? `Foyer ${f.label}` : `Zone ${f.label}`}
                aria-pressed={isActive}
                style={{ cursor: onFoyerClick ? "pointer" : "default" }}
                data-foyer={f.id}
                data-active={isActive ? "true" : "false"}
              >
                {isActive && (
                  <>
                    <circle cx={cx} cy={cy} r={f.r + 4} fill="none" stroke={GOLD} strokeWidth="2">
                      <animate attributeName="r" from={f.r + 4} to={f.r + 34} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.85" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r={f.r + 4} fill="none" stroke={GOLD} strokeWidth="2">
                      <animate attributeName="r" from={f.r + 4} to={f.r + 34} dur="1.8s" begin="0.9s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.85" to="0" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                <circle cx={cx} cy={cy} r={f.r} fill="rgba(255,252,242,0.92)" opacity="0.95" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={f.r}
                  fill="none"
                  stroke={isActive ? "#4A3208" : "#5A4020"}
                  strokeWidth="2.4"
                  style={{ transition: "stroke 220ms ease" }}
                />
                <circle cx={cx} cy={cy} r={f.r - 5} fill={isActive ? GOLD : "none"} opacity={isActive ? "0.5" : "0"} style={{ transition: "fill 220ms ease, opacity 220ms ease" }} />
                <text
                  x={cx}
                  y={cy + 4}
                  fontSize="11"
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

          {/* Stéthoscope qui suit le foyer actif */}
          <g
            style={{
              transform: `translate(${steth.x}px, ${steth.y}px)`,
              transition: "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            pointerEvents="none"
          >
            <g transform="translate(0, -26)">
              <circle r="17" fill={GOLD} opacity="0.20" filter={`url(#${ref("glow")})`} />
              <circle r="10" fill="#F5E8C8" stroke={GOLD} strokeWidth="2.2" />
              <circle r="3.4" fill={GOLD}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <path
                d="M 0 -10 Q -13 -21 -28 -30 Q -42 -40 -52 -30"
                fill="none"
                stroke={GOLD}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.65"
              />
            </g>
          </g>
        </svg>
      </div>

      <figcaption className="px-3 py-1.5 text-center text-[10px] leading-tight text-subtle">
        Thorax antérieur — repères de surface (clavicules, sternum, lignes médio-claviculaires), cœur et poumons en filigrane (vue de face, droite du patient à gauche)
      </figcaption>
    </figure>
  );
}
