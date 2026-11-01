/**
 * Moteur « Examens complémentaires » — ce qu'on CHERCHE, pas ce qu'on commande.
 *
 * Principe : chaque examen répond à UNE question clinique précise.
 * - Mauvais : « ECG » (inutile seul).
 * - Bon : « ECG : chercher un sus-décalage ST (SCA) ou un trouble du rythme ».
 *
 * Sources de référence : SFBC, HAS, OMS, ESC, SPILF.
 */

/** Délai d'obtention attendu pour un examen. */
export type Urgency = "immediate" | "rapide" | "programmable";

/** Un examen prescrit pour répondre à une question clinique unique. */
export type Exam = {
  name: string;
  urgency: Urgency;
  /** Pourquoi cet examen (question clinique posée). */
  rationale: string;
  /** Le signe / la valeur à chercher sur le résultat. */
  findingToLook: string;
  /** Interprétation si le résultat est positif / négatif. */
  result: {
    positive: string;
    negative: string;
  };
};

/** Signe d'alerte imposant une action immédiate. */
export type RedFlag = {
  sign: string;
  action: string;
};

/** Une indication clinique complète (symptôme → stratégie d'examens). */
export type Indication = {
  id: string;
  /** Symptôme principal (ex. « Douleur thoracique »). */
  symptom: string;
  /** Contexte de survenue (ex. « Adulte, hors traumatisme »). */
  context: string;
  /** Définition / cadrage du symptôme. */
  definition: string;
  redFlags: RedFlag[];
  /** 1ʳᵉ intention — à trier par urgence (immediate < rapide < programmable). */
  firstLine: Exam[];
  /** 2ᵉ intention — selon orientation. */
  secondLine: Exam[];
  /** Examens à NE PAS faire. */
  notRecommended: string[];
  /** Slugs de pathologies liées (private/content/pathologies/). */
  linkedPathologies: string[];
};

/** Toutes les indications disponibles (fichiers ./data/examens-complementaires/*.json). */
export function listIndications(): Indication[] {
  const modules = import.meta.glob<{ default: Indication }>(
    "./data/examens-complementaires/*.json",
    { eager: true },
  );
  const indications: Indication[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    if (path.includes("_index")) continue;
    if (mod.default) indications.push(mod.default);
  }
  return indications.sort((a, b) => a.id.localeCompare(b.id));
}

/** Retourne l'indication dont l'id (slug) est fourni, ou null. */
export function findIndicationBySlug(id: string): Indication | null {
  return listIndications().find((i) => i.id === id) ?? null;
}

/** Tri d'urgence pour l'affichage : immediate → rapide → programmable. */
export function urgencyRank(u: Urgency): number {
  return u === "immediate" ? 0 : u === "rapide" ? 1 : 2;
}
