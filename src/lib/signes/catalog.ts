import type { SigneItem, SignesCatalog, SignesIndex } from "@/core/signes/types";
import { fetchWithAuth } from "@/lib/auth/session";

/**
 * CHARGEUR du module « Signes & Syndromes » — CONTENU PREMIUM.
 *
 * Historique court :
 *   • v1 : chaque fiche était un actif public (`public/content/signes/<id>.json`),
 *     donc lisible par `curl` sans aucun droit ;
 *   • v2 (ce module) : les 110 fiches vivent dans `private/content/signes/` et
 *     ne sortent que contre un jeton de contenu (`Authorization: Bearer …`).
 *
 * ⚠️ Le catalogue est chargé EN UNE REQUÊTE (`/content/signes/_catalog.json`)
 * et non plus fiche par fiche : 110 allers-retours vers la fonction serveur
 * coûteraient bien plus cher que 110 fichiers statiques, et l'ancien repli
 * `fetch()` par fiche est justement ce qui avait dépassé la limite de
 * sous-requêtes des Workers (DECISIONS.md SIGNES-8).
 *
 * ⚠️ Le MANIFESTE `_index.json` reste PUBLIC (il ne contient que des
 * identifiants et des libellés de catégories, pas de contenu médical) : c'est
 * ce qui permet d'annoncer le catalogue sans divulgâcher les cas.
 */

/** Base des actifs « Signes » (le catalogue y est protégé, le manifeste public). */
export const SIGNES_ASSET_BASE = "/content/signes";

/** Catalogue complet, protégé par jeton. */
export const SIGNES_CATALOG_URL = `${SIGNES_ASSET_BASE}/_catalog.json`;

/** Manifeste public (listage : ids par catégorie, sans contenu). */
export const SIGNES_INDEX_URL = `${SIGNES_ASSET_BASE}/_index.json`;

export type SignesLoad<T> =
  | { status: "ok"; data: T }
  | { status: "locked" }
  | { status: "missing" };

/** Caches mémoire côté navigateur (une navigation ne re-télécharge rien). */
let catalogCache: SignesCatalog | undefined;
let indexCache: SignesIndex | undefined;

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

/** 401 (jeton absent/invalide) et 503 (garde non configuré) = contenu fermé. */
function isClosedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 503;
}

/** Manifeste public : ne lève jamais, `undefined` s'il n'est pas publié. */
export async function loadSignesIndex(): Promise<SignesIndex | undefined> {
  if (indexCache) return indexCache;
  try {
    const response = await fetch(SIGNES_INDEX_URL, { headers: { accept: "application/json" } });
    if (!response.ok) return undefined;
    const raw = (await response.json()) as unknown;
    if (!isSignesIndex(raw)) return undefined;
    indexCache = raw;
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * Repli : l'ancien déploiement n'avait pas d'endpoint de catalogue groupé.
 * On lit alors le manifeste puis chaque fiche — mais dès qu'une fiche répond
 * 401 on s'arrête : inutile de tirer 110 requêtes condamnées.
 */
async function loadCatalogFromManifest(): Promise<SignesLoad<SignesCatalog>> {
  const index = await loadSignesIndex();
  if (!index) return { status: "missing" };

  const ids = Object.values(index.categories).flat();
  if (ids.length === 0) return { status: "missing" };

  const items: SigneItem[] = [];
  for (const id of ids) {
    const response = await fetchWithAuth(`${SIGNES_ASSET_BASE}/${id}.json`, {
      headers: { accept: "application/json" },
    });
    if (isClosedStatus(response.status)) return { status: "locked" };
    if (!response.ok) continue; // fiche retirée : on ignore, on ne casse pas
    const raw = (await response.json()) as unknown;
    if (isSigneItem(raw)) items.push(raw);
  }

  if (items.length === 0) return { status: "missing" };
  return { status: "ok", data: { schemaVersion: index.schemaVersion, items } };
}

/**
 * Catalogue complet, dans l'ordre éditorial du serveur.
 *
 * `locked` = pas de licence (ou jeton expiré) : la page affiche le bandeau
 * Premium, elle ne casse pas et ne montre aucun cas.
 */
export async function loadSignesCatalog(): Promise<SignesLoad<SignesCatalog>> {
  if (catalogCache) return { status: "ok", data: catalogCache };

  const response = await fetchWithAuth(SIGNES_CATALOG_URL, {
    headers: { accept: "application/json" },
  });

  if (isClosedStatus(response.status)) return { status: "locked" };
  if (response.status === 404) return loadCatalogFromManifest();
  if (!response.ok) return { status: "missing" };

  const raw = (await response.json()) as unknown;
  if (!isSignesCatalog(raw)) return { status: "missing" };

  catalogCache = raw;
  return { status: "ok", data: raw };
}
