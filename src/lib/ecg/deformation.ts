/* Déformation ECG selon pathologie — adapte le tracé au diagnostic.
 *
 * Pipeline (refonte 2026) :
 *   1. morphologie « source »   — DI, DII + V1…V6 (`BASE` ci-dessous)
 *   2. dérivation frontale      — DIII/aVR/aVL/aVF par la loi d'Einthoven
 *   3. déformation clinique     — sus/sous-décalage ST, onde T, dents de scie
 * La déformation est appliquée PAR DÉRIVATION après dérivation, en surcouche
 * (cf. `cycleValues()` dans waveform.ts). */

export type EcgDeformation = {
  rhythm?: string;
  stElevation?: Record<string, number>;
  stDepression?: Record<string, number>;
  wideQrs?: boolean;
  tInverted?: string[];
  peakedT?: boolean;
  pAbsent?: boolean;
  sawTooth?: boolean;
  /**
   * Fibrillation ventriculaire (issue #39) : chaos ventriculaire, ni P ni
   * QRS analysables. Testée en premier par `analyzeEcg` — le type
   * `EcgRythme` prévoyait « fv » sans jamais l'assigner.
   */
  fv?: boolean;

  // ── Déformations multi-cycles (v2) ────────────────────────────────────
  // Progression du PR entre cycles consécutifs :
  //   "constant"  = PR fixe (normal)
  //   "wenckebach" = PR s'allonge progressivement puis un cycle saute (BAV II M1)
  //   "mobitz2"   = PR constant mais P bloquée tous les N cycles
  prProgression?: "constant" | "wenckebach" | "mobitz2";
  // Pour mobitz2 : 1 P bloquée tous les N cycles (2 → 2:1, 3 → 3:1)
  pBlockedEvery?: number;
  // Variabilité du RR (FA, arythmie sinusale) : 0 = régulier, 0.3 = forte variabilité
  rrVariability?: number;
  // Seed du PRNG pour reproductibilité SSR (défaut : 42)
  rrSeed?: number;

  // ── Fidélité clinique (v3) — le tracé doit soutenir la question ──────
  // QA #349 : six fiches décrivaient un signe (parasitage 50 Hz, onde J de
  // Osborn, PR long, dôme de Brugada, cupule digitalique, accordéon des
  // torsades) que le moteur ne savait PAS dessiner — la réponse au quiz
  // n'était pas vérifiable sur le tracé affiché. Chaque flag ci-dessous
  // rend ce signe visible ; toutes les valeurs restent en mV/seconde.
  /** Artefact secteur 50 Hz : amplitude crête en mV (≈0.2 brouille le tracé). */
  mainsNoiseMv?: number;
  /** Onde J d'Osborn (hypothermie) : amplitude en mV, bosse entre S et ST. */
  jWaveMv?: number;
  /** PR réel en ms — décale l'onde P pour rendre un PR long/court VISIBLE. */
  prIntervalMs?: number;
  /** ST en dôme décroissant (Brugada type 1) au lieu du plateau plat. */
  stCoved?: boolean;
  /** ST en cupule sagging (digitalique) au lieu du plateau plat. */
  stScooped?: boolean;
  /** Torsades : modulation lente de l'amplitude des QRS (« accordéon »). */
  torsadeTwist?: boolean;

  // ── Fidélité clinique (v4) — les 4 derniers écarts QA ─────────────
  // QA #355 : péricardite « concave » + « PR sous-décalé », malposition/
  // ectopique « P positive en aVR », QT non adapté à la FC.
  /** ST concave (péricardite) : bosse qui culmine à mi-segment, à mi-chemin
   *  entre le plateau plat et le dôme de Brugada. */
  stConcave?: boolean;
  /** Sous-décalage du segment PR en mV (péricardite) — valeur négative. */
  prDepressionMv?: number;
  /** Polarité de l'onde P inversée dans ces dérivations — P positive en
   *  aVR (rythme du sinus coronaire, inversion RA/LA de la malposition),
   *  P négative en DII/DIII/aVF dans le même temps. */
  pFlip?: string[];

  // ── Fidélité clinique (v5) — les 4 derniers pièges QA ─────────────
  // QA v5 : les fiches vitesse 50 mm/s / étalonnage / QRS fragmentés /
  // pacemaker décrivaient un signe invisible sur le tracé rendu.
  /** QRS fragmentés (séquelle de nécrose) : crans serrés sur le
   *  complexe + onde Q pathologique plus profonde et plus large. */
  qrsFragmented?: boolean;
  /** Pacemaker : spike de stimulation fin et raide juste avant chaque QRS. */
  pacemakerSpike?: boolean;
};

