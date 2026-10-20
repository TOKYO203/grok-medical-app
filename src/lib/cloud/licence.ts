/**
 * LECTURE D'UNE LIGNE DE LA TABLE `public.licences` — module PUR.
 *
 * Le contenu Premium (fiches de nosographie + cas « Signes & Syndromes ») n'est
 * servi qu'à une requête portant un JWT de contenu de 24 h. Jusqu'ici ce jeton
 * n'était obtenu QUE par saisie manuelle d'une clé sur `/pro` : un client dont
 * la licence vit dans Supabase restait donc devant « Activer ma licence ».
 *
 * Ce module ne fait aucune I/O : il décide, à partir de lignes déjà lues, quelle
 * licence est ACTIVE et si elle porte une clé vérifiable. Les deux appelants
 * (navigateur et serveur) partagent ainsi EXACTEMENT la même règle — sans quoi
 * le client pourrait croire « licencié » ce que le serveur refuse.
 *
 * ⚠️ Le schéma mesuré de `licences` est `id, user_id, status, plan, created_at,
 * expires_at, activated_at` : il n'y a PAS de colonne de clé. Une licence peut
 * donc être active sans qu'aucune clé ne soit échangeable ; c'est pourquoi le
 * pont serveur (`/api/licenses/session`) existe. On reste néanmoins tolérant
 * sur les noms de colonnes : un déploiement qui stocke la clé (ou son hash)
 * sous un autre nom doit fonctionner sans retoucher ce fichier.
 */

/** Ligne brute telle que renvoyée par PostgREST (`select=*`). */
export type LicenceRow = Record<string, unknown>;

/**
 * Noms de colonnes pouvant porter une clé de licence, par ordre de préférence.
 * `*_hash` est inclus : si l'exploitant y a stocké le jeton en clair (usage
 * répandu malgré le nom), on l'accepte ; s'il s'agit d'un vrai SHA-256, la
 * valeur sera rejetée par `isVerifiableLicenceKey` (impossible à inverser).
 */
export const LICENCE_KEY_FIELDS = [
  "license_key",
  "licence_key",
  "licence",
  "license",
  "license_hash",
  "licence_hash",
  "key",
  "token",
] as const;

/** Colonnes d'expiration acceptées (ISO 8601 ou epoch). */
const EXPIRY_FIELDS = ["expires_at", "expiresAt", "valid_until", "validUntil"] as const;

/** Statuts qui ferment l'accès, quoi que dise l'échéance. */
const INACTIVE_STATUS = /revok|cancel|expir|refund|inactive|suspend|pending|fail|void|unpaid/i;

/** Statuts qui ouvrent l'accès (l'échéance reste vérifiée). */
const ACTIVE_STATUS = /active|valid|paid|enabled|granted|complete|pro|premium|purchased/i;

/** Préfixe des jetons de licence signés hors ligne (`OPT1.<charge>.<sig>`). */
const SIGNED_TOKEN_PREFIX = "OPT1.";

/** Clé d'activation historique (`OPT-XXXX-…`, 6 groupes de 4 hexadécimaux). */
const ACTIVATION_KEY_PATTERN = /^OPT-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/i;

/** Une clé de licence n'est jamais un roman : borne la lecture et l'envoi. */
export const MAX_LICENCE_KEY_LENGTH = 4096;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Premier champ non vide parmi `fields`, tel quel (jamais transformé). */
function firstText(row: LicenceRow, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = text(row[field]);
    if (value) return value;
  }
  return null;
}

/** `status` en minuscules, ou `""` si absent (schéma minimal). */
export function licenceStatus(row: LicenceRow): string {
  return (text(row.status) ?? "").toLowerCase();
}

