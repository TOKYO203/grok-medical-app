/**
 * Référentiels officiels de concours — architecture **multi-programme**.
 *
 * Un référentiel = une entrée du catalogue `data/programmes/_index.json`
 * (métadonnées : pays, autorité, année, sections annoncées) + un fichier de
 * contenu `data/programmes/<fichier>.json` (les items officiels).
 *
 * Pourquoi séparer les deux ? Le catalogue reste léger et lisible (il décrit ce
 * qui existe), le contenu peut être volumineux. Ajouter un pays (France EDN,
 * Sénégal…) = 1 fichier JSON + 1 fichier dans le catalogue + 1 ligne dans
 * `CONTENT_BY_FILE` ci-dessous.
 *
 * Un deck pourra plus tard référencer des items de **plusieurs** référentiels :
 * rien ici ne suppose qu'un item appartient à un seul programme.
 */

import catalogueJson from "./data/programmes/_index.json";
import madagascar2025Json from "./data/programmes/madagascar-2025.json";

/** Un item officiel du référentiel (numéroté tel que publié). */
export type ProgrammeItem = {
  /** Numéro officiel de l'item (ordre du référentiel, pas un index). */
  n: number;
  /** Identifiant stable, unique au sein de sa section. */
  id: string;
  title: string;
  /** Spécialité telle que publiée (ex. « Gynécologie-Obstétrique »). */
  specialty: string;
};

export type ProgrammeSection = {
  id: string;
  label: string;
  description: string;
  items: ProgrammeItem[];
};

/** Spécialité d'un programme et son volume d'items (du plus volumineux au moins). */
export type ProgrammeSpecialtyCount = { specialty: string; count: number };

export type Programme = {
  id: string;
  label: string;
  short: string;
  /**
   * Nom d'affichage du pays (« Madagascar »). Le catalogue, lui, porte le code
   * ISO alpha-2 (`MG`) — c'est le nom d'affichage qui est préféré ici.
   */
  pays: string;
  flag: string;
  annee: number;
  autorite: string;
  /** Date de publication du référentiel (ISO `YYYY-MM-DD`), vide si inconnue. */
  date: string;
  /** Référentiel du concours obligatoire pour le pays concerné. */
  obligatoire: boolean;
  /** Référentiel sélectionné par défaut dans l'app. */
  isDefault: boolean;
  sections: ProgrammeSection[];
  /** Total d'items annoncé par le catalogue. */
  total: number;
};

/** Contenu brut d'un fichier `data/programmes/<fichier>.json`. */
type RawProgrammeFile = {
  pays?: string;
  flag?: string;
  annee?: number;
  autorite?: string;
  date?: string;
  total?: number;
  sections?: {
    id: string;
    label: string;
    description?: string;
    items?: ProgrammeItem[];
  }[];
};

/**
 * Fichiers de contenu connus du bundler (clé = champ `fichier` du catalogue).
 * Un import statique par référentiel : indispensable pour que Vite embarque le
 * JSON dans le bundle client.
 */
const CONTENT_BY_FILE: Record<string, RawProgrammeFile> = {
  "madagascar-2025.json": madagascar2025Json as RawProgrammeFile,
};

export const PROGRAMMES: Programme[] = catalogueJson.programmes.flatMap((entry) => {
  const content = CONTENT_BY_FILE[entry.fichier];
  // Le catalogue peut lister un référentiel dont le contenu n'est pas encore
  // embarqué : on l'ignore silencieusement plutôt que de planter le rendu.
  if (!content) return [];

  const sections: ProgrammeSection[] = (content.sections ?? []).map((section) => ({
    id: section.id,
    label: section.label,
    description: section.description ?? "",
    items: section.items ?? [],
  }));

  return [
    {
      id: entry.id,
      label: entry.label,
      short: entry.short,
      pays: content.pays ?? entry.pays,
      flag: content.flag ?? entry.flag,
      annee: content.annee ?? entry.annee,
      autorite: content.autorite ?? entry.autorite,
      date: content.date ?? "",
      obligatoire: entry.obligatoire,
      isDefault: entry.default,
      sections,
      total: content.total ?? sections.reduce((sum, section) => sum + section.items.length, 0),
    },
  ];
});

export function listProgrammes(): Programme[] {
  return PROGRAMMES;
}

export function getProgramme(id: string): Programme | undefined {
  return PROGRAMMES.find((programme) => programme.id === id);
}

/** Référentiel affiché par défaut (première entrée si aucun n'est marqué défaut). */
export function getDefaultProgramme(): Programme | undefined {
  return PROGRAMMES.find((programme) => programme.isDefault) ?? PROGRAMMES[0];
}

/** Tous les items d'un programme, sections aplaties. */
export function programmeItems(programme: Programme): ProgrammeItem[] {
  return programme.sections.flatMap((section) => section.items);
}

/** Nombre réel d'items d'un programme (toutes sections confondues). */
export function programmeItemCount(programme: Programme): number {
  return programme.sections.reduce((total, section) => total + section.items.length, 0);
}

/** Spécialités d'un programme, triées par volume décroissant puis alphabétiquement. */
export function programmeSpecialties(programme: Programme): ProgrammeSpecialtyCount[] {
  const counts = new Map<string, number>();
  for (const item of programmeItems(programme)) {
    counts.set(item.specialty, (counts.get(item.specialty) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([specialty, count]) => ({ specialty, count }))
    .sort((a, b) => b.count - a.count || a.specialty.localeCompare(b.specialty, "fr"));
}

/**
 * Clé unique d'un item dans le programme (les `id` ne sont garantis uniques que
 * dans leur section). Utile comme `key` React et pour une future progression.
 */
export function programmeItemKey(sectionId: string, itemId: string): string {
  return `${sectionId}:${itemId}`;
}
