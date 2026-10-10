import indexJson from "@/content/data/auscultation/_index.json";
import b1b2Normal from "@/content/data/auscultation/cardiaque/normal/b1-b2-normal.json";
import dedoublementB2 from "@/content/data/auscultation/cardiaque/normal/dedoublement-b2.json";
import b3Galop from "@/content/data/auscultation/cardiaque/normal/b3.json";
import b4Galop from "@/content/data/auscultation/cardiaque/normal/b4.json";
import insuffisanceMitrale from "@/content/data/auscultation/cardiaque/pathologique/insuffisance-mitrale.json";
import retrecissementMitral from "@/content/data/auscultation/cardiaque/pathologique/retrecissement-mitral.json";
import insuffisanceAortique from "@/content/data/auscultation/cardiaque/pathologique/insuffisance-aortique.json";
import retrecissementAortique from "@/content/data/auscultation/cardiaque/pathologique/retrecissement-aortique.json";
import frottementPericardique from "@/content/data/auscultation/cardiaque/pathologique/frottement-pericardique.json";
import fibrillationAtriale from "@/content/data/auscultation/cardiaque/pathologique/fibrillation-atriale.json";

/**
 * Chargeur de contenu Auscultation — index + fiches (bundle statique, offline).
 *
 * Les fiches cardiaques vivent sous `cardiaque/` (normal | pathologique) ; les
 * sons pulmonaires viendront sous `pulmonaire/` (étape 3/3).
 *
 * ⚠️ Tout fichier listé `status: "available"` dans `_index.json` DOIT être
 * enregistré dans `FICHES_BY_FILE`, sinon `getFiche()` renvoie `undefined`
 * (fiche cliquable mais vide). Même contrat que `src/lib/ecg/catalog.ts`.
 */

export type AuscultationFoyer = {
  id: string;
  label: string;
  short: string;
  emoji: string;
  localisation: string;
};

export type AuscultationSoundStatus = "available" | "planned";

export type AuscultationSoundEntry = {
  id: string;
  label: string;
  categorie: string;
  foyers: string[];
  file: string | null;
  status: AuscultationSoundStatus;
};

export type AuscultationTiming = {
  phase: string;
  morphologie: string;
  schema: string;
  description: string;
};

export type AuscultationAudio = {
  kind: string;
  preset: string;
  params: Record<string, number>;
};

export type AuscultationFiche = {
  id: string;
  label: string;
  categorie: string;
  foyer: string[];
  timing: AuscultationTiming;
  timbre: string;
  irradiation: string;
  symptomes: string[];
  palpation: string;
  audio: AuscultationAudio;
  manoeuvres: string[];
  diagnostics_associes: string[];
  items_programme: string[];
  pieges: string[];
  source: { type: string; reference: string; license: string };
};

const FICHES_BY_FILE: Record<string, AuscultationFiche> = {
  "cardiaque/normal/b1-b2-normal.json": b1b2Normal as unknown as AuscultationFiche,
  "cardiaque/normal/dedoublement-b2.json": dedoublementB2 as unknown as AuscultationFiche,
  "cardiaque/normal/b3.json": b3Galop as unknown as AuscultationFiche,
  "cardiaque/normal/b4.json": b4Galop as unknown as AuscultationFiche,
  "cardiaque/pathologique/insuffisance-mitrale.json": insuffisanceMitrale as unknown as AuscultationFiche,
  "cardiaque/pathologique/retrecissement-mitral.json":
    retrecissementMitral as unknown as AuscultationFiche,
  "cardiaque/pathologique/insuffisance-aortique.json":
    insuffisanceAortique as unknown as AuscultationFiche,
  "cardiaque/pathologique/retrecissement-aortique.json":
    retrecissementAortique as unknown as AuscultationFiche,
  "cardiaque/pathologique/frottement-pericardique.json":
    frottementPericardique as unknown as AuscultationFiche,
  "cardiaque/pathologique/fibrillation-atriale.json":
    fibrillationAtriale as unknown as AuscultationFiche,
};

export function listFoyers(): AuscultationFoyer[] {
  return indexJson.foyers as unknown as AuscultationFoyer[];
}

export function listSounds(): AuscultationSoundEntry[] {
  return indexJson.sounds as unknown as AuscultationSoundEntry[];
}

/** Fiches réellement disponibles (fichier présent + enregistré). */
export function listFiches(): AuscultationSoundEntry[] {
  return listSounds().filter((s) => s.status === "available" && !!s.file && FICHES_BY_FILE[s.file]);
}

export function getSound(id: string): AuscultationSoundEntry | undefined {
  return listSounds().find((s) => s.id === id);
}

export function getFiche(id: string): AuscultationFiche | undefined {
  const entry = getSound(id);
  if (!entry || !entry.file) return undefined;
  return FICHES_BY_FILE[entry.file];
}

export function foyerById(id: string): AuscultationFoyer | undefined {
  return listFoyers().find((f) => f.id === id);
}

/** Fiches annoncées disponibles mais dont le contenu n'est pas enregistré. */
export function missingFicheFiles(): string[] {
  return listSounds()
    .filter((s) => s.status === "available" && s.file && !FICHES_BY_FILE[s.file])
    .map((s) => s.id);
}
