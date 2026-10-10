/**
 * Coercitions d'entrée partagées par tous les `compute()`.
 *
 * Les valeurs viennent du state React (formulaire) : elles peuvent être `""`
 * pendant la saisie, `undefined` au premier rendu, ou une chaîne issue d'un
 * `<select>`. Ces helpers garantissent que les formules restent pures et ne
 * jettent jamais.
 */

/** Nombre sûr : `NaN` / vide / non numérique → `fallback`. */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Booléen sûr. */
export function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Chaîne sûre (select). */
export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

/** Somme de points binaires (utile pour les scores à cases à cocher). */
export function points(...flags: boolean[]): number {
  return flags.reduce((sum, flag) => sum + (flag ? 1 : 0), 0);
}
