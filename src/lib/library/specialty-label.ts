/**
 * Spécialité canonique d'un libellé brut du catalogue.
 *
 * Deux problèmes réglés ici :
 *  1. Certaines données portent une spécialité COMPOSITE — les démarches
 *     diagnostiques déclarent `"Urgences / Cardiologie"` ou
 *     `"Infectiologie / Urgences"`. Groupées sur la valeur brute, ces entrées
 *     créaient deux groupes fantômes dans la Bibliothèque (« Urgences /
 *     Cardiologie », « Infectiologie / Urgences ») qui n'affichaient qu'une
 *     donnée brute en guise d'en-tête.
 *  2. Le regroupement devait rester ALIGNÉ sur la spécialité qui débloque
 *     réellement le contenu (`specialtyCode` → `{CODE}_PACK_15`, branche
 *     `specialtyPackProduct`). Une démarche « Urgences / Cardiologie » est
 *     débloquée par le pack Cardiologie : elle doit donc être rangée sous
 *     Cardiologie, pas sous Urgences.
 *
 * On applique donc le MÊME ordre de priorité que le code d'accès
 * (cardio > neuro > infectio > urgences > dermato) à un module unique, pur et
 * testable (`node --experimental-strip-types`).
 */

/** Ordre significatif : le premier mot-clé trouvé décide (cf. `specialtyCode`). */
const CANONICAL_SPECIALTIES = [
  { code: "CARDIO", label: "Cardiologie", matches: "cardio" },
  { code: "NEURO", label: "Neurologie", matches: "neuro" },
  { code: "INFECTIO", label: "Infectiologie", matches: "infectio" },
  { code: "URGENCES", label: "Urgences", matches: "urgence" },
  { code: "DERMATO", label: "Dermatologie", matches: "dermato" },
] as const;

/** Séparateurs utilisés par le catalogue pour les spécialités multiples. */
const SEPARATORS = /\s*(?:\/|·|\|)\s*/;

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Spécialité canonique (code + label) reconnue dans un libellé brut, sinon `null`. */
export function canonicalSpecialty(raw: string): { code: string; label: string } | null {
  const haystack = fold(raw);
  for (const entry of CANONICAL_SPECIALTIES) {
    if (haystack.includes(entry.matches)) return { code: entry.code, label: entry.label };
  }
  return null;
}

/** Code produit d'une spécialité (ex. « Cardiologie » → `CARDIO`). */
export function specialtyCodeFromLabel(raw: string): string {
  return canonicalSpecialty(raw)?.code ?? raw.trim().toUpperCase();
}

/**
 * Spécialité de regroupement : le label canonique quand la spécialité est
 * reconnue (y compris composite), sinon le premier segment du libellé.
 */
export function primarySpecialty(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const canonical = canonicalSpecialty(trimmed);
  if (canonical) return canonical.label;
  const [first] = trimmed.split(SEPARATORS);
  return first.trim() || trimmed;
}

/** Vrai si le libellé annonce plusieurs spécialités (ex. « Urgences / Cardiologie »). */
export function isCompositeSpecialty(raw: string): boolean {
  return SEPARATORS.test(raw.trim());
}
