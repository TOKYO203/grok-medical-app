/**
 * Modèle canonique d'ECG — dérivé du "Guide Pratique de l'ECG".
 * Fournit les types pour :
 *  - la génération de tracés synthétiques animés (Gaussiennes)
 *  - l'analyse décisionnelle (rythme, axe, ischémie)
 *  - la classification des cardiopathies
 */

/* ═══════════ 1. CONSTANTES INTERNATIONALES ═══════════ */
export const ECG_NORMS = {
  /** Vitesse de déroulement papier (mm/s) */
  paperSpeedMmPerSec: 25,
  /** Étalonnage tension (mm/mV) */
  voltageMmPerMv: 10,
  /** Durée d'un petit carreau (s) = 1 mm / 25 mm/s */
  smallBoxSec: 0.04,
  /** Durée d'un grand carreau (s) = 5 mm / 25 mm/s */
  largeBoxSec: 0.20,
  /** Fréquence d'échantillonnage par défaut (Hz) */
  defaultSamplingHz: 500,
} as const;

/* ═══════════ 1 bis. MONITEUR — BALAYAGE & GAIN ═══════════ */
/**
 * Durée de balayage visible sur le moniteur (secondes). 4 s ≈ usage scope.
 * Le repère du moniteur est le « papier » : 1 unité de viewBox = 1 mm
 * (25 mm/s en abscisse, `voltageMmPerMv` en ordonnée).
 */
export const ECG_SWEEP_SECONDS = 4;

/**
 * Paliers de gain d'amplitude proposés par la toolbar (mm/mV).
 *
 * PLANCHER VOLONTAIRE à 5 mm/mV : on ne descend PAS à 2,5 mm/mV même si
 * l'amplitude venait à écrêter la hauteur de ligne — limite assumée et
 * documentée (cf. `README.md` du dossier ECG).
 */
export const ECG_GAIN_STEPS = [10, 5] as const;
export type EcgGain = (typeof ECG_GAIN_STEPS)[number];

/** Gain réduit appliqué automatiquement sur mobile en paysage (lignes courtes). */
export const ECG_GAIN_REDUCED: EcgGain = 5;

/* ═══════════ 2. DÉRIVATIONS ═══════════ */
export const LIMB_LEADS = ["DI", "DII", "DIII", "aVR", "aVL", "aVF"] as const;
export const PRECORDIAL_LEADS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
export type LimbLead = (typeof LIMB_LEADS)[number];
export type PrecordialLead = (typeof PRECORDIAL_LEADS)[number];
export type Lead = LimbLead | PrecordialLead;

/* ═══════════ 3. MÉTRIQUES GLOBALES ═══════════ */
export type CardiacRhythm =
  | "sinusal"
  | "bradycardie-sinusale"
  | "tachycardie-sinusale"
  | "fibrillation-auriculaire"
  | "flutter-auriculaire"
  | "tachycardie-jonctionnelle"
  | "tachycardie-ventriculaire"
  | "fibrillation-ventriculaire"
  | "torsade-de-pointes"
  | "wpw";

export type HeartRateSeverity = "bradycardie" | "normal" | "tachycardie";

export type QrsAxis =
  | "normal"
  | "deviation-gauche"
  | "deviation-droite"
  | "indetermine";

export type TransitionZone = "V1-V2" | "V3-V4" | "V5-V6" | "absente";

export type GlobalMetrics = {
  heartRateBpm: number;
  heartRateSeverity: HeartRateSeverity;
  rrRegularity: boolean;
  /** Axe QRS dans le plan frontal (degrés, -180 à +180) */
  qrsAxisDeg: number;
  qrsAxisLabel: QrsAxis;
  /** Zone de transition électrique V1→V6 */
  transitionZone: TransitionZone;
};

/* ═══════════ 4. INTERVALLES (secondes) ═══════════ */
export type IntervalsSec = {
  pDuration: number;
  prInterval: number;
  qrsDuration: number;
  qtMeasured: number;
  qtCorrectedBazett: number;
};

/* ═══════════ 5. MORPHOLOGIE DES ONDES ═══════════ */
export type WaveformMorphology = "normal" | "pathologique" | "absent";

export type PWave = {
  amplitudeMv: number;
  morphology: WaveformMorphology;
};

export type QrsComplex = {
  amplitudeMaxMv: number;
  qWavePathological: boolean;
};

