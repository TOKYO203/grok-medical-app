/**
 * Moteur d'apprentissage d'histologie pathologique.
 *
 * But : apprendre à un étudiant à LIRE une lame — repérer les structures,
 * reconnaître la coloration, raisonner du patron vers le diagnostic.
 *
 * Sources d'images : uniquement CC0, CC BY, CC BY-SA ou domaine public
 * (Wikimedia Commons, NIH/NCBI, OpenStax, Yale Histology).
 * JAMAIS Radiopaedia (CC BY-NC, usage commercial interdit).
 */

export type HistologyStaining = "H&E" | "Ziehl-Neelsen" | "PAS" | "Giemsa" | "Perls" | "autre";

export type HistologyAnnotation = {
  /** Coordonnées et taille en pourcentage de l'image (0-100). */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type HistologySlide = {
  id: string;
  title: string;
  /** Tissu d'origine (ex. « Côlon — muqueuse »). */
  tissue: string;
  /** Pathologie illustrée (ex. « Cancer colorectal »). */
  pathology: string;
  staining: HistologyStaining;
  /** Grossissement affiché (ex. « ×40 »). */
  magnification: string;
  imageUrl: string;
  imageAlt: string;
  /** Source de l'image — attribution obligatoire. */
  source: string;
  sourceUrl: string;
  license: "CC0" | "CC-BY" | "CC-BY-SA" | "public-domain";
  description: string;
  keyFeatures: string[];
  annotations: HistologyAnnotation[];
  diagnosis: string;
  /** Diagnostics différentiels histologiques. */
  differential?: string[];
  /** Slug d'une pathologie liée (dans private/content/pathologies/). */
  linkedPathology?: string;
};

/** Toutes les lames disponibles (fichiers ./data/histologie/*.json). */
export function listSlides(): HistologySlide[] {
  const modules = import.meta.glob<{ default: HistologySlide }>(
    "./data/histologie/*.json",
    { eager: true },
  );
  const slides: HistologySlide[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    if (path.includes("_index")) continue;
    if (mod.default) slides.push(mod.default);
  }
  return slides.sort((a, b) => a.id.localeCompare(b.id));
}

/** Retourne la lame dont l'id (slug) est fourni, ou null. */
export function findSlideBySlug(id: string): HistologySlide | null {
  return listSlides().find((s) => s.id === id) ?? null;
}

/** Lames liées à une pathologie (slug), triées par id. */
export function findSlidesForPathology(slug: string): HistologySlide[] {
  return listSlides().filter((s) => s.linkedPathology === slug);
}
