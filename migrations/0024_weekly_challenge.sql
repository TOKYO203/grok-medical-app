-- migrations/0024_weekly_challenge.sql
-- Défi hebdomadaire (LB-2) : un deck désigné par semaine, mini-classement dédié.
--
-- Le deck désigné est choisi DÉTERMINISTEMENT côté client (rotation par hash de
-- la clé de semaine) : le serveur n'a pas besoin de connaître le catalogue.
-- Ce que le serveur garantit :
--   · une seule run par utilisateur et par semaine (PK user_id, week_key) ;
--   · seule la semaine EN COURS est acceptée (pas de backfill a posteriori) ;
--   · plafonds de plausibilité : 0 <= score <= total <= 500 ;
--   · le meilleur score de la semaine est conservé (upsert max) ;
--   · pseudonymes uniquement (coalesce leaderboard_pseudo, displayName), les
--     user_id ne sont jamais exposés (is_self pour marquer sa ligne).

CREATE TABLE IF NOT EXISTS weekly_challenge_runs (
  user_id text NOT NULL,
  week_key text NOT NULL,
  deck_id text NOT NULL,
  score int NOT NULL CHECK (score >= 0),
  total int NOT NULL CHECK (total >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);

ALTER TABLE weekly_challenge_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS weekly_challenge_runs_week_idx
  ON weekly_challenge_runs (week_key, score DESC);

CREATE OR REPLACE FUNCTION public.submit_weekly_challenge_run(
  p_user_id text,
  p_week_key text,
  p_deck_id text,
  p_score int,
  p_total int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Anti-triche : seule la semaine en cours peut être soumise.
  IF p_week_key IS NULL OR p_week_key <> to_char(now(), 'IYYY-"W"IW') THEN
    RETURN false;
  END IF;
  IF p_deck_id IS NULL OR char_length(p_deck_id) NOT BETWEEN 1 AND 80 THEN
    RETURN false;
  END IF;
  IF p_score IS NULL OR p_total IS NULL
     OR p_score < 0 OR p_total < 1
     OR p_score > p_total OR p_total > 500 THEN
    RETURN false;
  END IF;

  INSERT INTO weekly_challenge_runs (user_id, week_key, deck_id, score, total, updated_at)
  VALUES (p_user_id, p_week_key, p_deck_id, p_score, p_total, now())
  ON CONFLICT (user_id, week_key) DO UPDATE
    SET deck_id = EXCLUDED.deck_id,
        score = GREATEST(weekly_challenge_runs.score, EXCLUDED.score),
        total = CASE
          WHEN EXCLUDED.score > weekly_challenge_runs.score THEN EXCLUDED.total
          ELSE weekly_challenge_runs.total
        END,
        updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_challenge(
  p_week_key text,
  p_limit int,
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
      'rank', row_number() OVER (ORDER BY r.score DESC, r.total DESC, r.updated_at ASC),
      'pseudo', coalesce(p.pseudo, o.state->'profile'->>'displayName', 'Étudiant'),
      'score', r.score,
      'total', r.total,
      'self', r.user_id = p_self
    ) AS row
    FROM (
      SELECT * FROM weekly_challenge_runs
      WHERE week_key = p_week_key
      ORDER BY score DESC, total DESC, updated_at ASC
      LIMIT least(greatest(coalesce(p_limit, 10), 1), 50)
    ) r
    LEFT JOIN leaderboard_pseudo p ON p.user_id = r.user_id
    LEFT JOIN optimus_user_state o ON o.user_id = r.user_id
  ) ranked;
$$;

GRANT EXECUTE ON FUNCTION public.submit_weekly_challenge_run(text, text, text, int, int) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_weekly_challenge(text, int, text) TO postgres;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.submit_weekly_challenge_run(text, text, text, int, int) TO service_role;
    GRANT EXECUTE ON FUNCTION public.get_weekly_challenge(text, int, text) TO service_role;
  END IF;
END
$grant$;

COMMENT ON FUNCTION public.submit_weekly_challenge_run(text, text, text, int, int)
  IS 'Soumet la run du défi hebdo (semaine en cours uniquement, plafonds anti-triche, meilleur score conservé).';
COMMENT ON FUNCTION public.get_weekly_challenge(text, int, text)
  IS 'Mini-classement du défi hebdo : pseudonymes, jamais de user_id exposé.';
