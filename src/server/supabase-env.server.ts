/**
 * Configuration Supabase côté SERVEUR — source unique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE (incident du 2026-10-22)
 *
 * Le bouton « Payer par Carte » de `/tarifs` répondait 503 en production alors
 * que la variante Lemon Squeezy était bien configurée et que le bundle contenait
 * `VITE_SUPABASE_URL`. Mesure :
 *
 *   même artefact, aperçu local, variables présentes   → 401 (vérification faite)
 *   même artefact, aperçu local, variables vidées      → 503 (identique à la prod)
 *   prod Cloudflare                                    → 503
 *
 * Ce n'était donc pas un bug de code « logique » mais une IGNORANCE DE
 * L'EXÉCUTION : `.env.production` est un fichier de BUILD. Vite l'inline dans le
 * bundle sous `import.meta.env` — il ne crée AUCUNE variable d'environnement
 * pour le worker déployé. Le serveur lisait `process.env` seul : il ne voyait
 * donc rien, alors que la valeur était sous ses yeux, dans le même fichier
 * JavaScript.
 *
 * RÈGLE RETENUE : côté serveur, on lit
 *   `process.env.SUPABASE_URL`            (variable d'exécution, prioritaire)
 *   `process.env.VITE_SUPABASE_URL`       (repli historique)
 *   `import.meta.env.VITE_SUPABASE_URL`   (valeur inlinée au build)
 *
 * `src/lib/auth/supabase-identity.server.ts` faisait déjà cette fusion pour son
 * propre compte ; les deux copies ont divergé et c'est le tunnel de paiement qui
 * est resté aveugle. Il n'y a désormais qu'UNE définition, ici.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type EnvLike = Record<string, string | undefined>;

/**
 * Valeurs inlinées par Vite au build.
 *
 * Vite remplace `import.meta.env` par un objet littéral ne contenant que les
 * `VITE_*` — jamais un secret. Sous `node --test` (strip-types), `import.meta.env`
 * n'existe pas : le repli `{}` est donc indispensable, sinon les tests
 * planteraient au chargement du module.
 */
function readInlinedEnv(): EnvLike {
  try {
    const meta = (import.meta as ImportMeta & { env?: EnvLike }).env;
    return meta ?? {};
  } catch {
    return {};
  }
}

/** Instantané pris au chargement du module (Vite a déjà remplacé `import.meta.env`). */
export const INLINED_ENV: EnvLike = Object.freeze(readInlinedEnv());

/**
 * Environnement serveur effectif : les valeurs inlinées au build, écrasées par
 * celles réellement fournies à l'exécution.
 *
 * L'ordre compte : un opérateur qui définit `SUPABASE_URL` sur la plateforme doit
 * pouvoir changer de projet Supabase **sans reconstruire** l'application.
 */
export function mergedServerEnv(env: EnvLike = process.env as EnvLike): EnvLike {
  return { ...INLINED_ENV, ...env };
}

const HTTP_URL = /^https?:\/\//i;

/** Première valeur définie et non vide parmi `keys`. */
function firstValue(env: EnvLike, keys: string[]): string {
  for (const key of keys) {
    const raw = env[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value) return value;
  }
  return "";
}

/** URL Supabase (sans slash final), ou `""`. Une URL non HTTP est refusée. */
export function resolveSupabaseUrl(env: EnvLike): string {
  const url = firstValue(env, ["SUPABASE_URL", "VITE_SUPABASE_URL"]).replace(/\/+$/, "");
  return url && HTTP_URL.test(url) ? url : "";
}

/** Clé PUBLIQUE (`anon`) — elle est publique par construction. */
export function resolveSupabaseAnonKey(env: EnvLike): string {
  return firstValue(env, ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
}

/** Clé de SERVICE — ne quitte jamais le serveur et n'est jamais renvoyée. */
export function resolveSupabaseServiceKey(env: EnvLike): string {
  return firstValue(env, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"]);
}

export type SupabaseServerConfig = { url: string; anonKey: string };

/**
 * Configuration complète pour vérifier un jeton d'accès auprès de Supabase.
 * `null` si une des deux moitiés manque : on ne peut alors PAS juger l'identité,
 * et l'appelant doit répondre 503 (jamais 401 — ce serait accuser le client).
 */
export function readServerSupabaseConfig(env: EnvLike): SupabaseServerConfig | null {
  const url = resolveSupabaseUrl(env);
  const anonKey = resolveSupabaseAnonKey(env);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