export type StSegment = {
  elevationMv: number;
  depressionMv: number;
  type: "iso-electrique" | "sus-decale" | "sous-decale";
};

export type TWave = {
  amplitudeMv: number;
  polarity: "positive" | "negative" | "biphasique";
  morphology: "symetrique" | "asymetrique" | "pointe" | "aplatie";
};

export type Waveforms = {
  pWave: PWave;
  qrsComplex: QrsComplex;
  stSegment: StSegment;
  tWave: TWave;
};

/* ═══════════ 6. DIAGNOSTIC / CLASSIFICATION ═══════════ */
export type Territory =
  | "anterieur"
  | "septal-apical"
  | "lateral"
  | "inferieur"
  | "posterieur";

export type IschemiaSeverity =
  | "normal"
  | "ischemie-sous-endocardique"
  | "lesion-sous-epicardique"
  | "sequelle-necrose";

export type ElectrolyteDisorder =
  | "hyperkaliemie"
  | "hypokaliemie"
  | "normal";

/* ═══════════ 7. DESIGN SONORE DU MONITEUR ═══════════ */
/**
 * Types de sons du moniteur ECG (spec Adnet/Lapostolle).
 *
 * Défini dans le modèle canonique (`core`) pour que `EcgCase` — et les cas
 * JSON qui portent un champ `sound` — puissent le référencer sans que le
 * domaine ne dépende de l'implémentation (`src/lib/ecg/sounds.ts`, qui le
 * ré-exporte pour la compatibilité des imports existants).
 */
export type SoundType =
  | "bip_normal"
  | "bip_lent"
  | "bip_rapide"
  | "double_bip"
  | "son_continu"
  | "son_oscillant"
  | "son_dents_scie"
  | "son_irregulier"
  | "son_grave_montant"
  | "son_aigu_montant"
  | "silence";

/* ═══════════ 8. CAS ECG COMPLET ═══════════ */
export type EcgCase = {
  id: string;
  title: string;
  difficulty: "intro" | "intermediate" | "advanced";
  rhythm: CardiacRhythm;
  metrics: GlobalMetrics;
  intervals: IntervalsSec;
  waveforms: Waveforms;
  /**
   * Niveau ischémique classé. Optionnel : les cas « légers » (bibliothèque
   * Adnet/Lapostolle) ne le renseignent que lorsqu'un sus/sous-décalage est
   * cliniquement présent (ex. IDM `lesion-sous-epicardique`).
   */
  ischemia?: IschemiaSeverity;
  territory?: Territory;
  electrolyte?: ElectrolyteDisorder;
  source: { type: string; url?: string; author?: string; license?: string };
  /** Son du moniteur associé au tableau clinique (spec Adnet/Lapostolle). */
  sound?: SoundType;
  /** Étapes de lecture guidée */
  steps: EcgStep[];
  /** Annotations SVG révélées après chaque étape */
  annotations: EcgAnnotation[];
  /** Rendu synthétique du tracé (optionnel, sinon image) */
  trace?: EcgTraceParams;
};

export type EcgStep = {
  n: number;
  title: string;
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
};

export type EcgAnnotation = {
  id: string;
  /** Étape après laquelle l'annotation devient visible */
  revealAtStep: number;
  type: "arrow" | "zone" | "caliper" | "text";
  label: string;
  tone: "normal" | "warning" | "info";
  /**
   * Coordonnées RELATIVES au cadre du moniteur, exprimées en FRACTION
   * (0 → 1), et non en pixels :
   *   { x: 0.15, y: 0.30 }  →  15 % de la largeur, 30 % de la hauteur.
   * Indépendant de la résolution et du « viewBox natif » (en mm) du moniteur.
   * Un tracé (caliper) utilise en plus `x2` / `y2`, mêmes fractions.
   */
  coords: Record<string, number>;
};

/** Paramètres du modèle gaussien pour le tracé animé. */
export type EcgTraceParams = {
  bpm: number;
  cycles: number;
  waves: {
    P: WaveGaussian;
    Q: WaveGaussian;
    R: WaveGaussian;
    S: WaveGaussian;
    T: WaveGaussian;
  };
};

export type WaveGaussian = {
  /** Centre du pic (offset dans le cycle, en secondes) */
  mu: number;
  /** Amplitude relative (mV) */
  a: number;
  /** Largeur du pic (secondes) */
  sigma: number;
};
