import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Classement réel (beta) — dérivé de `optimus_user_state`.
 *
 * L'état d'apprentissage (xp, streak, weeklyXp, cas, profil) est déjà
 * synchronisé et validé côté serveur par le pipeline existant. Ce module
 * l'expose en classement hebdomadaire POUR LES UTILISATEURS CONNECTÉS :
 *   · `authMiddleware` garantit l'identité (`context.userId`) ;
 *   · la RPC n'expose JAMAIS les user_id, seulement les pseudonymes
 *     (choisis via `setLeaderboardPseudo`, repli sur le nom d'affichage) ;
 *   · l'anti-triche vit dans la migration 0023 : filtres de plausibilité et
 *     ordre calculé côté serveur (aucun score soumis par le client).
 */

export interface LeaderboardRow {
  rank: number;
  pseudo: string;
  xp: number;
  weeklyXp: number;
  streak: number;
  cases: number;
  country: string;
  faculty: string;
  year: number;
  subject: string;
  self: boolean;
}

const pseudoSchema = z
  .string()
  .trim()
  .min(2, "Le pseudo doit faire au moins 2 caractères.")
  .max(24, "Le pseudo doit faire au plus 24 caractères.")
  .regex(/^[A-Za-zÀ-ÿ0-9 .'_-]+$/, "Pseudo : lettres, chiffres, espaces, . _ ' - uniquement.");

async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  const { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } = await import("@/server/supabase-env.server");
  const env = mergedServerEnv(process.env);
  const url = resolveSupabaseUrl(env);
  const key = resolveSupabaseServiceKey(env);
  if (!url || !key) throw new Error("Supabase non configuré");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const supabase = await supabaseAdmin();
    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_limit: 200,
      p_offset: 0,
      p_self: context.userId,
    });
    if (error || !Array.isArray(data)) throw new Error("Classement indisponible.");
    return { rows: data as LeaderboardRow[] };
  });

export const setLeaderboardPseudo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pseudo: pseudoSchema }))
  .handler(async ({ data, context }) => {
    const supabase = await supabaseAdmin();
    const { data: ok, error } = await supabase.rpc("set_leaderboard_pseudo", {
      p_user_id: context.userId,
      p_pseudo: data.pseudo,
    });
    if (error) throw new Error("Pseudo refusé par le serveur.");
    return { ok: Boolean(ok) };
  });
