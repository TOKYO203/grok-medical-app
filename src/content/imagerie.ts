/**
 * Moteur d'apprentissage d'imagerie médicale.
 *
 * But : apprendre à un étudiant à INTERPRÉTER une image (pas à diagnostiquer).
 * Méthode : parcours systématique (ABCDE pour le thorax) + QCM step-by-step.
 *
 * Sources d'images : uniquement CC0, CC BY, ou domaine public
 * (Wikimedia Commons, MedPix NIH, ChestX-ray14). JAMAIS Radiopaedia (CC BY-NC).
 */

export type ImagingModality = "radio" | "scanner" | "irm" | "echo" | "autre";

export type ImagingHighlight = {
  /** Coordonnées en pourcentage de l'image (0-100). */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type ImagingStep = {
  /** Lettre de la méthode (A, B, C, ...). */
  step: string;
  /** Nom long de l'étape (Airway, Bones, Cardiac, ...). */
  letter: string;
  /** Question posée à l'étudiant. */
  question: string;
  /** Options (2 à 5). */
  options: string[];
  /** Index de la bonne réponse (0-based). */
  correctIndex: number;
  /** Explication pédagogique affichée après la réponse. */
  explanation: string;
  /** Zone à surligner sur l'image (optionnel). */
  highlight?: ImagingHighlight;
};

export type ImagingCase = {
  id: string;
  modality: ImagingModality;
  title: string;
  clinical: string;
  imageUrl: string;
  imageAlt: string;
  source: string;
  sourceUrl: string;
  license: "CC0" | "CC-BY" | "CC-BY-SA" | "public-domain";
  method: string;
  steps: ImagingStep[];
  finalDiagnosis: string;
  keyFindings: string[];
  /** Slug d'une pathologie liée (dans private/content/pathologies/). */
  linkedPathology?: string;
};

export const IMAGING_METHODS: Record<string, string[]> = {
  ABCDE: [
    "A — Airway (voies aériennes)",
    "B — Bones (os)",
    "C — Cardiac (silhouette cardiaque)",
    "D — Diaphragm (diaphragme)",
    "E — Effusion / Fields (poumons)",
    "F — Foreign / Implants (matériel)",
    "G — Gastric bubble (bulle gastrique)",
    "H — Hila (hiles)",
  ],
};


/**
 * Retourne le cas d'imagerie dont `linkedPathology` correspond au slug
 * fourni (ou null si aucun cas n'est lie).
 */
export function findImagingCaseBySlug(slug: string): ImagingCase | null {
  const modules = import.meta.glob<{ default: ImagingCase }>(
    "./data/imagerie/*.json",
    { eager: true },
  );
  for (const [path, mod] of Object.entries(modules)) {
    if (path.includes("_index")) continue;
    if (mod.default?.linkedPathology === slug) {
      return mod.default;
    }
  }
  return null;
}
