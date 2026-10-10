import type { Calculator, CalculatorCategory } from "./types";
import { CARDIO_CALCULATORS } from "./scores/cardio";
import { PNEUMO_CALCULATORS } from "./scores/pneumo";
import { NEPHRO_CALCULATORS } from "./scores/nephro";
import { NEURO_CALCULATORS } from "./scores/neuro";
import { INFECTIO_CALCULATORS } from "./scores/infectio";
import { URGENCES_CALCULATORS } from "./scores/urgences";
import { PEDIATRIE_CALCULATORS } from "./scores/pediatrie";
import { PSYCHIATRIE_CALCULATORS } from "./scores/psychiatrie";
import { GENERAL_CALCULATORS } from "./scores/general";

/**
 * Registre unique de tous les calculateurs.
 *
 * Ajouter un score = l'ajouter au tableau de sa catégorie dans `scores/*.ts`.
 * La page `/calculateurs` et l'index de la bibliothèque lisent ce registre :
 * aucune modification d'UI n'est nécessaire.
 */

export const CALCULATORS: Calculator[] = [
  ...CARDIO_CALCULATORS,
  ...PNEUMO_CALCULATORS,
  ...NEPHRO_CALCULATORS,
  ...NEURO_CALCULATORS,
  ...INFECTIO_CALCULATORS,
  ...URGENCES_CALCULATORS,
  ...PEDIATRIE_CALCULATORS,
  ...PSYCHIATRIE_CALCULATORS,
  ...GENERAL_CALCULATORS,
];

/** Libellés d'affichage, dans l'ordre des onglets. */
export const CATEGORY_LABELS: Record<CalculatorCategory, string> = {
  cardio: "Cardio",
  pneumo: "Pneumo",
  nephro: "Néphro",
  neuro: "Neuro",
  infectio: "Infectio",
  urgences: "Urgences",
  pediatrie: "Pédiatrie",
  psychiatrie: "Psychiatrie",
  endoc: "Endocrino",
  hemato: "Hémato",
  gastro: "Gastro",
  gyneco: "Gynéco",
  onco: "Onco",
  rhumato: "Rhumatologie",
  anesthesie: "Anesthésie",
  general: "Général",
};

/** Ordre d'affichage des onglets sur `/calculateurs`. */
export const CATEGORY_ORDER: CalculatorCategory[] = [
  "cardio",
  "pneumo",
  "nephro",
  "neuro",
  "infectio",
  "urgences",
  "pediatrie",
  "psychiatrie",
  "general",
];

/** Tous les calculateurs (copie défensive du registre). */
export function listCalculators(): Calculator[] {
  return CALCULATORS;
}

/** Un calculateur par identifiant. */
export function getCalculator(id: string): Calculator | undefined {
  return CALCULATORS.find((calc) => calc.id === id);
}

export interface CalculatorCategoryGroup {
  category: CalculatorCategory;
  label: string;
  items: Calculator[];
}

/**
 * Catégories non vides, dans l'ordre d'affichage — une catégorie sans score
 * n'apparaît jamais comme onglet vide.
 */
export function listCategoryGroups(): CalculatorCategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: CALCULATORS.filter((calc) => calc.categorie === category),
  })).filter((group) => group.items.length > 0);
}
