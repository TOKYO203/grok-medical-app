import indexJson from "@/content/data/pathologies/_index.json";
import type { PathologyIndex, PathologyIndexEntry } from "@/core/pathology";

/**
 * MANIFESTE des fiches de nosographie — module PUR, sans réseau ni code
 * serveur. C'est le seul fichier de contenu encore statique : quelques
 * centaines d'octets suffisent à `/programme` pour afficher les liens sans
 * télécharger une seule fiche.
 *
 * ⚠️ Séparé de `./catalog.ts` volontairement : le catalogue porte le chargeur
 * (qui embarque `createServerFn`). Une page qui n'a besoin que du manifeste
 * importe CE module et ne tire donc ni le chargeur ni son runtime.
 *
 * Toute fiche déclarée `status: "available"` DOIT avoir son actif statique dans
 * `public/content/pathologies/` : `scripts/pathologies-catalog-integrity.test.mjs`
 * verrouille manifeste ↔ fichiers, `scripts/bundle-content.test.mjs` verrouille
 * fichiers ↔ publication (dist) et absence dans les chunks JS.
 */

/** Base publique des fiches, servie par le CDN (cache immutable). */
export const PATHOLOGY_ASSET_BASE = "/content/pathologies";

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
 * `true` si une fiche est ouverte pour cet item : déclarée disponible dans le
 * manifeste. L'existence de l'actif n'est pas vérifiable sans requête ; c'est
 * le test d'intégrité qui garantit manifeste ↔ fichiers, pas le runtime.
 */
export function hasPathologyContent(idOrSlug: string): boolean {
  return pathologyEntry(idOrSlug)?.status === "available";
}

/** URL publique du contenu d'une fiche (préchargement, QA, documentation). */
export function pathologyAssetUrl(entry: PathologyIndexEntry): string {
  return `${PATHOLOGY_ASSET_BASE}/${entry.file}`;
}
