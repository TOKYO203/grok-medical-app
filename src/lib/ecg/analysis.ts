import type { HeartRateSeverity, IntervalsSec, QrsAxis, TransitionZone } from "@/core/ecg";

export function heartRateFromRR(rrSec: number): number {
  if (rrSec <= 0) return 0;
  return Math.round(60 / rrSec);
}
export function heartRateFromBoxes(largeBoxes: number): number {
  if (largeBoxes <= 0) return 0;
  return Math.round(300 / largeBoxes);
}
export function classifyHeartRate(bpm: number): HeartRateSeverity {
  if (bpm < 60) return "bradycardie";
  if (bpm > 90) return "tachycardie";
  return "normal";
}
export function qtCorrectedBazett(qtSec: number, rrSec: number): number {
  if (rrSec <= 0) return 0;
  return +(qtSec / Math.sqrt(rrSec)).toFixed(3);
}
export function qrsAxisDeg(diNet: number, avfNet: number): number {
  return +(Math.atan2(avfNet, diNet) * 180 / Math.PI).toFixed(0);
}
export function classifyQrsAxis(deg: number): QrsAxis {
  if (deg >= -30 && deg <= 110) return "normal";
  if (deg < -30) return "deviation-gauche";
  if (deg > 110) return "deviation-droite";
  return "indetermine";
}
export function transitionZone(rsRatioByLead: Record<string, number>): TransitionZone {
  const leads = ["V1", "V2", "V3", "V4", "V5", "V6"];
  let best: string | null = null;
  let bestDelta = Infinity;
  for (const l of leads) {
    const r = rsRatioByLead[l];
    if (r === undefined) continue;
    const d = Math.abs(r - 1);
    if (d < bestDelta) { bestDelta = d; best = l; }
  }
  if (!best) return "absente";
  if (best === "V1" || best === "V2") return "V1-V2";
  if (best === "V3" || best === "V4") return "V3-V4";
  return "V5-V6";
}
export function isQtcNormal(qtc: number): boolean {
  return qtc >= 0.36 && qtc <= 0.45;
}
export function buildIntervals(
  raw: Omit<IntervalsSec, "qtCorrectedBazett">,
  rrSec: number,
): IntervalsSec {
  return { ...raw, qtCorrectedBazett: qtCorrectedBazett(raw.qtMeasured, rrSec) };
}
