// Unités cliniques standardisées (C28) : registre unique des unités affichables
// et rendu locale-aware. Convention SI-first, symboles internationaux (bpm, mmHg…).
// Les moteurs ECG / auscultation / calculateurs conservent leurs unités internes.
import { DEFAULT_LOCALE, type Locale } from "../i18n/core.ts";
import { localeTag } from "../i18n/format.ts";

export type UnitId =
  | "bpm"
  | "mmHg"
  | "gPerL"
  | "gPerDl"
  | "mmolPerL"
  | "celsius"
  | "kg"
  | "kgPerM2"
  | "cm"
  | "mL"
  | "percent"
  | "ms"
  | "mV"
  | "mg"
  | "microgram"
  | "mLPerMin";

export interface ClinicalUnit {
  readonly id: UnitId;
  readonly symbol: string;
  readonly label: string;
  readonly maxFractionDigits: number;
}

export const CLINICAL_UNITS: Record<UnitId, ClinicalUnit> = {
  bpm: { id: "bpm", symbol: "bpm", label: "fréquence cardiaque", maxFractionDigits: 0 },
  mmHg: { id: "mmHg", symbol: "mmHg", label: "pression artérielle", maxFractionDigits: 0 },
  gPerL: { id: "gPerL", symbol: "g/L", label: "concentration (hémoglobine)", maxFractionDigits: 1 },
  gPerDl: { id: "gPerDl", symbol: "g/dL", label: "concentration (g/dL)", maxFractionDigits: 1 },
  mmolPerL: { id: "mmolPerL", symbol: "mmol/L", label: "glycémie et ionogramme", maxFractionDigits: 2 },
  celsius: { id: "celsius", symbol: "°C", label: "température", maxFractionDigits: 1 },
  kg: { id: "kg", symbol: "kg", label: "masse", maxFractionDigits: 1 },
  kgPerM2: { id: "kgPerM2", symbol: "kg/m²", label: "indice de masse corporelle", maxFractionDigits: 1 },
  cm: { id: "cm", symbol: "cm", label: "taille", maxFractionDigits: 1 },
  mL: { id: "mL", symbol: "mL", label: "volume", maxFractionDigits: 1 },
  percent: { id: "percent", symbol: "%", label: "pourcentage", maxFractionDigits: 0 },
  ms: { id: "ms", symbol: "ms", label: "durée (électro)", maxFractionDigits: 0 },
  mV: { id: "mV", symbol: "mV", label: "amplitude (électro)", maxFractionDigits: 2 },
  mg: { id: "mg", symbol: "mg", label: "masse (posologie)", maxFractionDigits: 1 },
  microgram: { id: "microgram", symbol: "µg", label: "masse (posologie)", maxFractionDigits: 1 },
  mLPerMin: { id: "mLPerMin", symbol: "mL/min", label: "débit", maxFractionDigits: 0 },
};

export const NARROW_NBSP = "\u202F";

export function unitSymbol(unitId: UnitId): string {
  return CLINICAL_UNITS[unitId]?.symbol ?? "";
}

export function formatMeasurement(
  value: number,
  unitId: UnitId,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const unit = CLINICAL_UNITS[unitId];
  if (!unit || !Number.isFinite(value)) return String(value);
  const num = new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: unit.maxFractionDigits,
  }).format(value);
  return num + NARROW_NBSP + unit.symbol;
}

// Saisie utilisateur : accepte la virgule et le point décimaux,
// ignore les espaces (y compris l'espace fine insécable du rendu).
export function parseMeasurement(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\u202F\u00A0 ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
