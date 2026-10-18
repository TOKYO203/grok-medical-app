import type { PathologyContent } from "@/core/pathology";
import { readProtectedAsset } from "@/lib/content/protected-assets.server";
import { authenticateCurrentRequest } from "@/server/content-guard";

/**
 * Lecture SERVEUR d'une fiche de nosographie — GARDÉE.
 *
 * ⚠️ Ce lecteur est le SEUL accès serveur au contenu des fiches, et il exige un
 * jeton de contenu valide pour la requête courante. Il est appelé :
 *   • par la fonction serveur de `./catalog.ts` (rendu SSR d'une fiche) ;
 *   • indirectement par la route `/content/$type/$file` ? NON : celle-ci lit
 *     `@/lib/content/protected-assets.server` directement, après son propre
 *     contrôle — elle ne dépend donc pas du contexte `getRequest()`.
 *
 * POURQUOI LE GARDE EST ICI AUSSI
 * Une fonction serveur TanStack Start est un endpoint HTTP PUBLIC : sans
 * vérification, `POST /_server/…` (ou l'URL équivalente générée) aurait servi
 * les fiches à n'importe qui, annulant tout le chantier. Le contrôle porte donc
 * sur la REQUÊTE, jamais sur la seule intention de l'appelant.
 *
 * La lecture elle-même est compilée avec le bundle serveur
 * (`import.meta.glob`, voir `protected-assets.server.ts`) : plus aucun
 * `readFile` ni `fetch` vers le CDN, donc plus aucun contournement possible.
 */

export type PathologyAssetResult =
  | { status: "ok"; data: PathologyContent }
  | { status: "locked" }
  | { status: "missing" };

/** Forme minimale attendue — évite de servir n'importe quel JSON sous ce nom. */
export function isPathologyContent(value: unknown): value is PathologyContent {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<PathologyContent>;
  return (
    candidate.kind === "pathology" &&
    typeof candidate.slug === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.sections)
  );
}

/**
 * Contenu d'une fiche, ou l'état qui explique l'absence :
 *   • `locked`  → la requête n'a pas de jeton valide (401 côté route) ;
 *   • `missing` → l'actif n'existe pas / n'est pas conforme (404).
 */
export async function readPathologyAsset(file: string): Promise<PathologyAssetResult> {
  const auth = await authenticateCurrentRequest();
  if (!auth.ok) return { status: "locked" };

  const raw = await readProtectedAsset("pathologies", file);
  if (!isPathologyContent(raw)) return { status: "missing" };

  return { status: "ok", data: raw };
}
