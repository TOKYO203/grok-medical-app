import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase — chargé PARESSEUSEMENT.
 *
 * Deux raisons, toutes deux mesurables :
 *
 *  1. **Ne jamais lever à l'import.** `createClient("", "")` lève
 *     `supabaseUrl is required` : un environnement sans variables (CI, Cloudflare
 *     Pages non configuré, test Node) ferait tomber TOUTE l'application.
 *  2. **Ne pas charger le SDK sur les pages qui n'en ont pas besoin.**
 *     `@supabase/supabase-js` pèse ~160 Kio minifié (auth + PostgREST + realtime +
 *     storage + functions). Importé statiquement depuis `__root`, il entrait dans
 *     le chunk d'entrée de TOUTES les pages — y compris `/tarifs` ou les pages
 *     légales, qui n'ont aucune raison de télécharger un client d'authentification.
 *     Il vit donc dans son propre chunk, récupéré au premier usage réel.
 *
 * `import type` est effacé à la compilation : aucun import runtime du paquet ici.
 */
type EnvLike = Record<string, string | undefined>;

const env = ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {}) as EnvLike;

function readEnv(key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

const isBrowser = typeof window !== "undefined";

export const SUPABASE_URL = readEnv("VITE_SUPABASE_URL");
export const SUPABASE_ANON_KEY = readEnv("VITE_SUPABASE_ANON_KEY");

/** Vrai seulement si l'URL et la clé publique sont présentes au build. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
let pending: Promise<SupabaseClient | null> | null = null;

/**
 * Charge (une seule fois) puis renvoie le client, ou `null` si Supabase n'est pas
 * configuré. Ne rejette jamais : un échec de chargement du chunk est traité comme
 * « cloud indisponible », pas comme un crash applicatif.
 */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (client) return Promise.resolve(client);

  pending ??= import("@supabase/supabase-js")
    .then(({ createClient }) => {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // Côté serveur il n'y a ni localStorage ni cookie à écrire : on ne
          // persiste rien et on ne lance aucun timer de rafraîchissement.
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
          flowType: "pkce",
        },
      });
      return client;
    })
    .catch(() => {
      // ⚠️ On NE mémorise PAS un échec. Le chunk n'est peut-être pas encore
      // téléchargé (démarrage hors-ligne) : garder la promesse rejetée en cache
      // condamnerait le cloud jusqu'au prochain rechargement de page, alors que
      // la reconnexion réseau suffit à réparer la situation.
      pending = null;
      return null;
    });

  return pending;
}

/** Client déjà chargé, ou `null` tant que `loadSupabase()` n'a pas résolu. */
export function currentSupabase(): SupabaseClient | null {
  return client;
}
