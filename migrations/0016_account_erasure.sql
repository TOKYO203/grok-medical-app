-- Suppression totale du compte : distingue l'effacement pédagogique (reprise
-- possible après confirmation explicite) de l'effacement définitif du compte
-- Better Auth. Aucune migration déjà appliquée n'est modifiée : la contrainte
-- CHECK d'origine est remplacée par une version élargie portant le même nom.

ALTER TABLE optimus_sync_controls
  DROP CONSTRAINT IF EXISTS optimus_sync_controls_reason_check;

ALTER TABLE optimus_sync_controls
  ADD CONSTRAINT optimus_sync_controls_reason_check
  CHECK (reason IN ('user_erasure', 'account_erasure'));
