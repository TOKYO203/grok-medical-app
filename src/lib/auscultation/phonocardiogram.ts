/**
 * Générateur de phonocardiogramme — description STRUCTURÉE d'un cycle
 * cardiaque ou respiratoire en fonction du preset audio.
 *
 * Ce module ne dessine rien. Il produit la donnée brute qu'un composant SVG
 * (PhonoSVG) lira pour tracer le signal et positionner les labels.
 *
 * Référence temporelle : cycle standard 820 ms à 75 bpm
 *   systole  340 ms  (S1 → S2)
 *   diastole 480 ms  (S2 → S1 suivant)
 *
 * Un événement est un segment audible :
 *   kind      : nature clinique (S1, S2, souffle, click, craquement…)
 *   startTime : début, en secondes depuis le début du cycle
 *   duration  : durée du segment
 *   amplitude : hauteur relative pour l'affichage (0-1)
 *   shape     : enveloppe visuelle (plateau, losange, décrescendo…)
 */

export type PhonoEventKind =
  | "s1" | "s2" | "s3" | "s4"
  | "murmur" | "click" | "os" | "rub"
  | "crackle" | "continuous" | "breath";

export type PhonoShape =
  | "impulse"                  // pic bref (S1, S2, click)
  | "plateau"                  // souffle constant
  | "crescendo"
  | "decrescendo"
  | "crescendo-decrescendo"    // losange
  | "rumble"                   // roulement basse fréquence
  | "burst";                   // craquement

export interface PhonoEvent {
  kind: PhonoEventKind;
  startTime: number;
  duration: number;
  amplitude: number;
  shape: PhonoShape;
  label?: string;
}

export interface PhonoPhase {
  start: number;
  end: number;
  label: string;
  color: "systole" | "diastole" | "inspi" | "expi";
}

export interface PhonoCycle {
  durationSec: number;
  events: PhonoEvent[];
  phases: PhonoPhase[];
  s1Time: number;
  s2Time: number;
}

/** Cycle standard — valeurs par défaut, écrasables par params. */
const DEFAULT_SYSTOLE = 0.34;
const DEFAULT_DIASTOLE = 0.48;
const S1_DUR = 0.10;
const S2_DUR = 0.08;

/**
 * Construit un cycle pour un preset donné. Tous les presets de
 * src/lib/auscultation/engine.ts doivent être couverts, sinon on retombe
 * sur un cycle normal_s1s2 (fallback silencieux mais visible).
 */
