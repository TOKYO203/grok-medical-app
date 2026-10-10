import indexJson from "@/content/data/ecg/_index.json";
import normal001 from "@/content/data/ecg/normal-001.json";
import type { EcgCase } from "@/core/ecg";

/** Chargeur de cas ECG — index + contenu (bundle statique pour offline). */
const CASES_BY_FILE: Record<string, EcgCase> = {
  "normal-001.json": normal001 as unknown as EcgCase,
};

export type EcgIndexEntry = (typeof indexJson)["cases"][number];

export type EcgDifficulty = "intro" | "intermediate" | "advanced";

export function listEcg(): EcgIndexEntry[] {
  return indexJson.cases;
}

export function getEcg(id: string): EcgCase | undefined {
  const entry = indexJson.cases.find((c) => c.id === id);
  if (!entry) return undefined;
  return CASES_BY_FILE[entry.file];
}

export function countEcg(): number {
  return indexJson.cases.length;
}
