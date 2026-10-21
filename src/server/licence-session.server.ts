// Import RELATIF : ce module est chargé par des tests exécutés via
// `node --experimental-strip-types`, qui ne résout pas l'alias `@/`.
import { activeLicence, type LicenceRow } from "../lib/cloud/licence.ts";

/**
 * PONT LICENCE SUPABASE → JWT DE CONTENU — serveur uniquement.
 *
 * POURQUOI CE MODULE
 * Le contenu Premium exige un JWT de 24 h signé par `LICENSE_JWT_SECRET`. Ce
 * jeton s'obtenait en échangeant une CLÉ (jeton `OPT1.…` ou clé `OPT-…`). Une
 * licence stockée dans Supabase n'a pourtant, dans le schéma mesuré, aucune
 * colonne de clé : `licences(id, user_id, status, plan, created_at,
 * expires_at, activated_at)`. Sans ce pont, un client payant restait donc
 * devant « Activer ma licence » à vie.
 *
 * LE CONTRÔLE, ET POURQUOI IL EST SÛR
 *   1. le navigateur présente son jeton d'accès **Supabase** ;
 *   2. on le fait vérifier par Supabase lui-même (`GET /auth/v1/user`) : la
 *      signature est contrôlée par l'émetteur, on n'ajoute aucun secret ;
 *   3. on lit `licences` avec CE jeton (donc sous RLS) et un filtre explicite
 *      `user_id = <utilisateur vérifié>` — le filtre n'est pas redondant : si
 *      RLS était mal configuré, il empêche de servir la licence d'autrui ;
 *   4. seule une licence ACTIVE (`isActiveLicence`, même règle que le client)
 *      donne lieu à une signature.
 *
 * ⚠️ Aucune clé de licence n'est journalisée ni renvoyée : `licenceIdentity()`
 * ne sert qu'à nommer la licence dans les journaux du serveur.
 */

/** Réponse `GET /auth/v1/user` (seul champ utilisé). */
type SupabaseUser = { id?: unknown };

export type LicenceSessionResult =
  | {
      ok: true;
      userId: string;
      /** Identité de la licence — sert de `licenseId` dans le JWT de contenu. */
      licenceId: string;
      plan: string | null;
      expiresAt: number | null;
    }
  | {
      ok: false;
      /**
       * `unconfigured` : variables Supabase absentes sur ce déploiement.
       * `unreachable`  : Supabase (ou la lecture des licences) a échoué → 503.
       * `invalid`      : le jeton d'accès Supabase est refusé → 401.
       * `no-licence`   : utilisateur authentifié, aucune licence active → 403.
       */
      reason: "unconfigured" | "unreachable" | "invalid" | "no-licence";
    };

export type SupabaseServerConfig = { url: string; anonKey: string };

type Deps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/** URL + clé publique Supabase côté serveur (les `VITE_*` sont un repli). */
export function supabaseServerConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): SupabaseServerConfig | null {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = (env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, anonKey };
}

/** Garde-fou de forme : un jeton d'accès est court, opaque, sans espace. */
export function isValidAccessToken(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const token = value.trim();
  return token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
}

function headers(config: SupabaseServerConfig, accessToken: string): HeadersInit {
  return {
    apikey: config.anonKey,
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
  };
}

/**
 * Vérifie le jeton d'accès Supabase, puis cherche une licence ACTIVE.
 * Ne rejette jamais : toute panne devient un `reason` explicite.
 */
export async function verifyLicenceSession(
  accessToken: unknown,
  deps: Deps = {},
): Promise<LicenceSessionResult> {
  const config = supabaseServerConfig();
  if (!config) return { ok: false, reason: "unconfigured" };
  if (!isValidAccessToken(accessToken)) return { ok: false, reason: "invalid" };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;

  let userId: string;
  try {
    const response = await fetchImpl(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: headers(config, accessToken),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid" };
    }
    if (!response.ok) return { ok: false, reason: "unreachable" };

    const user = (await response.json().catch(() => null)) as SupabaseUser | null;
    const id = typeof user?.id === "string" ? user.id.trim() : "";
    if (!id) return { ok: false, reason: "invalid" };
    userId = id;
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  let rows: LicenceRow[];
  try {
    // `select=*` plutôt que des colonnes nommées : le schéma peut varier d'un
    // projet à l'autre (`license_hash`, `plan`…), et une colonne absente ferait
    // échouer la requête entière.
    const query =
      `${config.url}/rest/v1/licences?select=*&` +
      `user_id=eq.${encodeURIComponent(userId)}`;
    const response = await fetchImpl(query, {
      method: "GET",
      headers: headers(config, accessToken),
    });
    if (!response.ok) {
      // Droits manquants (42501), table absente, jeton expiré : on ne peut pas
      // décider, donc on ferme (503) — jamais « pas de licence » par accident.
      return { ok: false, reason: "unreachable" };
    }
    const parsed = (await response.json().catch(() => null)) as unknown;
    rows = Array.isArray(parsed) ? (parsed as LicenceRow[]) : [];
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  const licence = activeLicence(rows, now());
  if (!licence) return { ok: false, reason: "no-licence" };

  const rawId = licence.id ?? licence.licence_id ?? licence.license_id;
  const licenceId =
    typeof rawId === "string" && rawId.trim()
      ? `supabase:${rawId.trim()}`
      : `supabase-user:${userId}`;
  const plan = typeof licence.plan === "string" && licence.plan.trim() ? licence.plan.trim() : null;
  const expiresAtRaw = licence.expires_at ?? licence.expiresAt;

  return {
    ok: true,
    userId,
    licenceId,
    plan,
    expiresAt: typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)
      ? expiresAtRaw
      : null,
  };
}
