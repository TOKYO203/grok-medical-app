// Imports RELATIFS avec extension : ce module est chargé par des tests exécutés
// via `node --experimental-strip-types`, qui ne résout pas l'alias `@/`.
import {
  isValidAccessToken,
  supabaseServerConfig,
  type SupabaseServerConfig,
} from "../../server/licence-session.server.ts";
import { mergedServerEnv } from "../../server/supabase-env.server.ts";

/**
 * IDENTITÉ SUPABASE CÔTÉ SERVEUR — la seule source d'identité en production.
 *
 * POURQUOI CE MODULE
 * L'application avait deux fournisseurs d'identité : Supabase (porte d'entrée,
 * contenu, synchronisation) et Better Auth (tunnel Mobile Money, export et
 * suppression de compte). Sur le déploiement Cloudflare, `/api/auth/*` ne peut
 * pas servir de session : les server functions protégées répondaient donc 401 à
 * un utilisateur pourtant connecté — d'où la « double authentification ».
 *
 * Ce module résout le jeton d'accès **Supabase** présenté par le navigateur, en
 * suivant exactement la doctrine du tunnel international
 * (`src/server/lemonsqueezy/checkout.server.ts`) et du pont de licence
 * (`src/server/licence-session.server.ts`) :
 *   - c'est l'ÉMETTEUR qui juge : on appelle `GET <url>/auth/v1/user` avec la
 *     clé PUBLIQUE (anonyme) — jamais de `service_role` côté requête ;
 *   - on ne fait confiance à AUCUN identifiant fourni par le client : seul `id`
 *     de la réponse vérifiée est utilisé ;
 *   - toute panne est un `reason` explicite, jamais une exception imprévue.
 *
 * DÉCISION IMPORTANTE — `looksLikeSupabaseToken`
 * Un jeton n'est reconnu comme jeton Supabase QUE si son `iss` est EXACTEMENT
 * `« <url>/auth/v1 »` de la configuration connue. Une correspondance floue
 * (`aud === "authenticated"`, présence de « supabase »…) risquerait de classer un
 * jeton Better Auth comme jeton Supabase, de le faire refuser et de déconnecter
 * un utilisateur légitime du bac à sable. Ici, pas de faux positif possible :
 * l'émetteur attendu est comparé à la chaîne exacte.
 */

/** Identité vérifiée — `userId` est le `sub` Supabase (`auth.users.id`). */
export type SupabaseIdentity = { userId: string; email: string | null };

export type SupabaseIdentityResult =
  | { ok: true; identity: SupabaseIdentity }
  /**
   * `unconfigured` : variables Supabase absentes côté serveur → on ne peut pas
   *                  juger, l'appelant retombe sur l'ancien système ;
   * `not-supabase` : le jeton n'a pas été émis par CE projet Supabase → idem ;
   * `invalid`      : Supabase refuse le jeton (expiré, révoqué, falsifié) ;
   * `unreachable`  : Supabase n'a pas répondu — on ne conclut PAS à une
   *                  déconnexion (ce serait déconnecter sur une panne réseau).
   */
  | { ok: false; reason: "unconfigured" | "not-supabase" | "invalid" | "unreachable" };

type Env = Record<string, string | undefined>;

type Deps = {
  fetchImpl?: typeof fetch;
  env?: Env;
  now?: () => number;
  /** Désactive le cache (tests, ou appel qui exige une vérification fraîche). */
  noCache?: boolean;
};

/** Durée de validité d'une vérification réussie (ou refusée). */
export const IDENTITY_CACHE_TTL_MS = 60_000;

/** Borne du cache : un jeton par utilisateur et par onglet, largement au-delà. */
const IDENTITY_CACHE_MAX = 500;

type CacheEntry = { at: number; result: SupabaseIdentityResult };

const identityCache = new Map<string, CacheEntry>();

/** Vide le cache (tests, ou après une déconnexion explicite). */
export function clearSupabaseIdentityCache(): void {
  identityCache.clear();
}

function readCache(key: string, now: number): SupabaseIdentityResult | null {
  const entry = identityCache.get(key);
  if (!entry) return null;
  if (now - entry.at >= IDENTITY_CACHE_TTL_MS) {
    identityCache.delete(key);
    return null;
  }
  return entry.result;
}

function writeCache(key: string, result: SupabaseIdentityResult, now: number): void {
  if (identityCache.size >= IDENTITY_CACHE_MAX) {
    // Purge des entrées périmées, puis, si nécessaire, de la plus ancienne.
    for (const [k, v] of identityCache) {
      if (now - v.at >= IDENTITY_CACHE_TTL_MS) identityCache.delete(k);
    }
    if (identityCache.size >= IDENTITY_CACHE_MAX) {
      const oldest = identityCache.keys().next();
      if (!oldest.done) identityCache.delete(oldest.value);
    }
  }
  identityCache.set(key, { at: now, result });
}

/**
 * Environnement serveur. `process.env` fait autorité (runtime déployé) ; les
 * `VITE_SUPABASE_*` **inlinées au build** servent de repli, sinon une
 * application dont le runtime n'expose que le bundle ne saurait pas quel projet
 * Supabase l'a émise. (La clé anonyme est publique : elle est déjà dans le
 * bundle client, il n'y a donc rien à protéger ici.)
 */
