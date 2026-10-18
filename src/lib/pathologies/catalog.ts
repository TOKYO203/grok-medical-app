import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PathologyContent } from "@/core/pathology";
import { fetchWithAuth } from "@/lib/auth/session";
import { pathologyAssetUrl, pathologyEntry } from "./manifest";
import type { PathologyAssetResult } from "./asset-reader.server";

/**
 * CHARGEUR des fiches de nosographie — CONTENU PREMIUM.
 *
 * ⚠️ Les fiches ne sont PLUS des actifs statiques publics. Elles vivent dans
 * `private/content/pathologies/` et ne sortent du serveur que contre un jeton
 * de contenu valide (voir `src/server/content-guard.ts`). `curl` sur
 * `/content/pathologies/<slug>.json` sans jeton répond désormais 401.
 *
 * Deux chemins, un seul garde :
 *   • SSR / navigation : fonction serveur (`createServerFn`) qui vérifie le
 *     jeton de la requête COURANTE (cookie `optimus_session` posé par
 *     `setToken`), donc la fiche est rendue dans le HTML initial ;
 *   • navigateur : `fetchWithAuth()` sur la route protégée, avec l'en-tête
 *     `Authorization: Bearer …`.
 *
 * Le type de retour est un ÉTAT, pas une valeur : une fiche peut être
 * *verrouillée* (pas de licence) ou *absente* (slug inconnu). Confondre les
 * deux afficherait « Premium requis » sur une URL qui n'existe pas.
 */

export type ContentLoad<T> =
  | { status: "ok"; data: T }
  | { status: "locked" }
  | { status: "missing" };

/**
 * Lecture SSR. Passer par `createServerFn` garantit que la lecture du contenu
 * privé est compilée UNIQUEMENT côté serveur : le handler est extrait du bundle
 * client, avec ses imports (donc sans les 1,1 Mo de fiches).
 */
const readAssetOnServer = createServerFn({ method: "GET" })
  .validator(
    z.object({
      file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/, "nom de fiche invalide"),
    }),
  )
  .handler(async ({ data }): Promise<PathologyAssetResult> => {
    const { readPathologyAsset } = await import("./asset-reader.server");
    return readPathologyAsset(data.file);
  });

/**
 * Contenu d'une fiche, chargé à la demande.
 *
 * `missing` couvre aussi le cas « item non publié » du manifeste : on ne
 * télécharge rien pour une fiche qui n'existe pas.
 */
export async function loadPathologyContent(idOrSlug: string): Promise<ContentLoad<PathologyContent>> {
  const entry = pathologyEntry(idOrSlug);
  if (!entry || entry.status !== "available") return { status: "missing" };

  if (import.meta.env.SSR) {
    try {
      const result = await readAssetOnServer({ data: { file: entry.file } });
      return result.status === "ok"
        ? { status: "ok", data: result.data }
        : { status: result.status };
    } catch {
      // Le transport de la fonction serveur peut échouer (runtime sans
      // contexte de requête) : on n'ouvre JAMAIS l'accès par défaut.
      return { status: "locked" };
    }
  }

  const response = await fetchWithAuth(pathologyAssetUrl(entry), {
    headers: { accept: "application/json" },
  });

  // 401 = pas de jeton / jeton invalide ou expiré ; 503 = protection non
  // configurée côté serveur. Dans les deux cas le contenu reste fermé.
  if (response.status === 401 || response.status === 403 || response.status === 503) {
    return { status: "locked" };
  }
  if (!response.ok) return { status: "missing" };

  return { status: "ok", data: (await response.json()) as PathologyContent };
}

/** Aperçu PUBLIC d'une fiche (titre + objectif), servi sans jeton. */
export type PathologyPreview = {
  slug: string;
  title: string;
  subtitle?: string;
  objective?: string;
  sectionTitles: string[];
  premium: true;
};

/**
 * Aperçu gratuit : de quoi annoncer une fiche verrouillée sans en divulguer le
 * contenu. Ne lève jamais — un aperçu manquant n'est qu'une absence de teaser.
 */
export async function loadPathologyPreview(slug: string): Promise<PathologyPreview | undefined> {
  try {
    const response = await fetch(`/content/previews/${slug}.json`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as PathologyPreview;
  } catch {
    return undefined;
  }
}
