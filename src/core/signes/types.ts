export type SigneCategory = "signe" | "syndrome" | "triade" | "tetrade" | "symptome";

export type SigneItem = {
  id: string;
  category: SigneCategory;
  /** Le nom de la maladie/syndrome (ex: "Syndrome de Cushing") */
  disease: string;
  /** La liste des signes (ex: ["HTA", "Vergetures pourpres"]) */
  signs: string[];
  /** Le cas clinique (mini-scénario) */
  clinicalCase: string;
  /** La question posée (ex: "Quel syndrome évoquez-vous ?") */
  question: string;
  /** Les options de réponse (ex: ["Cushing", "Addison", "Conn"]) */
  options: string[];
  /** L'index de la bonne réponse dans options */
  correctIndex: number;
  /** Explication (optionnelle) */
  explanation?: string;
};

export type SignesCatalog = {
  schemaVersion: number;
  items: SigneItem[];
};

/**
 * Entrée du MANIFESTE (`public/content/signes/_index.json`) : une CATÉGORIE de
 * contenu = un actif statique. `status: "planned"` annonce une catégorie sans
 * fichier publié (le contenu arrive par lots, sans toucher au code).
 */
export type SignesCategoryEntry = {
  id: SigneCategory;
  /** Libellé affiché (porté par le contenu, comme les titres de decks). */
  label: string;
  file: string;
  status: "available" | "planned";
  /** Nombre d'items annoncé — contrôlé par le test d'intégrité. */
  count?: number;
};

export type SignesIndex = {
  schemaVersion: number;
  categories: SignesCategoryEntry[];
};
