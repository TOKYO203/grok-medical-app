-- 0003_add_publications_and_surveys.sql

-- Publications
CREATE TABLE IF NOT EXISTS publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  summary text,
  body jsonb,
  authors jsonb,
  attachments jsonb,
  tags text[],
  specialties text[],
  visibility text DEFAULT 'public',
  status text DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Surveys
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid,
  target text,
  anonymized boolean DEFAULT true,
  consent_text text,
  open_at timestamptz,
  close_at timestamptz,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  position int NOT NULL,
  type text NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  required boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id uuid,
  submitted_at timestamptz DEFAULT now(),
  answers jsonb,
  metadata jsonb
);
