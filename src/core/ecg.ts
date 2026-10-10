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

/* ═══════════ 7. CAS ECG COMPLET ═══════════ */
export type EcgCase = {
  id: string;
  title: string;
  difficulty: "intro" | "intermediate" | "advanced";
  rhythm: CardiacRhythm;
  metrics: GlobalMetrics;
  intervals: IntervalsSec;
  waveforms: Waveforms;
  ischemia: IschemiaSeverity;
  territory?: Territory;
  electrolyte?: ElectrolyteDisorder;
  source: { type: string; url?: string; author?: string; license?: string };
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
  /** Coordonnées SVG (viewBox 1200×320 par défaut) */
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
