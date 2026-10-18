/**
 * ACTIFS PROTÉGÉS — accès disque/compile du contenu Premium (serveur uniquement).
 *
 * POURQUOI CE MODULE EXISTE
 * Les fiches de nosographie et les cas « Signes & Syndromes » étaient servis
 * depuis `public/content/**` : le CDN les distribuait tels quels, donc
 * `curl https://…/content/pathologies/paludisme.json` renvoyait 200 à qui
 * connaissait l'URL. Le verrouillage Premium côté React était purement
 * cosmétique.
 *
 * Les 133 fiches vivent désormais dans `private/content/**`, HORS du dossier
 * publié : aucun déploiement ne peut les servir sans passer par le garde de
 * `src/server/content-guard.ts`.
 *
 * COMMENT ELLES SONT LUES
 * `import.meta.glob(..., { query: "?raw" })` : le contenu est EMBARQUÉ dans le
 * bundle serveur (chaînes JSON), ce qui fonctionne partout — y compris sur
 * Cloudflare Workers, où il n'existe aucun système de fichiers et où le repli
 * `fetch()` vers sa propre origine est précisément ce qui avait cassé /signes
 * (limite de sous-requêtes, DECISIONS.md SIGNES-8).
 *
 * ⚠️ Ce module est `.server.ts` et n'est importé QUE par des handlers serveur
 * (`src/routes/content.$type.$file.ts`, `src/routes/api.licenses.verify.ts`) et
 * par les lecteurs `.server.ts` des catalogues. Un import depuis un module du
 * graphe client publierait 1,1 Mo de contenu payant dans le bundle : c'est
 * exactement ce que `scripts/security-license.test.mjs` interdit.
 *
 * ⚠️ Les manifestes (`_index.json`) sont PUBLICS et ne passent pas par ici :
 *   • `src/content/data/pathologies/_index.json` (import statique du manifeste) ;
 *   • `public/content/signes/_index.json` (actif statique, listage public).
 */

/** Familles protégées : un dossier de `private/content/` chacune. */
export type ProtectedFamily = "pathologies" | "signes";

/**
 * Glob Vite des actifs privés. Chemins absolus (préfixe `/`) = relatifs à la
 * racine du projet. Les imports sont PARESSEUX : le contenu n'est chargé qu'au
 * premier accès réel.
 */
type RawLoader = () => Promise<string>;

// Le type de `import.meta.glob` avec `query: "?raw"` n'est pas affiné par la
// version de Vite installée (il retombe sur une union) : on fixe le contrat
// ici, une fois, plutôt que d'éparpiller des assertions dans les appelants.
const FAMILY_GLOBS: Record<ProtectedFamily, Record<string, RawLoader>> = {
  pathologies: import.meta.glob("/private/content/pathologies/*.json", {
    query: "?raw",
    import: "default",
  }) as unknown as Record<string, RawLoader>,
  signes: import.meta.glob("/private/content/signes/*.json", {
    query: "?raw",
    import: "default",
  }) as unknown as Record<string, RawLoader>,
};

/** Garde-fou : un actif de contenu ne doit jamais peser plus que du texte. */
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

/** Cache mémoire par instance : un actif est immuable pour la durée du process. */
const assetCache = new Map<string, unknown>();

const cacheKey = (family: ProtectedFamily, file: string) => `${family}/${file}`;

/** Nom de fichier accepté (aucune traversée de chemin possible). */
export const PROTECTED_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

export function isProtectedFamily(value: string): value is ProtectedFamily {
  return value === "pathologies" || value === "signes";
}

/** Noms de fichiers privés publiés pour une famille (tri stable). */
export function listProtectedFiles(family: ProtectedFamily): string[] {
  return Object.keys(FAMILY_GLOBS[family])
    .map((path) => path.slice(path.lastIndexOf("/") + 1))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Contenu brut d'un actif protégé (`undefined` s'il n'existe pas).
 *
 * Ne lève pas : une fiche absente est une absence normale (contenu retiré),
 * c'est l'appelant qui décide de la réponse HTTP.
 */
export async function readProtectedAsset(
  family: ProtectedFamily,
  file: string,
): Promise<unknown | undefined> {
  if (!PROTECTED_FILE_PATTERN.test(file)) return undefined;

  const key = cacheKey(family, file);
  const cached = assetCache.get(key);
  if (cached !== undefined) return cached;

  const loader = FAMILY_GLOBS[family][`/private/content/${family}/${file}`];
  if (!loader) return undefined;

  let raw: string;
  try {
    raw = await loader();
  } catch {
    return undefined;
  }
  if (raw.length > MAX_ASSET_BYTES) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }

  assetCache.set(key, parsed);
  return parsed;
}

/**
 * Tous les actifs d'une famille, dans l'ordre des noms de fichiers.
 * Utilisé par le catalogue groupé `/content/signes/_catalog.json` (un seul
 * aller-retour réseau au lieu de 110).
 */
export async function readAllProtectedAssets(
  family: ProtectedFamily,
): Promise<Record<string, unknown>> {
  const files = listProtectedFiles(family);
  const entries = await Promise.all(
    files.map(async (file) => [file, await readProtectedAsset(family, file)] as const),
  );
  const result: Record<string, unknown> = {};
  for (const [file, value] of entries) {
    if (value !== undefined) result[file] = value;
  }
  return result;
}