export function buildCycle(
  preset: string,
  params: Record<string, number> = {},
): PhonoCycle {
  const systole = params.systole ?? DEFAULT_SYSTOLE;
  const diastole = params.diastole ?? DEFAULT_DIASTOLE;
  const total = systole + diastole;
  const s1Time = 0;
  const s2Time = systole;

  const basePhases: PhonoPhase[] = [
    { start: 0, end: systole, label: "Systole", color: "systole" },
    { start: systole, end: total, label: "Diastole", color: "diastole" },
  ];

  const cycle = (events: PhonoEvent[], phases = basePhases): PhonoCycle => ({
    durationSec: total,
    events,
    phases,
    s1Time,
    s2Time,
  });

  const breathCycle = (events: PhonoEvent[]): PhonoCycle =>
    cycle(events, [
      { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
      { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
    ]);

  const s1 = (label = "B1"): PhonoEvent => ({
    kind: "s1", startTime: s1Time, duration: S1_DUR, amplitude: 0.9,
    shape: "impulse", label,
  });
  const s2 = (label = "B2"): PhonoEvent => ({
    kind: "s2", startTime: s2Time, duration: S2_DUR, amplitude: 0.8,
    shape: "impulse", label,
  });

  switch (preset) {
    case "normal_s1s2":
      return cycle([s1(), s2()]);

    case "split_s2":
      // Dédoublement : A2 puis P2 séparés de 40 ms
      return cycle([
        s1(),
        { ...s2("A2"), duration: 0.06 },
        { ...s2("P2"), startTime: s2Time + 0.04, duration: 0.06, amplitude: 0.6 },
      ]);

    case "s3_gallop":
      // B3 proto-diastolique ~140 ms après B2, basse fréquence
      return cycle([
        s1(),
        s2(),
        {
          kind: "s3", startTime: s2Time + 0.14, duration: 0.10,
          amplitude: 0.5, shape: "impulse", label: "B3",
        },
      ]);

    case "s4_gallop":
      // B4 pré-systolique ~80 ms avant B1 (fin du cycle précédent).
      // Représenté ici en fin de cycle courant pour rester monotone.
      return cycle([
        {
          kind: "s4", startTime: total - 0.09, duration: 0.09,
          amplitude: 0.5, shape: "impulse", label: "B4",
        },
        s1(),
        s2(),
      ]);

    case "holosystolic_blowing":
      // Souffle IM : plateau systolique complet S1 → S2
      return cycle([
        s1(),
        {
          kind: "murmur", startTime: s1Time + S1_DUR * 0.5,
          duration: systole - S1_DUR * 0.5,
          amplitude: 0.55, shape: "plateau", label: "Souffle holosystolique",
        },
        s2(),
      ]);

    case "diastolic_rumble_os":
      // RM : B1 éclatant + COM (claquement d'ouverture) + roulement diastolique
      return cycle([
        { ...s1("B1 éclaté"), amplitude: 1.0 },
        s2(),
        {
          kind: "os", startTime: s2Time + 0.08, duration: 0.06,
          amplitude: 0.7, shape: "impulse", label: "COM",
        },
        {
          kind: "murmur", startTime: s2Time + 0.16,
          duration: diastole - 0.20,
          amplitude: 0.4, shape: "rumble", label: "Roulement",
        },
      ]);

    case "early_diastolic_decrescendo":
      // IA : souffle post-B2 decrescendo
      return cycle([
        s1(),
        s2(),
        {
          kind: "murmur", startTime: s2Time + S2_DUR,
          duration: diastole * 0.55,
          amplitude: 0.6, shape: "decrescendo", label: "Souffle protodiastolique",
        },
      ]);

    case "ejection_crescendo_decrescendo":
      // RA : souffle d'éjection entre S1 et S2, forme en losange
      return cycle([
        s1(),
        {
          kind: "murmur", startTime: s1Time + S1_DUR,
          duration: systole - S1_DUR - S2_DUR * 0.4,
          amplitude: 0.7, shape: "crescendo-decrescendo",
          label: "Souffle éjectionnel",
        },
        s2(),
      ]);

    case "pericardial_rub":
      // Frottement : 2 bursts systolo-diastoliques rugueux
      return cycle([
        {
          kind: "rub", startTime: 0.02, duration: systole * 0.5,
          amplitude: 0.6, shape: "burst", label: "Frottement systolique",
        },
        {
          kind: "rub", startTime: s2Time + 0.02, duration: diastole * 0.4,
          amplitude: 0.5, shape: "burst", label: "Frottement diastolique",
        },
      ]);

    case "irregular_fast":
      // FA : cycle raccourci pour suggérer la tachycardie (100-160/min)
      // Note : l'irrégularité temporelle sera rendue par le SVG (jitter).
      return cycle(
        [s1(), s2()],
        [
          { start: 0, end: systole, label: "Systole", color: "systole" },
          { start: systole, end: total, label: "Diastole", color: "diastole" },
        ],
      );

    // ── Pulmonaire ─────────────────────────────────────────────────────
    case "normal_vesicular":
      return breathCycle([{
        kind: "breath", startTime: 0, duration: total,
        amplitude: 0.35, shape: "plateau", label: "Murmure vésiculaire",
      }]);

    case "normal_tracheal":
      return breathCycle([{
        kind: "breath", startTime: 0, duration: total,
        amplitude: 0.5, shape: "plateau", label: "Bruit trachéal",
      }]);

    case "fine_crackles":
    case "medium_crackles":
    case "coarse_crackles": {
      const width = preset === "fine_crackles" ? 0.008
        : preset === "medium_crackles" ? 0.015 : 0.025;
      const events: PhonoEvent[] = [];
      // Craquements répartis en fin d'inspiration (télé-inspiratoire)
      for (let i = 0; i < 12; i++) {
        const t = 0.05 + (i / 11) * (total * 0.45);
        events.push({
          kind: "crackle", startTime: t, duration: width,
          amplitude: 0.6 + (i % 3) * 0.1, shape: "burst",
        });
      }
      return cycle(events, [
        { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
        { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
      ]);
    }

    case "pleural_crackles": {
      const events: PhonoEvent[] = [];
      for (let i = 0; i < 6; i++) {
        const ti = 0.05 + (i / 5) * (total * 0.4);
        const te = total * 0.55 + (i / 5) * (total * 0.4);
        events.push({ kind: "crackle", startTime: ti, duration: 0.015, amplitude: 0.6, shape: "burst" });
        events.push({ kind: "crackle", startTime: te, duration: 0.015, amplitude: 0.5, shape: "burst" });
      }
      return cycle(events, [
        { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
        { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
      ]);
    }

    case "sibilances":
      return cycle([
        { kind: "continuous", startTime: 0, duration: total * 0.45,
          amplitude: 0.4, shape: "plateau", label: "Sibilances inspiratoires" },
        { kind: "continuous", startTime: total * 0.5, duration: total * 0.45,
          amplitude: 0.7, shape: "plateau", label: "Sibilances expiratoires" },
      ], [
        { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
        { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
      ]);

    case "stridor":
      return cycle([{
        kind: "continuous", startTime: 0, duration: total * 0.5,
        amplitude: 0.75, shape: "plateau", label: "Stridor inspiratoire",
      }], [
        { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
        { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
      ]);

    case "bronchial_breath":
      return breathCycle([{
        kind: "breath", startTime: 0, duration: total,
        amplitude: 0.6, shape: "plateau", label: "Souffle tubaire",
      }]);

    case "pleural_effusion_souffle":
      return cycle([
        { kind: "breath", startTime: 0, duration: total * 0.4,
          amplitude: 0.4, shape: "plateau", label: "Murmure diminué" },
        { kind: "continuous", startTime: total * 0.65, duration: total * 0.3,
          amplitude: 0.55, shape: "decrescendo", label: "Souffle pleurétique" },
      ], [
        { start: 0, end: total * 0.5, label: "Inspiration", color: "inspi" },
        { start: total * 0.5, end: total, label: "Expiration", color: "expi" },
      ]);

    default:
      // Fallback silencieux : cycle normal
      return cycle([s1(), s2()]);
  }
}

/** Retourne la liste des presets couverts (utile pour un test d'intégrité). */
export const COVERED_PRESETS = [
  "normal_s1s2", "split_s2", "s3_gallop", "s4_gallop",
  "holosystolic_blowing", "diastolic_rumble_os",
  "early_diastolic_decrescendo", "ejection_crescendo_decrescendo",
  "pericardial_rub", "irregular_fast",
  "normal_vesicular", "normal_tracheal",
  "fine_crackles", "medium_crackles", "coarse_crackles",
  "pleural_crackles", "sibilances", "stridor",
  "bronchial_breath", "pleural_effusion_souffle",
] as const;
