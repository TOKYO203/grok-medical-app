import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PathologyContent } from "@/core/pathology";
import { pathologyAssetUrl, pathologyEntry } from "./manifest";

/**
 * CHARGEUR des fiches de nosographie.
 *
 * ⚠️ Le CONTENU n'est PAS un module : chaque fiche est un ACTIF STATIQUE
 * (`public/content/pathologies/<slug>.json`), publié tel quel sur le CDN et
 * récupéré par `fetch()`. Le bundle client ne contient donc ZÉRO octet de
 * fiche — ajouter 40 fiches n'ajoute pas 2 Mo de JavaScript, seulement 40
 * fichiers JSON téléchargés à la demande (et mis en cache « immutable »).
 *
 * Historique : les fiches étaient chargées par `import()` dynamique, ce qui
 * produisait bien un chunk séparé, mais chaque fiche restait un fichier
 * JavaScript compilé, compté dans le budget de bundle et recompilé à chaque
 * ajout. Mesure du batch 1 : 2 fiches = 81 Kio dans `dist/assets/`. À 43
 * fiches, l'approche plafonnait par construction — d'où ce changement.
 *
 * Le manifeste (`./manifest.ts`) reste le seul contenu statique.
 */

export {
  PATHOLOGY_ASSET_BASE,
  hasPathologyContent,
  listPathologySummaries,
  pathologyAssetUrl,
  pathologyEntry,
} from "./manifest";

/** Nom de fichier accepté : un slug minuscule + `.json`, rien d'autre. */
const assetName = z.object({
  file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/, "nom de fiche invalide"),
});

/**
 * Lecture SSR. Passer par `createServerFn` (plutôt qu'un import direct de
 * `./asset-reader.server`) garantit que la lecture disque est compilée
 * UNIQUEMENT côté serveur : le handler est extrait du bundle client, avec ses
 * imports. C'est le mécanisme déjà utilisé par `purchase-orders.ts` et
 * `content-reports.ts`.
 */
const readAssetOnServer = createServerFn({ method: "GET" })
  .validator(assetName)
  .handler(async ({ data }) => {
    const { readPathologyAsset } = await import("./asset-reader.server");
    return readPathologyAsset(data.file);
  });

/**
 * Contenu d'une fiche, chargé à la demande (`undefined` si absente).
 *
 * • Serveur (SSR) : lecture disque (ou origine en repli), sans requête HTTP
 *   inutile — voir `asset-reader.server.ts`.
 * • Navigateur : `fetch` de l'actif statique, servi par le CDN.
 *
 * `import.meta.env.SSR` est remplacé à la compilation : le bundle client ne
 * contient même pas la référence au lecteur serveur.
 */
export async function loadPathologyContent(idOrSlug: string): Promise<PathologyContent | undefined> {
  const entry = pathologyEntry(idOrSlug);
  if (!entry || entry.status !== "available") return undefined;

  if (import.meta.env.SSR) {
    const content = await readAssetOnServer({ data: { file: entry.file } });
    return content ?? undefined;
  }

  const response = await fetch(pathologyAssetUrl(entry), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return undefined;
  return (await response.json()) as PathologyContent;
}
