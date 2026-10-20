-- ═══════════════════════════════════════════════════════════════════════════
--  Supabase — droits manquants pour le backend Phase 1
--
--  À EXÉCUTER UNE SEULE FOIS dans le projet Supabase :
--    Dashboard → SQL Editor → New query → coller ce fichier → Run
--  Puis vérifier avec les requêtes de contrôle en bas de fichier.
--
--  POURQUOI : `supabase-js` s'authentifie avec le rôle `authenticated`. Les
--  policies RLS filtrent les LIGNES ; elles ne remplacent PAS les GRANT de
--  table, qui autorisent l'OPÉRATION. Sans ces GRANT, chaque écriture échoue
--  avec `42501 permission denied for table …` et la synchronisation ne peut
--  pas aboutir — même avec des policies parfaitement correctes.
--
--  Mesuré le 2026-10-19 avec un vrai jeton de session (rôle authenticated) :
--    SELECT  profiles / progressions / licences  → 403 (42501)
--    INSERT  profiles / progressions             → 403 (42501)
--
--  ⚠️ GRANT ET RLS SONT DEUX CHOSES DIFFÉRENTES, ET LES DEUX SONT REQUISES.
--  `enable row level security` sans policy = zéro ligne lisible et toute
--  écriture refusée (même code 42501, donc indistinguable d'un GRANT manquant
--  dans l'interface). C'est pourquoi ce script accorde les GRANT *et* (re)pose
--  les policies minimales : après exécution, l'état est correct que les
--  policies aient été absentes, partielles ou nommées autrement.
--
--  PRINCIPE : moindre privilège.
--    • profiles / progressions : select, insert, update — jamais delete
--      (la suppression de compte passe par l'équipe / le service role).
--    • licences : SELECT uniquement. L'écriture d'une licence est une décision
--      de paiement, elle reste côté serveur (service_role).
--    • `anon` ne reçoit RIEN : un visiteur non connecté n'a aucune raison de
--      lire ou d'écrire ces tables.
--  IDEMPOTENT : le script peut être rejoué sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.progressions to authenticated;
grant select on public.licences to authenticated;

-- Défense en profondeur : RLS doit être ACTIF sur les trois tables. Sans RLS,
-- un GRANT devient une ouverture totale (chaque utilisateur lirait les lignes
-- des autres). On l'active ici pour que l'état soit explicite.
alter table public.profiles enable row level security;
alter table public.progressions enable row level security;
alter table public.licences enable row level security;

-- ── Policies minimales : « mes lignes, et seulement les miennes » ───────────
-- `auth.uid()` est l'identité issue du jeton vérifié par PostgREST. Aucune
-- policy ne fait confiance à une valeur envoyée par le client.
--
-- Les noms sont préfixés par `optimus_` pour ne pas écraser une policy
-- existante portant un autre nom : les policies permissives se combinent en
-- OR, donc le pire effet d'un doublon est de rester permissif sur SES lignes.

drop policy if exists optimus_profiles_select_own on public.profiles;
create policy optimus_profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists optimus_profiles_insert_own on public.profiles;
create policy optimus_profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists optimus_profiles_update_own on public.profiles;
create policy optimus_profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists optimus_progressions_select_own on public.progressions;
create policy optimus_progressions_select_own on public.progressions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists optimus_progressions_insert_own on public.progressions;
create policy optimus_progressions_insert_own on public.progressions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists optimus_progressions_update_own on public.progressions;
create policy optimus_progressions_update_own on public.progressions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- `licences` : lecture seule, et uniquement de SES licences. Le bloc est
-- conditionné à l'existence de la colonne `user_id` (elle n'est utilisée
-- qu'en Phase 2 : si le schéma ne la porte pas encore, on n'échoue pas).
do $optimus$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'licences'
       and column_name = 'user_id'
  ) then
    execute $sql$drop policy if exists optimus_licences_select_own on public.licences$sql$;
    execute $sql$create policy optimus_licences_select_own on public.licences
                 for select to authenticated
                 using (user_id = auth.uid())$sql$;
  end if;
end
$optimus$;

-- ───────────────────────────────────────────────────────────────────────────
--  CONTRÔLE 1 — privilèges de table
--  (doit renvoyer 3 lignes : can_select = true partout)
-- ───────────────────────────────────────────────────────────────────────────
-- select table_name,
--        has_table_privilege('authenticated', 'public.' || table_name, 'select') as can_select,
--        has_table_privilege('authenticated', 'public.' || table_name, 'insert') as can_insert,
--        has_table_privilege('authenticated', 'public.' || table_name, 'update') as can_update,
--        has_table_privilege('anon',         'public.' || table_name, 'select') as anon_can_select
--   from unnest(array['profiles','progressions','licences']) as table_name;
--
-- Attendu : can_select = true partout ; can_insert/update = true sur profiles et
-- progressions, false sur licences ; anon_can_select = false partout.

-- ───────────────────────────────────────────────────────────────────────────
--  CONTRÔLE 2 — policies présentes
-- ───────────────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('profiles','progressions','licences')
--  order by tablename, policyname;
--
-- Attendu : au moins les 6 policies `optimus_*` (3 profiles, 3 progressions),
-- plus `optimus_licences_select_own` si la colonne user_id existe.

-- ───────────────────────────────────────────────────────────────────────────
--  SI `has_table_privilege` renvoie encore false après les GRANT
-- ───────────────────────────────────────────────────────────────────────────
-- Un `revoke` explicite ou un défaut de schéma peut annuler le droit. Vérifier :
--
--   select * from information_schema.role_table_grants
--    where grantee = 'authenticated' and table_schema = 'public';
--
-- Puis rejouer les GRANT ci-dessus.

-- ───────────────────────────────────────────────────────────────────────────
--  NETTOYAGE DU COMPTE DE TEST (créé le 2026-10-19 pour la QA de synchronisation)
-- ───────────────────────────────────────────────────────────────────────────
-- La suppression d'un utilisateur d'authentification se fait côté serveur
-- (auth.users). Depuis le dashboard : Authentication → Users → rechercher
-- « optimus-qa.invalid » → Delete. Les lignes de `profiles`/`progressions`
-- associées doivent être supprimées avant (clé étrangère) :
--
--   delete from public.progressions where user_id in (
--     select id from public.profiles where email like '%@optimus-qa.invalid'
--   );
--   delete from public.profiles where email like '%@optimus-qa.invalid';
