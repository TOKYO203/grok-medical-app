import indexJson from "@/content/data/auscultation/_index.json";
import b1b2Normal from "@/content/data/auscultation/normal/b1-b2-normal.json";

/**
 * Chargeur de contenu Auscultation — index + fiches (bundle statique, offline).
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
  "normal/b1-b2-normal.json": b1b2Normal as unknown as AuscultationFiche,
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
