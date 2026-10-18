import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getRequest } from "@tanstack/react-start/server";
import type { SigneItem, SignesCatalog, SignesIndex } from "@/core/signes/types";

/**
 * Lecture SERVEUR des actifs « Signes & Syndromes ».
 *
 * Le contenu vit dans `public/content/signes/` : il n'entre JAMAIS dans le
 * graphe du bundle client, il est publié tel quel (CDN, cache immutable) et
 * récupéré par `fetch("/content/signes/<fichier>")` dans le navigateur.
 *
 * Le rendu serveur, lui, ne peut pas compter sur ce `fetch` :
 *   • certains contextes d'exécution n'ont aucun serveur HTTP joignable
 *     (exécution directe du handler Nitro, pré-rendu, tests) ;
 *   • un aller-retour réseau vers soi-même est inutile quand le fichier est sur
 *     le disque (dev, CI, auto-hébergement).
 *
 * On lit donc d'abord le fichier local, et on ne retombe sur l'origine que si
 * le disque ne l'a pas (fonction serverless : `public/` est publié sur le CDN,
 * pas dans le bundle de la fonction).
 *
 * ⚠️ CONTRAT DE NEUTRALITÉ : ce module ne lève JAMAIS d'exception. Un runtime
 * sans disque (ex. worker), une limite de sous-requêtes atteinte, un actif
 * introuvable : tout se traduit par `null` — c'est le catalogue qui décide
 * (fiche ignorée, état vide), jamais la page ne plante. Leçon de l'incident
 * du 2026-10-18 (DECISIONS.md SIGNES-8) : à ~110 fiches, le `fetch` de repli
 * vers l'origine propre dépassait la limite de sous-requêtes du plan Workers
 * Cloudflare (~50 par requête) et son exception non attrapée faisait planter
 * /signes en production dès que le manifeste dépassait ~50 fiches.
 *
 * ⚠️ Ce module est `.server.ts` et n'est importé QUE par le handler de
 * `createServerFn` (`./catalog.ts`) : il ne peut pas atteindre le client.
 */

/** Emplacements possibles du dossier d'actifs, du plus direct au plus profond. */
const ASSET_RELATIVE_DIRECTORIES = [
  "public/content/signes",
  ".vercel/output/static/content/signes",
  ".netlify/static/content/signes",
  ".output/public/content/signes",
  "dist/content/signes",
];

/**
 * Formes servies par ce dossier. Le type est DÉCLARÉ (et non `unknown`) parce
 * que la valeur traverse `createServerFn` : le typage de TanStack Start refuse
 * les valeurs non sérialisables, ce qui est une bonne barrière — le catalogue
 * (`catalog.ts`) revérifie ensuite la forme réelle avec ses gardes.
 */
export type SignesAsset = SigneIndex | SignesCatalog | SigneItem;

/** Garde-fou : aucun actif de ce dossier ne doit peser plus que du texte. */
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

/**
 * Cache mémoire (par instance). Le manifeste et les fiches publiées sont
 * immuables côté CDN : on ne mémorise QUE les succès, pour qu'une erreur
 * transitoire ne condamne pas la fiche jusqu'au redémarrage.
 */
const assetCache = new Map<string, SignesAsset>();

/**
 * Lit l'actif sur le disque, quel que soit l'emplacement de déploiement.
 * `null` si aucun emplacement n'est joignable (runtime sans disque : worker,
 * fonction serverless), sans jamais lever.
 */
async function readFromDisk(file: string): Promise<SignesAsset | null> {
  for (const relativePath of ASSET_RELATIVE_DIRECTORIES) {
    // `process` peut être absent ou dépourvu de `cwd()` selon le runtime :
    // un emplacement injoignable n'est pas une erreur de contenu, on passe
    // au suivant (le repli réseau prendra le relais).
    let absolutePath: string;
    try {
      absolutePath = resolve(process.cwd(), relativePath, file);
    } catch {
      continue;
    }
    let raw: string;
    try {
      raw = await readFile(absolutePath, "utf8");
    } catch {
      continue; // emplacement absent : on essaie le suivant
    }
    if (raw.length > MAX_ASSET_BYTES) {
      throw new Error(`[signes] actif trop volumineux : ${relativePath}/${file}`);
    }
    return JSON.parse(raw) as SignesAsset;
  }
  return null;
}

/**
 * Repli : récupère l'actif depuis l'origine de la requête courante (CDN).
 * `null` s'il est introuvable OU si le repli lui-même échoue (limite de
 * sous-requêtes du runtime, origine injoignable) : une fiche manquante est
 * ignorée par le catalogue, une exception casserait la page.
 */
async function readFromOrigin(file: string): Promise<SignesAsset | null> {
  let request: Request;
  try {
    request = getRequest();
  } catch {
    return null; // aucun contexte de requête (script, pré-rendu) → tant pis
  }
  if (!request?.url) return null;

  const url = new URL(`/content/signes/${file}`, request.url);
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    // Limite de sous-requêtes dépassée (plan Workers gratuit ≈ 50 par requête)
    // ou réseau indisponible : l'actif est traité comme absent, pas comme une
    // erreur de la page.
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as SignesAsset;
}

/**
 * Contenu brut d'un actif par nom de fichier (`beck.json`, `_index.json`).
 * `null` s'il est introuvable — le catalogue décide alors s'il s'agit d'une
 * absence normale (fiche retirée) ou d'une erreur de publication.
 */
export async function readSignesAsset(file: string): Promise<SignesAsset | null> {
  const cached = assetCache.get(file);
  if (cached !== undefined) return cached;

  const raw = (await readFromDisk(file)) ?? (await readFromOrigin(file));
  if (raw === null) return null;

  assetCache.set(file, raw);
  return raw;
}
