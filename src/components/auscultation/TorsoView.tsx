/**
 * TorsoView v9 — planche anatomique réelle + calque interactif SVG.
 *
 * Contrôle qualité : la v8 était un torse entièrement dessiné en SVG à la
 * main (côtes, cœur pseudo-3D, dégradés beiges) dont le rendu restait
 * amateur. On remplace le dessin par une planche authentique de Gray's
 * Anatomy (1918, domaine public) servie depuis Wikimedia Commons, et on
 * conserve toute l'interactivité dans un calque SVG transparent par-dessus
 * (marqueurs cliquables, stéthoscope, pulsations).
 *
 * Image : Heart-and-lungs.jpg — Gray's Anatomy of the Human Body (1918),
 * planche de Henry Vandyke Carter. Domaine public.
 * https://commons.wikimedia.org/wiki/File:Heart-and-lungs.jpg (600 × 585 px)
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
  /** Position en % de la largeur de l'image (0–100). */
  x: number;
  /** Position en % de la hauteur de l'image (0–100). */
  y: number;
  /** Rayon du marqueur, en unités du viewBox (600 × 585). */
  r: number;
}

/**
 * Foyers calibrés sur la planche Gray (vue antérieure) :
 * cœur au centre du médiastin, pointe orientée vers la gauche du patient
 * (droite de l'image). L'image fait 600 × 585 → % × 6 = viewBox.
 */
const CARDIO_FOYERS: Foyer[] = [
  { id: "aortique", label: "Aortique", short: "A", x: 44, y: 38, r: 15 },
  { id: "pulmonaire", label: "Pulmonaire", short: "P", x: 52, y: 34, r: 15 },
  { id: "erb", label: "Erb", short: "E", x: 51, y: 43, r: 14 },
  { id: "tricuspide", label: "Tricuspide", short: "T", x: 49, y: 52, r: 14 },
  { id: "mitral", label: "Mitral", short: "M", x: 58, y: 62, r: 15 },
];

const PULMO_FOYERS: Foyer[] = [
  { id: "trachee", label: "Trachée", short: "Trac", x: 50, y: 7, r: 16 },
  { id: "sommet-d", label: "Sommet D", short: "Somm", x: 26, y: 24, r: 16 },
  { id: "sommet-g", label: "Sommet G", short: "Somm", x: 74, y: 24, r: 16 },
  { id: "axillaire-d", label: "Axillaire D", short: "Axil", x: 14, y: 46, r: 16 },
  { id: "axillaire-g", label: "Axillaire G", short: "Axil", x: 86, y: 46, r: 16 },
  { id: "base-d", label: "Base D", short: "Base", x: 28, y: 71, r: 17 },
  { id: "base-g", label: "Base G", short: "Base", x: 72, y: 71, r: 17 },
  { id: "diffus", label: "Diffus", short: "Diff", x: 50, y: 84, r: 17 },
];

const GOLD = "#A67C1E";

const PLATE_URL =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Heart-and-lungs.jpg?width=1400";

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
  const ref = (name: string) => `${uid}-v9-${name}`;

  // La position du stéthoscope dérive de la prop activeFoyer.
  const steth = { x: active.x * 6, y: active.y * 5.85 };

  return (
    <figure
      className="relative m-0 overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-border)]"
      style={{
        background: "linear-gradient(160deg, #F8F3E7 0%, #EFE6D2 60%, #E8DCC4 100%)",
      }}
    >
      <div className="relative mx-auto w-full">
        <img
          src={PLATE_URL}
          alt="Thorax : cœur et poumons, vue antérieure (planche anatomique)"
          width={600}
          height={585}
          loading="lazy"
          className="block w-full select-none"
          style={{ aspectRatio: "600 / 585" }}
        />

        {/*
          Calque interactif : viewBox aligné pixel-pixel sur l'image (600×585),
          donc chaque marqueur tombe exactement au bon endroit.
        */}
        <svg
          viewBox="0 0 600 585"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0"
          role="img"
          aria-label={mode === "cardiaque" ? "Foyers d'auscultation cardiaque" : "Zones d'auscultation pulmonaire"}
          style={{ display: "block" }}
        >
          <defs>
            <filter id={ref("glow")} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>

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
                <circle
                  cx={cx}
                  cy={cy}
                  r={f.r}
                  fill={isActive ? GOLD : "#FFFFFF"}
                  stroke={isActive ? "#4A3208" : "#5A4020"}
                  strokeWidth="2.4"
                  style={{ transition: "fill 220ms ease, stroke 220ms ease" }}
                />
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

      {/* Attribution discrète — licence domaine public */}
      <figcaption className="px-3 py-1.5 text-center text-[10px] leading-tight text-subtle">
        Planche : Gray's Anatomy (1918), H. V. Carter — domaine public, via Wikimedia Commons
      </figcaption>
    </figure>
  );
}
