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
