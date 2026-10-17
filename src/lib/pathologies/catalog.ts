import indexJson from "@/content/data/pathologies/_index.json";
import type { PathologyContent, PathologyIndex, PathologyIndexEntry } from "@/core/pathology";

/**
 * Catalogue des fiches de nosographie.
 *
 * ⚠️ Le CONTENU est chargé à la demande (`loadPathologyContent`), jamais
 * importé statiquement : une fiche de cours pèse ~49 Kio minifiée, et le
 * référentiel compte 240 items. Les importer en tête ferait grossir le bundle
 * initial à chaque fiche ajoutée, alors qu'un lecteur n'en ouvre qu'une.
 * Seul le manifeste (`_index.json`, quelques centaines d'octets) est statique —
 * il alimente les liens de `/programme` sans télécharger de contenu.
 *
 * ⚠️ Toute fiche déclarée `status: "available"` DOIT avoir un chargeur dans
 * `LOADERS`, sinon `loadPathologyContent()` renvoie `undefined` et la route
 * affiche « Fiche introuvable » alors que le manifeste l'annonce. Le garde-fou
 * `scripts/pathologies-catalog-integrity.test.mjs` verrouille ce lien.
 */
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "paludisme.json": () => import("@/content/data/pathologies/paludisme.json"),
};

const INDEX = indexJson as PathologyIndex;

/** Toutes les entrées du manifeste (disponibles et planifiées). */
export function listPathologySummaries(): PathologyIndexEntry[] {
  return INDEX.fiches;
}

/** Entrée du manifeste, résolue par `slug` OU par `id` d'item du programme. */
export function pathologyEntry(idOrSlug: string): PathologyIndexEntry | undefined {
  return INDEX.fiches.find((entry) => entry.slug === idOrSlug || entry.programmeId === idOrSlug);
}

/**
 * `true` si une fiche est réellement ouvrable pour cet item : déclarée
 * disponible ET branchée. Utilisé par `/programme` pour ne pas produire de
 * lien mort — c'est la même règle que `hasDemarcheContent`.
 */
export function hasPathologyContent(idOrSlug: string): boolean {
  const entry = pathologyEntry(idOrSlug);
  return entry?.status === "available" && LOADERS[entry.file] !== undefined;
}

/** Contenu d'une fiche, chargé à la demande (`undefined` si absente). */
export async function loadPathologyContent(idOrSlug: string): Promise<PathologyContent | undefined> {
  const entry = pathologyEntry(idOrSlug);
  if (!entry || entry.status !== "available") return undefined;
  const load = LOADERS[entry.file];
  if (!load) return undefined;
  const module = await load();
  return module.default as PathologyContent;
}

/** Fichiers déclarés disponibles mais absents du registre (diagnostic d'intégrité). */
export function missingPathologyFiles(): string[] {
  return INDEX.fiches
    .filter((entry) => entry.status === "available" && !LOADERS[entry.file])
    .map((entry) => entry.file);
}