/** Échéance en epoch millisecondes (`null` = perpétuelle ou inconnue). */
export function licenceExpiry(row: LicenceRow): number | null {
  for (const field of EXPIRY_FIELDS) {
    const raw = row[field];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      // Epoch en SECONDES (Postgres `timestamptz` mal sérialisé) vs millisecondes.
      return raw > 0 && raw < 1e12 ? raw * 1000 : raw;
    }
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * La licence est-elle active MAINTENANT ?
 *
 * Règle, volontairement conservatrice (un faux « actif » ouvrirait du contenu
 * payant, un faux « inactif » ne coûte qu'un message d'erreur) :
 *   • un statut de révocation/expiration ferme TOUJOURS l'accès ;
 *   • un statut d'activation explicite ouvre l'accès si l'échéance n'est pas
 *     dépassée ;
 *   • un statut inconnu n'ouvre l'accès que si une échéance future existe, ou
 *     si la ligne a été explicitement activée sans échéance (licence à vie
 *     accordée à la main).
 */
export function isActiveLicence(row: LicenceRow, now = Date.now()): boolean {
  const status = licenceStatus(row);
  if (status && INACTIVE_STATUS.test(status)) return false;

  const expiresAt = licenceExpiry(row);
  if (expiresAt !== null) return expiresAt > now;

  if (status && ACTIVE_STATUS.test(status)) return true;

  // Ni échéance ni statut d'activation : on ne suppose rien. Seule exception,
  // une activation explicite sans échéance = licence perpétuelle accordée à la main.
  return text(row.activated_at) !== null || text(row.activatedAt) !== null;
}

/** Rang de tri : une licence perpétuelle passe avant une licence datée. */
function expiryRank(row: LicenceRow): number {
  const expiresAt = licenceExpiry(row);
  return expiresAt === null ? Number.POSITIVE_INFINITY : expiresAt;
}

/**
 * Licence active la plus favorable parmi les lignes reçues (RLS ne renvoie déjà
 * que celles de l'utilisateur). `null` si aucune n'est active.
 */
export function activeLicence(rows: readonly LicenceRow[], now = Date.now()): LicenceRow | null {
  let best: LicenceRow | null = null;
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    if (!isActiveLicence(row, now)) continue;
    if (best === null || expiryRank(row) > expiryRank(best)) best = row;
  }
  return best;
}

/** Clé de licence portée par la ligne (peut être un hash : voir le prédicat). */
export function licenceKeyFromRow(row: LicenceRow): string | null {
  const value = firstText(row, LICENCE_KEY_FIELDS);
  if (!value || value.length > MAX_LICENCE_KEY_LENGTH) return null;
  return value;
}

/**
 * La valeur est-elle une clé ÉCHANGEABLE contre un JWT de contenu ?
 *
 * Seules deux formes sont acceptées par `/api/licenses/verify` :
 *   • `OPT1.<charge>.<signature>` (jeton signé Ed25519, recommandé) ;
 *   • `OPT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (clé d'activation liée à l'appareil).
 *
 * Un SHA-256 hexadécimal, un `manual-…` ou un UUID ne sont donc PAS échangeables :
 * il faut passer par le pont serveur qui vérifie la session Supabase.
 */
export function isVerifiableLicenceKey(key: string | null | undefined): boolean {
  if (typeof key !== "string") return false;
  const value = key.trim();
  if (value.length < 8 || value.length > MAX_LICENCE_KEY_LENGTH) return false;
  if (value.startsWith(SIGNED_TOKEN_PREFIX)) return value.split(".").length === 3;
  return ACTIVATION_KEY_PATTERN.test(value);
}

/**
 * Identité stable d'une licence, SANS la clé : sert de clé de cache mémoire ou
 * de journal. Jamais envoyée au serveur, jamais exposée à l'interface.
 */
export function licenceIdentity(row: LicenceRow): string {
  const id = firstText(row, ["id", "licence_id", "license_id"]);
  if (id) return id;
  const user = firstText(row, ["user_id", "userId"]);
  const plan = firstText(row, ["plan", "product"]);
  return [user ?? "unknown-user", plan ?? "unknown-plan", licenceStatus(row) || "unknown-status"].join(
    ":",
  );
}
