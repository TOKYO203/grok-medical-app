-- Align application-owned user identifiers with Better Auth, whose user.id is TEXT.
-- Keep this as a new migration: previously-applied migrations are immutable.

ALTER TABLE publications
  ALTER COLUMN created_by TYPE text USING created_by::text;

ALTER TABLE surveys
  ALTER COLUMN created_by TYPE text USING created_by::text;

ALTER TABLE survey_responses
  ALTER COLUMN respondent_id TYPE text USING respondent_id::text;

CREATE INDEX IF NOT EXISTS publications_created_by_idx
  ON publications (created_by);

CREATE INDEX IF NOT EXISTS surveys_created_by_idx
  ON surveys (created_by);

CREATE INDEX IF NOT EXISTS survey_responses_respondent_id_idx
  ON survey_responses (respondent_id);