/**
 * Environnement serveur = valeurs inlinées au build, écrasées par l'exécution.
 *
 * La fusion vivait ici en propre ; elle est désormais partagée
 * (`server/supabase-env.server.ts`) pour qu'aucun autre module serveur ne
 * puisse l'oublier — c'est exactement ce qui a cassé le tunnel de paiement.
 */
function serverEnv(): Env {
  return mergedServerEnv() as Env;
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Décode en octets une chaîne base64url — SANS `Buffer` ni `atob`, pour rester
 * valable sur Node comme sur le runtime Workers. La décodification UTF-8 est
 * déléguée à `TextDecoder` (présent partout), indispensable pour un `email`
 * accentué.
 */
function decodeBase64Url(input: string): Uint8Array | null {
  const clean = input.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64URL_ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Décode la charge utile d'un JWT SANS vérifier la signature (lecture seule). */
export function readJwtPayload(token: string): Record<string, unknown> | null {
  if (!isValidAccessToken(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const bytes = decodeBase64Url(parts[1]);
    if (!bytes) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Date d'expiration (ms) lue dans le jeton, ou `null` si illisible. */
export function readJwtExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const payload = readJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
}

/**
 * Ce jeton a-t-il été émis par le projet Supabase CONFIGURÉ ? Comparaison sur
 * l'émetteur exact — voir la note en tête de module.
 */
export function isSupabaseAccessToken(
  token: unknown,
  config: SupabaseServerConfig | null = supabaseServerConfig(serverEnv()),
): boolean {
  if (!config || !isValidAccessToken(token)) return false;
  const payload = readJwtPayload(token);
  if (!payload) return false;
  return payload.iss === `${config.url}/auth/v1`;
}

/**
 * Vérifie un jeton d'accès Supabase auprès de son émetteur.
 * Ne rejette jamais : toute panne devient un `reason`.
 */
export async function verifySupabaseIdentity(
  accessToken: unknown,
  deps: Deps = {},
): Promise<SupabaseIdentityResult> {
  const env = deps.env ?? serverEnv();
  const config = supabaseServerConfig(env);
  if (!config) return { ok: false, reason: "unconfigured" };
  if (!isValidAccessToken(accessToken)) return { ok: false, reason: "invalid" };
  const token = accessToken.trim();
  if (!isSupabaseAccessToken(token, config)) return { ok: false, reason: "not-supabase" };

  const now = (deps.now ?? Date.now)();
  if (!deps.noCache) {
    const cached = readCache(token, now);
    if (cached) return cached;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  let result: SupabaseIdentityResult;
  try {
    const response = await fetchImpl(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });
    if (response.status === 401 || response.status === 403) {
      result = { ok: false, reason: "invalid" };
    } else if (!response.ok) {
      result = { ok: false, reason: "unreachable" };
    } else {
      const user = (await response.json().catch(() => null)) as {
        id?: unknown;
        email?: unknown;
      } | null;
      const userId = typeof user?.id === "string" ? user.id.trim() : "";
      if (!userId) {
        result = { ok: false, reason: "invalid" };
      } else {
        const email =
          typeof user?.email === "string" && user.email.trim() ? user.email.trim() : null;
        result = { ok: true, identity: { userId, email } };
      }
    }
  } catch {
    result = { ok: false, reason: "unreachable" };
  }

  // Une panne n'est PAS mémorisée : au prochain appel, on retente (un incident
  // réseau de 2 s ne doit pas condamner l'utilisateur pendant une minute).
  if (!deps.noCache && result.ok) writeCache(token, result, now);
  if (!deps.noCache && !result.ok && result.reason === "invalid") {
    writeCache(token, result, now);
  }
  return result;
}

export type SupabaseBearerResolution =
  | { kind: "verified"; userId: string; email: string | null }
  /** Il n'y a rien à juger : on laisse l'appelant utiliser son repli. */
  | { kind: "not-applicable"; reason: "unconfigured" | "absent" | "not-supabase" }
  /** Le jeton a bien été émis par ce projet mais il est refusé → 401. */
  | { kind: "rejected" }
  /** Supabase n'a pas répondu : on ne conclut pas à une déconnexion. */
  | { kind: "unreachable" };

/**
 * Résout un jeton porteur sans lever d'exception, en distinguant les quatre
 * issues qui n'appellent PAS la même réponse HTTP.
 */
export async function resolveSupabaseBearer(
  bearerToken: string | null | undefined,
  deps: Deps = {},
): Promise<SupabaseBearerResolution> {
  if (!bearerToken) return { kind: "not-applicable", reason: "absent" };
  const result = await verifySupabaseIdentity(bearerToken, deps);
  if (result.ok) {
    return { kind: "verified", userId: result.identity.userId, email: result.identity.email };
  }
  switch (result.reason) {
    case "unconfigured":
      return { kind: "not-applicable", reason: "unconfigured" };
    case "not-supabase":
      return { kind: "not-applicable", reason: "not-supabase" };
    case "unreachable":
      return { kind: "unreachable" };
    default:
      return { kind: "rejected" };
  }
}
