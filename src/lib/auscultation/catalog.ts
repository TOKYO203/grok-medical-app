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

import pulmonaireIndexJson from "@/content/data/auscultation/pulmonaire/_index.json";
import murmureVesiculaire from "@/content/data/auscultation/pulmonaire/normal/murmure-vesiculaire.json";
import bruitTracheal from "@/content/data/auscultation/pulmonaire/normal/bruit-tracheal.json";
import craquementsBasseFrequence from "@/content/data/auscultation/pulmonaire/pathologique/craquements-basse-frequence.json";
import craquementsMoyenneFrequence from "@/content/data/auscultation/pulmonaire/pathologique/craquements-moyenne-frequence.json";
import craquementsHauteFrequence from "@/content/data/auscultation/pulmonaire/pathologique/craquements-haute-frequence.json";
import craquementsPleuraux from "@/content/data/auscultation/pulmonaire/pathologique/craquements-pleuraux.json";
import sibilances from "@/content/data/auscultation/pulmonaire/pathologique/sibilances.json";
import stridor from "@/content/data/auscultation/pulmonaire/pathologique/stridor.json";
import soufflesBronchiques from "@/content/data/auscultation/pulmonaire/pathologique/souffles-bronchiques.json";
import soufflePleuretique from "@/content/data/auscultation/pulmonaire/pathologique/souffle-pleuretique.json";

/**
 * Chargeur de contenu Auscultation — index + fiches (bundle statique, offline).
 *
 * Les fiches cardiaques vivent sous `cardiaque/` (normal | pathologique) et les
 * fiches pulmonaires sous `pulmonaire/` (étape 3/3). Chaque module possède son
 * propre manifeste `_index.json` (foyers pour le cœur, zones pour le poumon).
 *
 * ⚠️ Tout fichier listé `status: "available"` dans un `_index.json` DOIT être
 * enregistré dans le registre correspondant, sinon `getFiche()` /
 * `getPulmonaireFiche()` renvoie `undefined` (fiche cliquable mais vide).
 * Même contrat que `src/lib/ecg/catalog.ts`.
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

/* ═══════════════════════════════════════════════════════════════════
   Module pulmonaire (étape 3/3)
   ───────────────────────────────────────────────────────────────────
   Manifeste dédié `pulmonaire/_index.json` : zones d'auscultation
   (trachée, sommets, bases, axillaire, diffus) + 10 sons. Les fiches
   utilisent la nomenclature clinique des « craquements » de basse,
   moyenne et haute fréquence.
   ═══════════════════════════════════════════════════════════════════ */

export type PulmonaireZone = {
  id: string;
  label: string;
  short: string;
  emoji: string;
  localisation: string;
};

export type PulmonaireSoundEntry = {
  id: string;
  label: string;
  categorie: string;
  zones: string[];
  file: string | null;
  status: AuscultationSoundStatus;
};

export type PulmonaireVariation = { manoeuvre: string; effet: string };

export type PulmonaireTiming = {
  phase: string;
  moment: string;
  caractere: string;
  schema: string;
};

export type PulmonaireFiche = {
  id: string;
  label: string;
  categorie: string;
  zone: string[];
  timing: PulmonaireTiming;
  timbre: string;
  frequence: string;
  localisation: string;
  variations: PulmonaireVariation[];
  pathologies_associees: string[];
  diagnostics_differentiels: string[];
  audio: AuscultationAudio;
  items_programme: string[];
  pieges: string[];
  source: { type: string; reference: string; license: string };
};

const PULMONAIRE_FICHES_BY_FILE: Record<string, PulmonaireFiche> = {
  "pulmonaire/normal/murmure-vesiculaire.json": murmureVesiculaire as unknown as PulmonaireFiche,
  "pulmonaire/normal/bruit-tracheal.json": bruitTracheal as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/craquements-basse-frequence.json":
    craquementsBasseFrequence as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/craquements-moyenne-frequence.json":
    craquementsMoyenneFrequence as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/craquements-haute-frequence.json":
    craquementsHauteFrequence as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/craquements-pleuraux.json": craquementsPleuraux as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/sibilances.json": sibilances as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/stridor.json": stridor as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/souffles-bronchiques.json": soufflesBronchiques as unknown as PulmonaireFiche,
  "pulmonaire/pathologique/souffle-pleuretique.json": soufflePleuretique as unknown as PulmonaireFiche,
};

export function listPulmonaireZones(): PulmonaireZone[] {
  return pulmonaireIndexJson.zones as unknown as PulmonaireZone[];
}

export function listPulmonaireSounds(): PulmonaireSoundEntry[] {
  return pulmonaireIndexJson.sounds as unknown as PulmonaireSoundEntry[];
}

/** Fiches pulmonaires réellement disponibles (fichier présent + enregistré). */
export function listPulmonaireFiches(): PulmonaireSoundEntry[] {
  return listPulmonaireSounds().filter(
    (s) => s.status === "available" && !!s.file && PULMONAIRE_FICHES_BY_FILE[s.file],
  );
}

export function getPulmonaireSound(id: string): PulmonaireSoundEntry | undefined {
  return listPulmonaireSounds().find((s) => s.id === id);
}

export function getPulmonaireFiche(id: string): PulmonaireFiche | undefined {
  const entry = getPulmonaireSound(id);
  if (!entry || !entry.file) return undefined;
  return PULMONAIRE_FICHES_BY_FILE[entry.file];
}

export function pulmonaireZoneById(id: string): PulmonaireZone | undefined {
  return listPulmonaireZones().find((z) => z.id === id);
}

/** Fiches pulmonaires annoncées disponibles mais non enregistrées. */
export function missingPulmonaireFicheFiles(): string[] {
  return listPulmonaireSounds()
    .filter((s) => s.status === "available" && s.file && !PULMONAIRE_FICHES_BY_FILE[s.file])
    .map((s) => s.id);
}
