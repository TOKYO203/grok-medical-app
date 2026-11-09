import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Défi hebdomadaire (LB-2) — server fns authentifiées.
 * La RPC (migration 0024) refuse toute semaine autre que la semaine en cours
 * et plafonne les scores : l'anti-triche vit côté serveur, pas ici.
 */

export interface WeeklyChallengeRow {
  rank: number;
  pseudo: string;
  score: number;
  total: number;
  self: boolean;
}

const submitSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-W\d{1,2}$/),
  deckId: z.string().min(1).max(80),
  score: z.number().int().min(0).max(500),
  total: z.number().int().min(0).max(500),
});

async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  const { mergedServerEnv, resolveSupabaseServiceKey, resolveSupabaseUrl } = await import("@/server/supabase-env.server");
  const env = mergedServerEnv(process.env);
  const url = resolveSupabaseUrl(env);
  const key = resolveSupabaseServiceKey(env);
  if (!url || !key) throw new Error("Supabase non configuré");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const getWeeklyChallenge = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const supabase = await supabaseAdmin();
    const { currentWeekKey } = await import("@/lib/weekly-challenge-model");
    const { data, error } = await supabase.rpc("get_weekly_challenge", {
      p_week_key: currentWeekKey(),
      p_limit: 50,
      p_self: context.userId,
    });
    if (error || !Array.isArray(data)) throw new Error("Défi indisponible.");
    return { rows: data as WeeklyChallengeRow[] };
  });

export const submitWeeklyChallengeRun = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(submitSchema)
  .handler(async ({ data, context }) => {
    const supabase = await supabaseAdmin();
    const { data: ok, error } = await supabase.rpc("submit_weekly_challenge_run", {
      p_user_id: context.userId,
      p_week_key: data.weekKey,
      p_deck_id: data.deckId,
      p_score: data.score,
      p_total: data.total,
    });
    if (error) throw new Error("Soumission refusée par le serveur.");
    return { ok: Boolean(ok) };
  });
