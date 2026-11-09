import indexJson from "@/content/data/demarches/_index.json";
import { fetchWithAuth } from "@/lib/auth/session";
import type { DemarcheContent, DemarcheIndexEntry } from "@/core/demarche";

/**
 * Chargeur de démarches enrichies — manifeste en bundle, contenu en actif statique.
 *
 * MIGRATION DU 2026-11-08 (déblocage worker Cloudflare Pages, plafond 25 Mo) :
 * les 43 fiches vivaient en imports statiques dans ce module, donc compilées
 * à la fois dans le bundle SERVEUR (chunk SSR /demarche/$id, ~1 Mo) et dans le
 * chunk client de la route. Le lot 5 (43 chapitres) a fait dépasser au bundle
 * Functions la limite de 25 Mo et figé la production. Les fiches vivent
 * désormais dans `public/content/demarches/` (actifs statiques publics) et se
 * chargent à la demande — c'est la « suite logique » documentée dans
 * scripts/bundle-content.test.mjs.
 *
 * ⚠️ SÉCURITÉ — PENTEST 2026-11-09 §15 : les fiches ne sont plus des actifs
 * statiques publics. Elles vivent copiées dans `private/content/demarches/`
 * (générées par `scripts/sync-catalog-data.mjs`) et sont retirées de
 * l'artefact publié par `scripts/strip-demarches-from-dist.mjs` : la route
 * `/content/$type/$file` ne les sert que contre un jeton de contenu, comme
 * les pathologies et les signes. `fetchWithAuth` joint le jeton ; un 401
 * retombe sur le stepper QCM seul (pas d'exception).
 * `scripts/demarches-catalog-integrity.test.mjs` verrouille manifeste ↔
 * actifs ; `scripts/bundle-content.test.mjs` interdit le retour du payload
 * dans un chunk JS.
 */

/** Base des fiches de démarches (servies par le garde de contenu). */
export const DEMARCHE_ASSET_BASE = "/content/demarches";

const INDEX: DemarcheIndexEntry[] = (indexJson as { demarches: DemarcheIndexEntry[] }).demarches;

/** Toutes les entrées du manifeste (disponibles et planifiées). */
export function listDemarcheSummaries(): DemarcheIndexEntry[] {
  return INDEX;
}

/** Entrée du manifeste, résolue par `diagnosticId` ou par `slug`. */
export function demarcheIndexEntry(idOrSlug: string): DemarcheIndexEntry | undefined {
  return INDEX.find((item) => item.diagnosticId === idOrSlug || item.slug === idOrSlug);
}

/** `true` si une démarche enrichie existe pour ce QCM. */
export function hasDemarcheContent(diagnosticId: string): boolean {
  return demarcheIndexEntry(diagnosticId)?.status === "available";
}

/**
 * Contenu enrichi d'une démarche, chargé à la demande depuis le CDN.
 * Ne lève jamais : une fiche absente est une absence normale (contenu retiré),
 * la route retombe sur le stepper QCM seul.
 */
export async function loadDemarcheContent(idOrSlug: string): Promise<DemarcheContent | undefined> {
  const entry = demarcheIndexEntry(idOrSlug);
  if (!entry || entry.status !== "available") return undefined;
  try {
    const response = await fetchWithAuth(`${DEMARCHE_ASSET_BASE}/${entry.file}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as DemarcheContent;
  } catch {
    return undefined;
  }
}
