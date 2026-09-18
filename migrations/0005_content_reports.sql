CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('question', 'deck', 'clinical_case')),
  content_id text NOT NULL,
  deck_id text,
  deck_version text,
  label text NOT NULL,
  issue_type text NOT NULL CHECK (
    issue_type IN ('wrong_answer', 'unclear_explanation', 'outdated_source', 'unsafe_recommendation', 'other')
  ),
  details text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_content_idx
  ON content_reports (content_type, content_id);
