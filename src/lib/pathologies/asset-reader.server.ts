import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getRequest } from "@tanstack/react-start/server";
import type { PathologyContent } from "@/core/pathology";

/**
 * Lecture SERVEUR d'une fiche de nosographie servie comme ACTIF STATIQUE.
 *
 * Le contenu vit dans `public/content/pathologies/` et n'entre donc jamais dans
 * le graphe du bundle client : il est publié tel quel (CDN, cache immutable) et
 * récupéré par `fetch("/content/pathologies/<slug>.json")` dans le navigateur.
 *
 * Le rendu serveur, lui, ne peut pas compter sur ce `fetch` :
 *   • certains contextes d'exécution n'ont AUCUN serveur HTTP joignable
 *     (exécution directe du handler Nitro par `scripts/smoke-built-server.mjs`,
 *     tests, pré-rendu) ;
 *   • un aller-retour réseau vers soi-même est inutile quand le fichier est
 *     sur le disque (dev, CI, auto-hébergement).
 *
 * On lit donc d'abord le fichier local, et on ne retombe sur le réseau que si
 * le disque ne l'a pas (fonction serverless : `public/` est publié sur le CDN,
 * pas dans le bundle de la fonction).
 *
 * ⚠️ Ce module est `.server.ts` et n'est importé QUE par le handler de
 * `createServerFn` (`./catalog.ts`) : il ne peut donc pas atteindre le client.
 */

/** Emplacements possibles du dossier d'actifs, du plus direct au plus profond. */
const ASSET_RELATIVE_DIRECTORIES = [
  "public/content/pathologies",
  ".vercel/output/static/content/pathologies",
  ".netlify/static/content/pathologies",
  ".output/public/content/pathologies",
  "dist/content/pathologies",
];

/** Garde-fou : une fiche ne doit jamais dépasser ce que le budget publie. */
const MAX_ASSET_BYTES = 512 * 1024;

/**
 * Cache mémoire (par instance). Une fiche est immuable côté CDN : la relire à
 * chaque requête SSR ne servirait à rien. On ne mémorise QUE les succès, pour
 * qu'une erreur transitoire ne condamne pas la fiche jusqu'au redémarrage.
 */
const contentCache = new Map<string, PathologyContent>();

/** Forme minimale attendue — évite de servir n'importe quel JSON sous ce nom. */
function isPathologyContent(value: unknown): value is PathologyContent {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<PathologyContent>;
  return (
    candidate.kind === "pathology" &&
    typeof candidate.slug === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.sections)
  );
}

/** Lit l'actif sur le disque, quel que soit l'emplacement de déploiement. */
async function readFromDisk(file: string): Promise<unknown | null> {
  for (const relativePath of ASSET_RELATIVE_DIRECTORIES) {
    const absolutePath = resolve(process.cwd(), relativePath, file);
    let raw: string;
    try {
      raw = await readFile(absolutePath, "utf8");
    } catch {
      continue; // emplacement absent : on essaie le suivant
    }
    if (raw.length > MAX_ASSET_BYTES) {
      throw new Error(`[pathologies] actif trop volumineux : ${relativePath}/${file}`);
    }
    return JSON.parse(raw) as unknown;
  }
  return null;
}

/**
 * Récupère l'actif depuis l'origine de la requête courante (CDN statique).
 * Repli utilisé quand `public/` n'est pas présent dans le système de fichiers
 * de la fonction serverless.
 */
async function readFromOrigin(file: string): Promise<unknown | null> {
  let request: Request;
  try {
    request = getRequest();
  } catch {
    return null; // aucun contexte de requête (script, pré-rendu) → tant pis
  }
  if (!request?.url) return null;

  const url = new URL(`/content/pathologies/${file}`, request.url);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return (await response.json()) as unknown;
}

/**
 * Contenu d'une fiche par nom de fichier (`hta-essentielle.json`).
 * `null` si l'actif est introuvable ou invalide — la route lève alors un 404.
 */
export async function readPathologyAsset(file: string): Promise<PathologyContent | null> {
  const cached = contentCache.get(file);
  if (cached) return cached;

  const raw = (await readFromDisk(file)) ?? (await readFromOrigin(file));
  if (!isPathologyContent(raw)) return null;

  contentCache.set(file, raw);
  return raw;
}
