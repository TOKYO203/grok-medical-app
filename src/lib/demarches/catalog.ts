import indexJson from "@/content/data/demarches/_index.json";
import douleurThoracique from "@/content/data/demarches/douleur-thoracique.json";
import dyspnee from "@/content/data/demarches/dyspnee.json";
import hemoptysie from "@/content/data/demarches/hemoptysie.json";
import syncope from "@/content/data/demarches/syncope.json";
import type { DemarcheContent, DemarcheIndexEntry } from "@/core/demarche";

/**
 * Chargeur de démarches enrichies — index + contenu (bundle statique, offline).
 *
 * ⚠️ Chaque fichier déclaré `status: "available"` dans `_index.json` DOIT être
 * enregistré dans `CONTENT_BY_FILE`, sinon `getDemarcheContent()` renvoie
 * `undefined` et la route retombe silencieusement sur le stepper QCM seul.
 * Le garde-fou `scripts/demarches-catalog-integrity.test.mjs` verrouille ce lien.
 */
const CONTENT_BY_FILE: Record<string, DemarcheContent> = {
  "douleur-thoracique.json": douleurThoracique as unknown as DemarcheContent,
  "dyspnee.json": dyspnee as unknown as DemarcheContent,
  "hemoptysie.json": hemoptysie as unknown as DemarcheContent,
  "syncope.json": syncope as unknown as DemarcheContent,
};

const INDEX: DemarcheIndexEntry[] = (indexJson as { demarches: DemarcheIndexEntry[] }).demarches;

/** Toutes les entrées du manifeste (disponibles et planifiées). */
export function listDemarcheSummaries(): DemarcheIndexEntry[] {
  return INDEX;
}

/** Contenu enrichi d'une démarche, résolu par `diagnosticId` ou par `slug`. */
export function getDemarcheContent(diagnosticId: string): DemarcheContent | undefined {
  const entry = INDEX.find((item) => item.diagnosticId === diagnosticId || item.slug === diagnosticId);
  if (!entry) return undefined;
  return CONTENT_BY_FILE[entry.file];
}

/** `true` si une démarche enrichie existe pour ce QCM. */
export function hasDemarcheContent(diagnosticId: string): boolean {
  return getDemarcheContent(diagnosticId) !== undefined;
}

/** Fichiers déclarés disponibles mais absents du registre (diagnostic d'intégrité). */
export function missingDemarcheFiles(): string[] {
  return INDEX.filter((entry) => entry.status === "available" && !CONTENT_BY_FILE[entry.file]).map(
    (entry) => entry.file,
  );
}
