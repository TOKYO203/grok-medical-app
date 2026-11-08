-- migrations/0023_leaderboard.sql
-- Classement réel (beta) : leaderboard dérivé de optimus_user_state.
--
-- Architecture : l'état d'apprentissage est DÉJÀ synchronisé et validé serveur
-- (optimus-sync-model.ts, authMiddleware, snapshot zod) dans optimus_user_state.
-- Le classement le lit directement : aucune soumission de score séparée, donc
-- aucun canal de triche supplémentaire. L'anti-triche supplémentaire est un
-- filtre de plausibilité (un snapshot falsifié aux valeurs absurdes n'apparaît
-- simplement pas).
--
-- Saison hebdomadaire : le classement ordonne par XP de la semaine
-- (weeklyXp, la même métrique que les ligues) et n'accepte un weeklyXp que si
-- le weeklyKey du snapshot est bien la semaine en cours ; sinon l'étudiant
-- apparaît avec 0 XP hebdo (inactif cette semaine), sans XP historique perdu.
--
-- Anonymat (décision produit 2026-11-08) : pseudonymes CHOISIS. La table
-- leaderboard_pseudo stocke le pseudo par user_id ; le classement affiche
-- coalesce(pseudo, displayName) du snapshot. Le user_id n'est JAMAIS exposé
-- dans les lignes du classement (seulement is_self pour marquer sa ligne).
-- Visible par tous les utilisateurs connectés (authMiddleware côté server fn).

-- Le pseudo choisi, indépendant du snapshot (qui lui, reste au nom d'affichage).
CREATE TABLE IF NOT EXISTS leaderboard_pseudo (
  user_id text PRIMARY KEY,
  pseudo text NOT NULL CHECK (char_length(pseudo) BETWEEN 2 AND 24),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leaderboard_pseudo ENABLE ROW LEVEL SECURITY;

-- ── Pseudonyme ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_leaderboard_pseudo(
  p_user_id text,
  p_pseudo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Pseudo lisible : lettres (accents inclus), chiffres, espace, . _ ' -
  IF p_pseudo IS NULL OR char_length(p_pseudo) NOT BETWEEN 2 AND 24
     OR p_pseudo !~ '^[A-Za-zÀ-ÿ0-9 .''_-]+$' THEN
    RETURN false;
  END IF;

  -- Trim : le CHECK de la table porte sur la valeur STOCKÉE.
  INSERT INTO leaderboard_pseudo (user_id, pseudo, updated_at)
  VALUES (p_user_id, trim(p_pseudo), now())
  ON CONFLICT (user_id) DO UPDATE
    SET pseudo = EXCLUDED.pseudo,
        updated_at = now()
    WHERE leaderboard_pseudo.user_id = EXCLUDED.user_id;
  RETURN true;
END;
$$;

-- ── Classement ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit int,
  p_offset int,
  p_self text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY row->>'rank'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'rank', row_number() OVER (ORDER BY
        (CASE WHEN (state->>'weeklyKey') = to_char(now(), 'IYYY-"W"IW')
              THEN (state->>'weeklyXp')::bigint ELSE 0 END) DESC,
        (state->>'xp')::bigint DESC,
        o.updated_at ASC),
      'pseudo', coalesce(p.pseudo, state->'profile'->>'displayName', 'Étudiant'),
      'xp', least((state->>'xp')::bigint, 500000),
      'weeklyXp', CASE WHEN (state->>'weeklyKey') = to_char(now(), 'IYYY-"W"IW')
                       THEN least((state->>'weeklyXp')::bigint, 20000) ELSE 0 END,
      'streak', least((state->>'streak')::int, 999),
      'cases', least(jsonb_array_length(state->'casesCompleted'), 20000),
      'country', coalesce(state->'profile'->>'country', ''),
      'faculty', coalesce(state->'profile'->>'faculty', ''),
      'year', coalesce((state->'profile'->>'studyYear')::int, 0),
      'subject', coalesce(state->'profile'->'prioritySubjects'->>0, ''),
      'self', o.user_id = p_self
    ) AS row
    FROM optimus_user_state o
    LEFT JOIN leaderboard_pseudo p ON p.user_id = o.user_id
    WHERE state ? 'profile'
      -- Filtre de plausibilité anti-triche : un snapshot falsifié avec des
      -- valeurs absurdes est exclu du classement plutôt qu'affiché.
      AND coalesce((state->>'xp')::bigint, 0) <= 500000
      AND coalesce((state->>'streak')::int, 0) <= 999
      AND coalesce(jsonb_array_length(state->'casesCompleted'), 0) <= 20000
  ) ranked
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- Grants : appelées uniquement via la clé de service (server fns authentifiées).
GRANT EXECUTE ON FUNCTION public.set_leaderboard_pseudo(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int, int, text) TO postgres;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.set_leaderboard_pseudo(text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.get_leaderboard(int, int, text) TO service_role;
  END IF;
END
$grant$;

COMMENT ON FUNCTION public.set_leaderboard_pseudo(text, text)
  IS 'Pseudo choisi pour le classement (2-24 caractères, jamais de user_id exposé).';
COMMENT ON FUNCTION public.get_leaderboard(int, int, text)
  IS 'Classement hebdomadaire dérivé de optimus_user_state, avec filtres de plausibilité anti-triche.';
