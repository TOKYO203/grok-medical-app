import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  SigneItem,
  SignesCatalog,
  SignesCategoryEntry,
  SignesIndex,
} from "@/core/signes/types";

/**
 * CHARGEUR du module « Signes & Syndromes ».
 *
 * ⚠️ Le CONTENU n'est PAS un module : chaque CATÉGORIE est un ACTIF STATIQUE
 * (`public/content/signes/<catégorie>.json`), publié tel quel sur le CDN et
 * récupéré par `fetch()`. Le bundle client ne contient donc ZÉRO octet de
 * contenu — le prochain lot de triades/tétrades s'ajoute en déposant un fichier
 * JSON et une entrée de manifeste, sans recompiler ni relever le budget JS.
 *
 * Architecture identique à `src/lib/pathologies/` (fiches de nosographie) :
 *   • `_index.json` = manifeste des catégories, seul contenu que la page lit
 *     avant de savoir quoi télécharger ;
 *   • `<catégorie>.json` = les items, chargés à la demande ;
 *   • SSR = lecture disque (aucune requête HTTP vers soi-même), navigateur =
 *     `fetch` de l'actif mis en cache « immutable » un an.
 *
 * Contrat public (utilisé par la route et par les futurs écrans par catégorie) :
 *   `loadSignesContent(category)`  → le catalogue d'UNE catégorie ;
 *   `loadSignesCatalog()`          → toutes les catégories disponibles, fusionnées.
 */

/** Base publique des actifs, servie par le CDN (cache immutable). */
export const SIGNES_ASSET_BASE = "/content/signes";

/**
 * Nom d'actif accepté : slug minuscule + `.json`, éventuellement préfixé d'un
 * underscore pour les fichiers de service. Le manifeste s'appelle `_index.json`
 * (convention du dépôt) : sans cette exception, le chargeur du manifeste était
 * rejeté par son propre validateur et `/signes` renvoyait une 500.
 */
const ASSET_NAME = /^_?[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Garde-fou de forme : un actif inconnu ne doit jamais être servi comme contenu. */
const assetRequest = z.object({ file: z.string().regex(ASSET_NAME, "nom d'actif invalide") });

/**
 * Lecture SSR. Passer par `createServerFn` (plutôt qu'un import direct de
 * `./asset-reader.server`) garantit que la lecture disque est compilée
 * UNIQUEMENT côté serveur : le handler est extrait du bundle client, avec ses
 * imports.
 */
const readAssetOnServer = createServerFn({ method: "GET" })
  .validator(assetRequest)
  .handler(async ({ data }) => {
    const { readSignesAsset } = await import("./asset-reader.server");
    return readSignesAsset(data.file);
  });

/** Caches mémoire côté navigateur (une navigation ne re-télécharge rien). */
const catalogCache = new Map<string, SignesCatalog>();
let indexCache: SignesIndex | undefined;

/** Lit un actif, quel que soit le contexte d'exécution. */
async function readAsset(file: string): Promise<unknown | undefined> {
  if (import.meta.env.SSR) {
    return (await readAssetOnServer({ data: { file } })) ?? undefined;
  }
  const response = await fetch(`${SIGNES_ASSET_BASE}/${file}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return undefined;
  return (await response.json()) as unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSigneItem(value: unknown): value is SigneItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as Partial<SigneItem>;
  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.category) &&
    isNonEmptyString(item.disease) &&
    isNonEmptyString(item.clinicalCase) &&
    isNonEmptyString(item.question) &&
    Array.isArray(item.signs) &&
    item.signs.every(isNonEmptyString) &&
    Array.isArray(item.options) &&
    item.options.every(isNonEmptyString) &&
    typeof item.correctIndex === "number" &&
    item.correctIndex >= 0 &&
    item.correctIndex < item.options.length
  );
}

function isSignesCatalog(value: unknown): value is SignesCatalog {
  if (value === null || typeof value !== "object") return false;
  const catalog = value as Partial<SignesCatalog>;
  return (
    typeof catalog.schemaVersion === "number" &&
    Array.isArray(catalog.items) &&
    catalog.items.every(isSigneItem)
  );
}

function isSignesIndex(value: unknown): value is SignesIndex {
  if (value === null || typeof value !== "object") return false;
  const index = value as Partial<SignesIndex>;
  return (
    typeof index.schemaVersion === "number" &&
    Array.isArray(index.categories) &&
    index.categories.every((entry) => {
      const candidate = entry as Partial<SignesCategoryEntry>;
      return (
        isNonEmptyString(candidate.id) &&
        isNonEmptyString(candidate.label) &&
        isNonEmptyString(candidate.file) &&
        (candidate.status === "available" || candidate.status === "planned")
      );
    })
  );
}

/** URL publique d'une catégorie (préchargement, QA, documentation). */
export function signesAssetUrl(category: string): string {
  return `${SIGNES_ASSET_BASE}/${category}.json`;
}

/**
 * Manifeste des catégories (`undefined` s'il n'a pas pu être lu : une app
 * publiée sans `public/content/signes/` doit afficher un état vide, pas planter).
 */
export async function loadSignesIndex(): Promise<SignesIndex | undefined> {
  if (indexCache) return indexCache;
  const raw = await readAsset("_index.json");
  if (!isSignesIndex(raw)) return undefined;
  indexCache = raw;
  return raw;
}

/**
 * Contenu d'UNE catégorie (`undefined` si la catégorie n'est pas publiée).
 * C'est le contrat demandé par la route : `loadSignesContent("triade")`.
 */
export async function loadSignesContent(category: string): Promise<SignesCatalog | undefined> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) return undefined;

  const cached = catalogCache.get(category);
  if (cached) return cached;

  const raw = await readAsset(`${category}.json`);
  if (!isSignesCatalog(raw)) return undefined;

  catalogCache.set(category, raw);
  return raw;
}

/**
 * Catalogue complet : toutes les catégories `available` du manifeste, dans
 * l'ordre éditorial du manifeste. Utilisé par `/signes` pour présenter les
 * signes en séquence sans que la page ait à connaître les catégories.
 *
 * Une catégorie annoncée mais dont l'actif manque est simplement ignorée : la
 * publication du contenu ne doit jamais casser la page.
 */
export async function loadSignesCatalog(): Promise<SignesCatalog | undefined> {
  const index = await loadSignesIndex();
  if (!index) return undefined;

  const available = index.categories.filter((entry) => entry.status === "available");
  const catalogs = await Promise.all(available.map((entry) => loadSignesContent(entry.id)));

  const items = catalogs.flatMap((catalog) => catalog?.items ?? []);
  if (items.length === 0) return undefined;

  return { schemaVersion: index.schemaVersion, items };
}
