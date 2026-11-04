/**
 * TorsoView v10 — schéma thoracique SVG + calque interactif.
 *
 * Contrôle qualité : la v9 posait les foyers sur la figure 490 de Gray
 * (1918), « Front view of heart and lungs » — une planche d'ORGANES
 * isolés (cœur et poumons prélevés), sans repères de surface (pas de
 * clavicules exploitables, pas de sternum repérable, pas d'épaules).
 * Des coordonnées en % ne pouvaient pas tomber juste, et le foyer mitral
 * était notamment trop médial et trop bas.
 *
 * La v10 dessine un torse schématique ANTERIEUR directement en SVG, avec
 * ses repères de surface (incisure jugulaire, clavicules, angle de Louis,
 * corps du sternum, lignes médio-claviculaires, rebord costal). Chaque
 * foyer est alors placé sur son vrai repère anatomique — la position est
 * vérifiable dans le code, pas devinée sur une photo :
 *
 *   Aortique   : 2ᵉ EIC droit, bord sternal droit (image : gauche du sternum)
 *   Pulmonaire : 2ᵉ EIC gauche, bord sternal gauche
 *   Erb        : 3ᵉ EIC gauche, bord sternal gauche
 *   Tricuspide : 4ᵉ-5ᵉ EIC, bord sternal gauche inférieur
 *   Mitral     : pointe apexienne, 5ᵉ EIC gauche sur la ligne
 *                médio-claviculaire (image : droite, ligne pointillée)
 *   Trachée    : incisure jugulaire
 *   Sommets    : au-dessus des clavicules ; Axillaires : ligne
 *                médio-claviculaire, mi-thorax ; Bases : bases pulmonaires.
 *
 * Convention image : vue antérieure → la droite du PATIENT est à GAUCHE
 * de l'image (suffixes -d / -g = côté patient).
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
 * Foyers cardiaques calés sur les repères du schéma (vue de face) :
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
const INK = "#8A744E";
const SKIN = "#F8F0DE";
const SKIN_EDGE = "#C9B58C";
const BONE = "#B39C6F";
const GUIDE = "#C4A96B";

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
  const ref = (name: string) => `${uid}-v10-${name}`;

  // La position du stéthoscope dérive de la prop activeFoyer.
  const steth = { x: active.x * 6, y: active.y * 5.85 };

  // Arcs costaux : 4 arcs discrets par hémithorax.
  const ribs = [1, 2, 3, 4].map((i) => {
    const y = 195 + (i - 1) * 52;
    return { y, d: `M 150 ${y} Q 300 ${y + 30}, 450 ${y}` };
  });

  return (
    <figure
      className="relative m-0 overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-border)]"
      style={{
        background: "linear-gradient(160deg, #F8F3E7 0%, #EFE6D2 60%, #E8DCC4 100%)",
      }}
    >
      <div className="relative mx-auto w-full">
        {/*
          Schéma thoracique antérieur (600 × 585). La droite du patient
          est à gauche de l'image. Repères dessinés : incisure jugulaire,
          clavicules, sternum (angle de Louis marqué), arcs costaux,
          rebord costal, lignes médio-claviculaires en pointillés.
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
              ? "Foyers d'auscultation cardiaque sur un schéma thoracique antérieur"
              : "Zones d'auscultation pulmonaire sur un schéma thoracique antérieur"
          }
          style={{ display: "block" }}
        >
          <defs>
            <filter id={ref("glow")} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <radialGradient id={ref("torso")} cx="50%" cy="38%" r="75%">
              <stop offset="0%" stopColor="#FBF5E7" />
              <stop offset="100%" stopColor={SKIN} />
            </radialGradient>
          </defs>

          {/* Silhouette du torse (cou + épaules + cage, coupé au rebord costal) */}
          <path
            d={
              "M 262 22 " +
              "C 262 58, 250 78, 208 92 " +
              "C 150 108, 108 122, 98 152 " +
              "C 90 178, 94 216, 102 272 " +
              "C 112 340, 124 420, 138 470 " +
              "L 462 470 " +
              "C 476 420, 488 340, 498 272 " +
              "C 506 216, 510 178, 502 152 " +
              "C 492 122, 450 108, 392 92 " +
              "C 350 78, 338 58, 338 22 Z"
            }
            fill={`url(#${ref("torso")})`}
            stroke={SKIN_EDGE}
            strokeWidth="2"
          />

          {/* Encasture du cou */}
          <path
            d="M 262 22 Q 300 34, 338 22"
            fill="none"
            stroke={SKIN_EDGE}
            strokeWidth="2"
          />

          {/* Clavicules — convergent vers l'incisure jugulaire (300, 122) */}
          <path d="M 108 150 Q 205 108, 296 122" fill="none" stroke={BONE} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
          <path d="M 492 150 Q 395 108, 304 122" fill="none" stroke={BONE} strokeWidth="3" strokeLinecap="round" opacity="0.85" />

          {/* Sternum : incisure jugulaire → angle de Louis → xiphoïde */}
          <path d="M 285 124 Q 300 120, 315 124" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <path d="M 300 126 L 300 156" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          {/* Angle de Louis (repère des 2ᵉ EIC) */}
          <path d="M 290 158 L 310 158" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
          <path d="M 300 160 L 300 372" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
          {/* Xiphoïde */}
          <path d="M 300 372 L 300 388" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

          {/* Arcs costaux discrets */}
          {ribs.map((rib, i) => (
            <path key={i} d={rib.d} fill="none" stroke={BONE} strokeWidth="1.6" opacity="0.28" strokeLinecap="round" />
          ))}

          {/* Rebord costal */}
          <path d="M 300 388 Q 216 420, 168 462" fill="none" stroke={BONE} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
          <path d="M 300 388 Q 384 420, 432 462" fill="none" stroke={BONE} strokeWidth="2" opacity="0.55" strokeLinecap="round" />

          {/* Lignes médio-claviculaires (repère du foyer mitral) */}
          <path d="M 172 160 L 176 430" stroke={GUIDE} strokeWidth="1.6" strokeDasharray="5 6" opacity="0.55" fill="none" />
          <path d="M 428 160 L 424 430" stroke={GUIDE} strokeWidth="1.6" strokeDasharray="5 6" opacity="0.55" fill="none" />

          {/*
            Calque interactif : chaque marqueur tombe sur son repère —
            aortique/pulmonaire encadrent le sternum au niveau de l'angle
            de Louis, mitral sur la ligne médio-claviculaire droite de
            l'image.
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

      <figcaption className="px-3 py-1.5 text-center text-[10px] leading-tight text-subtle">
        Schéma : thorax antérieur — repères sternal, claviculaire et médio-claviculaire (vue de face, droite du patient à gauche)
      </figcaption>
    </figure>
  );
}
