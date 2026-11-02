/**
 * Construction de la déformation ECG d'une fiche — source de vérité partagée
 * entre la page d'un cas (routes/ecg.$id) et le mode examen (ExamenModeEcg).
 * Extraite de la route (PR #354) pour éviter la divergence de la logique.
 */
import type { EcgDeformation } from "./deformation";

export function buildDeformation(data: {
  rhythm: string;
  ischemia?: string;
  title?: string;
  trace?: { deformation?: EcgDeformation; prIntervalMs?: number };
}): EcgDeformation {
  const d: EcgDeformation = { rhythm: data.rhythm };
  const t = (data.title ?? "").toLowerCase();
  if (data.rhythm === "fibrillation-auriculaire") d.pAbsent = true;
  if (data.rhythm === "flutter-auriculaire") d.sawTooth = true;
  if (data.rhythm === "tachycardie-ventriculaire") d.wideQrs = true;
  if (data.rhythm === "torsade-de-pointes") d.wideQrs = true;
  if (data.rhythm === "fibrillation-ventriculaire") d.fv = true;
  if (t.includes("bav") && (t.includes("mobitz ii") || t.includes("bav iii"))) d.wideQrs = true;
  if (t.includes("hyperkali")) d.peakedT = true;
  // ⚠️ Clés de dérivation alignées sur le moniteur (« I », « II », « III ») —
  // et non « DI »/« DII »/« DIII » : sinon le sus/sous-décalage ST des
  // territoires inférieur/latéral n'était JAMAIS appliqué.
  if (data.ischemia === "lesion-sous-epicardique") {
    if (t.includes("antérieur")) {
      d.stElevation = { V2: 0.25, V3: 0.30, V4: 0.30, V5: 0.20 };
      d.tInverted = ["V2", "V3", "V4"];
    } else if (t.includes("latéral")) {
      d.stElevation = { I: 0.20, aVL: 0.25, V5: 0.20, V6: 0.20 };
    } else if (t.includes("inférieur")) {
      d.stElevation = { II: 0.20, III: 0.25, aVF: 0.25 };
      d.stDepression = { aVL: 0.15 };
    }
  }
  if (t.includes("digitalique")) {
    d.stDepression = { II: 0.10, V4: 0.15, V5: 0.15, V6: 0.15 };
  }
  // PR de la fiche (v3) : le tracé décale l'onde P en conséquence —
  // l'étudiant peut MESURER le PR long (hyperkaliémie, digitalique).
  if (data.trace?.prIntervalMs !== undefined) d.prIntervalMs = data.trace.prIntervalMs;
  // Merge des déformations déclarées dans la fiche.
  if (data.trace?.deformation) {
    const t = data.trace.deformation;
    if (t.prProgression) d.prProgression = t.prProgression;
    if (t.pBlockedEvery !== undefined) d.pBlockedEvery = t.pBlockedEvery;
    if (t.rrVariability !== undefined) d.rrVariability = t.rrVariability;
    if (t.rrSeed !== undefined) d.rrSeed = t.rrSeed;
    if (t.stElevation && !d.stElevation) d.stElevation = t.stElevation;
    if (t.stDepression && !d.stDepression) d.stDepression = t.stDepression;
    if (t.wideQrs !== undefined) d.wideQrs = t.wideQrs;
    if (t.pAbsent !== undefined) d.pAbsent = t.pAbsent;
    if (t.sawTooth !== undefined) d.sawTooth = t.sawTooth;
    if (t.fv !== undefined) d.fv = t.fv;
    if (t.peakedT !== undefined) d.peakedT = t.peakedT;
    if (t.tInverted) d.tInverted = t.tInverted;
    if (t.mainsNoiseMv !== undefined) d.mainsNoiseMv = t.mainsNoiseMv;
    if (t.jWaveMv !== undefined) d.jWaveMv = t.jWaveMv;
    if (t.prIntervalMs !== undefined) d.prIntervalMs = t.prIntervalMs;
    if (t.stCoved !== undefined) d.stCoved = t.stCoved;
    if (t.stScooped !== undefined) d.stScooped = t.stScooped;
    if (t.torsadeTwist !== undefined) d.torsadeTwist = t.torsadeTwist;
    if (t.stConcave !== undefined) d.stConcave = t.stConcave;
    if (t.prDepressionMv !== undefined) d.prDepressionMv = t.prDepressionMv;
    if (t.pFlip) d.pFlip = t.pFlip;
    if (t.qrsFragmented !== undefined) d.qrsFragmented = t.qrsFragmented;
    if (t.pacemakerSpike !== undefined) d.pacemakerSpike = t.pacemakerSpike;
  }
  return d;
}