export type WaveParams = {
  P: { mu: number; a: number; sigma: number };
  Q: { mu: number; a: number; sigma: number };
  R: { mu: number; a: number; sigma: number };
  S: { mu: number; a: number; sigma: number };
  T: { mu: number; a: number; sigma: number };
};

const BASE: Record<string, WaveParams> = {
  // ── Dérivations « source » du plan frontal ────────────────────────────────
  // DIII / aVR / aVL / aVF ne sont PLUS inventées ici : elles sont DÉRIVÉES de
  // DI et DII par la loi d'Einthoven (cf. `einthoven()` dans waveform.ts).
  //   DIII = DII − DI · aVR = −(DI+DII)/2 · aVL = DI − DII/2 · aVF = DII − DI/2
  I:    { P:{mu:-0.18,a:0.10,sigma:0.025}, Q:{mu:-0.02,a:-0.06,sigma:0.008}, R:{mu:0,a:0.80,sigma:0.010}, S:{mu:0.03,a:-0.12,sigma:0.010}, T:{mu:0.25,a:0.18,sigma:0.040} },
  II:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.20,sigma:0.010}, S:{mu:0.03,a:-0.30,sigma:0.010}, T:{mu:0.25,a:0.30,sigma:0.040} },
  // ── Dérivations précordiales ──────────────────────────────────────────────
  V1:   { P:{mu:-0.18,a:0.08,sigma:0.025}, Q:{mu:-0.02,a:-0.05,sigma:0.008}, R:{mu:0,a:0.35,sigma:0.010}, S:{mu:0.03,a:-0.80,sigma:0.010}, T:{mu:0.25,a:-0.15,sigma:0.040} },
  V2:   { P:{mu:-0.18,a:0.10,sigma:0.025}, Q:{mu:-0.02,a:-0.05,sigma:0.008}, R:{mu:0,a:0.55,sigma:0.010}, S:{mu:0.03,a:-0.95,sigma:0.010}, T:{mu:0.25,a:0.05,sigma:0.040} },
  V3:   { P:{mu:-0.18,a:0.12,sigma:0.025}, Q:{mu:-0.02,a:-0.08,sigma:0.008}, R:{mu:0,a:0.80,sigma:0.010}, S:{mu:0.03,a:-0.60,sigma:0.010}, T:{mu:0.25,a:0.20,sigma:0.040} },
  V4:   { P:{mu:-0.18,a:0.14,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.10,sigma:0.010}, S:{mu:0.03,a:-0.40,sigma:0.010}, T:{mu:0.25,a:0.28,sigma:0.040} },
  V5:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.25,sigma:0.010}, S:{mu:0.03,a:-0.25,sigma:0.010}, T:{mu:0.25,a:0.32,sigma:0.040} },
  V6:   { P:{mu:-0.18,a:0.15,sigma:0.025}, Q:{mu:-0.02,a:-0.10,sigma:0.008}, R:{mu:0,a:1.10,sigma:0.010}, S:{mu:0.03,a:-0.20,sigma:0.010}, T:{mu:0.25,a:0.30,sigma:0.040} },
};

export function baseWave(lead: string): WaveParams {
  return BASE[lead] ?? BASE.II;
}

export function stOffsetMv(lead: string, d?: EcgDeformation): number {
  if (!d) return 0;
  return (d.stElevation?.[lead] ?? 0) - (d.stDepression?.[lead] ?? 0);
}
