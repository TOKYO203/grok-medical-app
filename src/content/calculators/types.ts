/**
 * Contrat du moteur de calculateurs cliniques.
 *
 * Un `Calculator` = métadonnées (id, catégorie, description, référence) +
 * une liste de `fields` — le formulaire est décrit par les DONNÉES, jamais par
 * du JSX — + une fonction `compute` **pure** qui transforme les valeurs saisies
 * en `CalculatorResult`.
 *
 * Conséquence : ajouter un score = ajouter 1 objet dans `scores/<categorie>.ts`.
 * L'UI (`CalculatorView`) rend n'importe quel `Calculator` sans modification.
 */

/** Les grandes familles cliniques regroupant les scores. */
export type CalculatorCategory =
  | "cardio"
  | "pneumo"
  | "nephro"
  | "neuro"
  | "infectio"
  | "urgences"
  | "pediatrie"
  | "psychiatrie"
  | "endoc"
  | "hemato"
  | "gastro"
  | "gyneco"
  | "onco"
  | "rhumato"
  | "anesthesie"
  | "general";

/** Gravité du résultat — pilote la couleur du badge. */
export type CalculatorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Un champ du formulaire. `type` détermine le contrôle rendu :
 * - `number`  → `<input type="number">` (avec `unit`, `min`, `max`, `step`)
 * - `boolean` → case à cocher
 * - `select`  → `<select>` (options fournies)
 */
export interface CalculatorField {
  id: string;
  label: string;
  type: "number" | "boolean" | "select";
  options?: { value: string; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  /** Pas de l'input numérique (défaut : 1). */
  step?: number;
  /** Aide courte affichée sous le champ. */
  help?: string;
  /** Valeur initiale du formulaire. */
  default?: number | boolean | string;
}

/** Résultat d'un calcul, prêt à afficher. */
export interface CalculatorResult {
  value: number | string;
  label?: string;
  interpretation?: string;
  severity?: CalculatorSeverity;
  reference?: string;
}

/** Un score / une règle de décision. */
export interface Calculator {
  id: string;
  label: string;
  categorie: CalculatorCategory;
  description: string;
  fields: CalculatorField[];
  compute: (inputs: Record<string, any>) => CalculatorResult;
  reference?: string;
  itemsProgramme?: string[];
}
