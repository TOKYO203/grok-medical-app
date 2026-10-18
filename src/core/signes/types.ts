export type SigneCategory = "signe" | "syndrome" | "triade" | "tetrade" | "symptome";

/** Référence vérifiable affichée sous chaque fiche (traçabilité éditoriale). */
export type SigneSource = {
  organization: string;
  title: string;
  url: string;
};

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
  /** Sources (optionnelles) — le contenu publié en porte toujours au moins une. */
  sources?: SigneSource[];
};

export type SignesCatalog = {
  schemaVersion: number;
  items: SigneItem[];
};

/**
 * Manifeste `public/content/signes/_index.json` (PUBLIC).
 *
 * ⚠️ Format CANONIQUE fourni par le contenu éditorial : une catégorie n'est pas
 * un fichier, c'est une LISTE D'IDS dont chaque fiche est un actif autonome
 * (`private/content/signes/<id>.json`). Le manifeste ne contient donc aucun
 * texte médical — seulement la table des matières, lue avant de savoir quoi
 * demander. Les fiches, elles, sont servies sous jeton de contenu
 * (session Sécurité Premium S1).
 */
export type SignesIndex = {
  schemaVersion: number;
  description?: string;
  categories: Record<string, string[]>;
};
