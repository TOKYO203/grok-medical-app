-- Enforce application identity references only when authentication is enabled.
--
-- Historical `created_by` / `respondent_id` values predate server-verified
-- Better Auth identity and could be client supplied. They were preserved as text
-- by 0006 for a lossless type migration, but an orphan value must not become a
-- trusted identity merely because its shape happens to look valid. Clear only
-- values that cannot be matched to the Better Auth user table, then enforce all
-- future references at the database layer.

UPDATE publications AS publication
   SET created_by = NULL
 WHERE created_by IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "user" AS auth_user WHERE auth_user."id" = publication.created_by
   );

UPDATE surveys AS survey
   SET created_by = NULL
 WHERE created_by IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "user" AS auth_user WHERE auth_user."id" = survey.created_by
   );

UPDATE survey_responses AS response
   SET respondent_id = NULL
 WHERE respondent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "user" AS auth_user WHERE auth_user."id" = response.respondent_id
   );

ALTER TABLE publications
  ADD CONSTRAINT publications_created_by_auth_user_fk
  FOREIGN KEY (created_by) REFERENCES "user" ("id") ON DELETE SET NULL;

ALTER TABLE surveys
  ADD CONSTRAINT surveys_created_by_auth_user_fk
  FOREIGN KEY (created_by) REFERENCES "user" ("id") ON DELETE SET NULL;

ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_respondent_auth_user_fk
  FOREIGN KEY (respondent_id) REFERENCES "user" ("id") ON DELETE SET NULL;
