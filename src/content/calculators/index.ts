/**
 * Point d'entrée du moteur de calculateurs : `@/content/calculators`.
 * Ré-exporte le contrat (types) et le registre — c'est le SEUL chemin importé
 * par les routes et composants.
 */
export type {
  Calculator,
  CalculatorCategory,
  CalculatorField,
  CalculatorResult,
  CalculatorSeverity,
} from "./types";
export {
  CALCULATORS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCalculator,
  listCalculators,
  listCategoryGroups,
  type CalculatorCategoryGroup,
} from "./registry";
