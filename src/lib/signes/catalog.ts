import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  SigneItem,
  SignesCatalog,
  SignesIndex,
} from "@/core/signes/types";

/**
 * CHARGEUR du module « Signes & Syndromes ».
 *
 * ⚠️ Le CONTENU n'est PAS un module : chaque fiche est un ACTIF STATIQUE
 * (`public/content/signes/<id>.json`), publié tel quel sur le CDN et récupéré
 * par `fetch()`. Le bundle client ne contient donc ZÉRO octet de contenu — le
 * prochain lot de triades/tétrades s'ajoute en déposant un JSON et son id dans
 * le manifeste, sans recompiler ni relever le budget JS.
 *
 * Architecture identique à `src/lib/pathologies/` (fiches de nosographie) :
 *   • `_index.json` = MANIFESTE canonique fourni avec le contenu : une
 *     catégorie (`syndrome`, `triade`, `tetrade`, `signe`) liste ses ids ;
 *   • `<id>.json` = une fiche, chargée à la demande ;
 *   • SSR = lecture disque (aucune requête HTTP vers soi-même), navigateur =
 *     `fetch` de l'actif mis en cache « immutable » un an.
 *
 * ⚠️ Le manifeste est la SOURCE DE VÉRITÉ éditoriale : on le lit, on ne le
 * réécrit jamais depuis le code.
 *
 * ⚠️ Aucune lecture d'actif ne doit lever (DECISIONS.md SIGNES-8) : une fiche
 * inaccessible est ignorée, un catalogue introuvable donne un état vide. Une
 * exception côté SSR faisait planter /signes en production.
 *
 * Contrat public (utilisé par la route et par les futurs écrans par catégorie) :
 *   `loadSignesContent(category)`  → le catalogue d'UNE catégorie ;
 *   `loadSignesCatalog()`          → toutes les catégories, fusionnées.
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
 * imports. C'est le mécanisme déjà utilisé par `src/lib/pathologies/`.
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
    try {
      return (await readAssetOnServer({ data: { file } })) ?? undefined;
    } catch {
      // Le lecteur serveur est neutre par contrat (`asset-reader.server.ts`),
      // mais le transport `createServerFn` peut échouer pour une raison de
      // runtime : une fiche inaccessible est ignorée, jamais la page entière.
      return undefined;
    }
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
  if (typeof index.schemaVersion !== "number") return false;
  if (index.categories === null || typeof index.categories !== "object") return false;
  return Object.values(index.categories).every(
    (ids) => Array.isArray(ids) && ids.every(isNonEmptyString),
  );
}

/** URL publique d'une fiche (préchargement, QA, documentation). */
export function signesAssetUrl(id: string): string {
  return `${SIGNES_ASSET_BASE}/${id}.json`;
}

/**
 * Manifeste des fiches (`undefined` s'il n'a pas pu être lu : une app publiée
 * sans `public/content/signes/` doit afficher un état vide, pas planter).
 */
export async function loadSignesIndex(): Promise<SignesIndex | undefined> {
  if (indexCache) return indexCache;
  const raw = await readAsset("_index.json");
  if (!isSignesIndex(raw)) return undefined;
  indexCache = raw;
  return raw;
}

/** Ids déclarés pour une catégorie, dans l'ordre éditorial du manifeste. */
function categoryIds(index: SignesIndex, category: string): string[] {
  const ids = index.categories[category];
  return Array.isArray(ids) ? ids : [];
}

/**
 * Contenu d'UNE catégorie (`undefined` si la catégorie n'est pas publiée).
 *
 * Une fiche dont l'actif manque est ignorée : publier un manifeste avant les
 * fichiers ne doit jamais casser la page.
 */
export async function loadSignesContent(category: string): Promise<SignesCatalog | undefined> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) return undefined;

  const cached = catalogCache.get(category);
  if (cached) return cached;

  const index = await loadSignesIndex();
  if (!index) return undefined;

  const ids = categoryIds(index, category);
  if (ids.length === 0) return undefined;

  const assets = await Promise.all(ids.map((id) => readAsset(`${id}.json`)));
  const items = assets.filter(isSigneItem);
  if (items.length === 0) return undefined;

  const catalog: SignesCatalog = { schemaVersion: index.schemaVersion, items };
  catalogCache.set(category, catalog);
  return catalog;
}

/**
 * Catalogue complet : toutes les catégories du manifeste, dans l'ordre
 * éditorial de celui-ci (syndrome → triade → tétrade → signe). Utilisé par
 * `/signes` pour présenter les fiches en séquence sans que la page ait à
 * connaître les catégories.
 */
export async function loadSignesCatalog(): Promise<SignesCatalog | undefined> {
  const index = await loadSignesIndex();
  if (!index) return undefined;

  const categories = Object.keys(index.categories);
  const catalogs = await Promise.all(categories.map((category) => loadSignesContent(category)));

  const items = catalogs.flatMap((catalog) => catalog?.items ?? []);
  if (items.length === 0) return undefined;

  return { schemaVersion: index.schemaVersion, items };
}
