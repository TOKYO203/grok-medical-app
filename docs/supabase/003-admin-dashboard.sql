-- ═══════════════════════════════════════════════════════════════════════════
--  Optimus — 003 : rendre le dashboard admin fonctionnel ET sûr
--
--  À EXÉCUTER dans le projet Supabase CLIENT (VITE_SUPABASE_URL,
--  ref « uznagojvhheqstudhypm ») :
--    Dashboard → SQL Editor → New query → coller TOUT ce fichier → Run.
--
--  POURQUOI CE FICHIER EXISTE — état mesuré le 2026-10-22 avec de vrais jetons
--  (`auth/v1/token`), en rôle `authenticated`, avant ce correctif :
--
--    admin_actions   SELECT/INSERT → 403 42501 (aucun GRANT pour authenticated)
--    error_reports   SELECT/INSERT → 403 42501 (aucun GRANT pour authenticated)
--    paiements       UPDATE        → 403 42501 (aucun GRANT pour authenticated)
--    paiements       SELECT        → seulement SES lignes (aucune policy admin)
--    licences        INSERT        → 403 42501 « row-level security policy »
--    licences        SELECT        → 0 ligne visible même pour un admin
--    profiles        SELECT        → seulement SA ligne, même pour un admin
--    webhook_events  SELECT        → 404 PGRST205 (table d'un AUTRE projet)
--    service_role    SELECT        → 403 42501 sur profiles/paiements/
--                                    admin_actions/error_reports
--
--  CONSÉQUENCE : le dashboard se connectait, affichait « 0 » partout et
--  annonçait « ✅ Paiement validé » alors que TROIS écritures venaient d'être
--  refusées. Aucune licence n'était créée. C'est ce que ce script répare.
--
--  ⚠️ RLS ≠ GRANT. Les GRANT autorisent l'OPÉRATION, les policies filtrent les
--  LIGNES. Les deux sont nécessaires, et une policy permissive se COMBINE en OR :
--  un GRANT manquant ne se voit pas dans l'interface (même code 42501).
--
--  ⚠️ VULNÉRABILITÉ CORRIGÉE ICI (critique) : la policy
--  `optimus_profiles_update_own` de 002-grants.sql autorisait
--  `PATCH /profiles?id=eq.<soi>` avec n'importe quelle colonne — donc
--  `{"is_admin": true}`. Mesuré : un compte de test standard est devenu admin
--  en un appel, puis `rpc/is_admin` a répondu `true`. Toutes les policies
--  d'administration reposant sur `is_admin`, c'était une escalade de
--  privilèges horizontale → verticale. Triple correctif ci-dessous :
--    (1) GRANT UPDATE par COLONNE (is_admin n'est plus modifiable),
--    (2) trigger de garde (défense en profondeur, y compris via upsert),
--    (3) les RPC d'administration vérifient le rôle AVANT d'écrire.
--
--  IDEMPOTENT : peut être rejoué sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  0. Helper de rôle — une seule définition de « est admin »
-- ───────────────────────────────────────────────────────────────────────────
-- `security definer` + `search_path` figé : sans cela, la fonction relirait
-- `profiles` SOUS RLS (l'admin ne verrait pas sa propre ligne d'un autre
-- utilisateur) et serait détournable par un `search_path` malveillant.

create or replace function public.optimus_is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false)
$$;

revoke all on function public.optimus_is_admin(uuid) from public;
revoke all on function public.optimus_is_admin(uuid) from anon;
grant execute on function public.optimus_is_admin(uuid) to authenticated, service_role;

-- La fonction historique `is_admin()` (appelée par le dashboard via
-- `/rest/v1/rpc/is_admin`) doit rester exécutable par les comptes connectés.
do $do$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_admin' and p.pronargs = 0
  ) then
    execute 'revoke all on function public.is_admin() from public';
    execute 'grant execute on function public.is_admin() to authenticated, service_role';
  end if;
end
$do$;


-- ───────────────────────────────────────────────────────────────────────────
--  1. GRANT de table — l'opération est autorisée, la RLS décidera des LIGNES
-- ───────────────────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;

-- service_role : jobs serveur, scripts d'exploitation, Cron Supabase.
-- (Aujourd'hui BRISÉ : le rôle serveur ne peut pas lire profiles/paiements.)
grant select, insert, update, delete on
  public.profiles, public.progressions, public.licences,
  public.paiements, public.admin_actions, public.error_reports
  to service_role;

-- profiles : plus AUCUN update de table (voir §2 : update par colonne).
grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;

-- paiements : lecture + mise à jour, mais la RLS interdit l'écriture à un
-- non-admin. L'INSERT reste possible pour ses propres paiements en attente.
grant select, insert, update on public.paiements to authenticated;

-- licences : lecture ; écriture réservée aux admins (policy) et aux RPC.
grant select, insert, update on public.licences to authenticated;

-- Journal et signalements : nécessaires au dashboard, filtrés par policy.
grant select, insert, update on public.admin_actions to authenticated;
grant select, insert, update on public.error_reports to authenticated;

-- `anon` ne reçoit RIEN. Un visiteur non connecté n'a rien à faire ici.
revoke all on public.profiles, public.progressions, public.licences,
  public.paiements, public.admin_actions, public.error_reports from anon;


-- ───────────────────────────────────────────────────────────────────────────
--  2. Anti-escalade : `is_admin` n'est plus une colonne modifiable par le client
-- ───────────────────────────────────────────────────────────────────────────
-- Un GRANT UPDATE de table l'emporterait sur toute restriction de policy :
-- on le retire, puis on rend explicites les SEULES colonnes modifiables.

revoke update on public.profiles from authenticated;
grant update (email, display_name, locale, stats, updated_at) on public.profiles to authenticated;

-- Défense en profondeur : même si un GRANT trop large était rétabli un jour,
-- un utilisateur ne peut pas changer `is_admin` sur une ligne qu'il peut
-- modifier. Le trigger est SECURITY INVOKER : `auth.uid()` reste l'appelant.
create or replace function public.optimus_guard_profiles_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    -- Contexte serveur (SQL Editor, service_role, migration) : autorisé.
    if auth.role() is null or auth.role() = 'service_role' then
      return new;
    end if;
    if not public.optimus_is_admin(auth.uid()) then
      raise exception 'is_admin ne peut pas être modifié par ce compte'
        using errcode = '42501',
              hint = 'La promotion d''un administrateur se fait côté serveur.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists optimus_guard_profiles_is_admin on public.profiles;
create trigger optimus_guard_profiles_is_admin
  before update on public.profiles
  for each row
  execute function public.optimus_guard_profiles_is_admin();

-- À l'INSERT, personne ne peut naître admin depuis le client.
create or replace function public.optimus_guard_profiles_insert_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is true then
    if auth.role() is null or auth.role() = 'service_role' then
      return new;
    end if;
    if not public.optimus_is_admin(auth.uid()) then
      raise exception 'is_admin ne peut pas être défini à la création du profil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists optimus_guard_profiles_insert_admin on public.profiles;
create trigger optimus_guard_profiles_insert_admin
  before insert on public.profiles
  for each row
  execute function public.optimus_guard_profiles_insert_admin();


-- ───────────────────────────────────────────────────────────────────────────
--  3. RLS — les policies qui manquaient au dashboard
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.progressions   enable row level security;
alter table public.licences       enable row level security;
alter table public.paiements      enable row level security;
alter table public.admin_actions  enable row level security;
alter table public.error_reports  enable row level security;

-- ── profiles ───────────────────────────────────────────────────────────────
drop policy if exists optimus_profiles_select_own on public.profiles;
create policy optimus_profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists optimus_profiles_admin_select on public.profiles;
create policy optimus_profiles_admin_select on public.profiles
  for select to authenticated using (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_profiles_insert_own on public.profiles;
create policy optimus_profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists optimus_profiles_update_own on public.profiles;
create policy optimus_profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── paiements ──────────────────────────────────────────────────────────────
drop policy if exists optimus_paiements_select_own on public.paiements;
create policy optimus_paiements_select_own on public.paiements
  for select to authenticated using (user_id = auth.uid());

drop policy if exists optimus_paiements_admin_select on public.paiements;
create policy optimus_paiements_admin_select on public.paiements
  for select to authenticated using (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_paiements_insert_own on public.paiements;
create policy optimus_paiements_insert_own on public.paiements
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists optimus_paiements_admin_update on public.paiements;
create policy optimus_paiements_admin_update on public.paiements
  for update to authenticated
  using (public.optimus_is_admin(auth.uid()))
  with check (public.optimus_is_admin(auth.uid()));

-- ── licences ───────────────────────────────────────────────────────────────
drop policy if exists optimus_licences_select_own on public.licences;
create policy optimus_licences_select_own on public.licences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists optimus_licences_admin_select on public.licences;
create policy optimus_licences_admin_select on public.licences
  for select to authenticated using (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_licences_admin_write on public.licences;
create policy optimus_licences_admin_write on public.licences
  for insert to authenticated
  with check (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_licences_admin_update on public.licences;
create policy optimus_licences_admin_update on public.licences
  for update to authenticated
  using (public.optimus_is_admin(auth.uid()))
  with check (public.optimus_is_admin(auth.uid()));

-- ── admin_actions : journal en écriture seule pour l'admin ─────────────────
drop policy if exists optimus_admin_actions_admin_select on public.admin_actions;
create policy optimus_admin_actions_admin_select on public.admin_actions
  for select to authenticated using (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_admin_actions_admin_insert on public.admin_actions;
create policy optimus_admin_actions_admin_insert on public.admin_actions
  for insert to authenticated
  with check (public.optimus_is_admin(auth.uid()) and admin_user_id = auth.uid());

-- Pas de policy UPDATE/DELETE : un journal d'audit ne se réécrit pas depuis
-- le client. La purge passe par admin_cleanup_actions() (§4).

-- ── error_reports : l'étudiant écrit, l'admin lit ──────────────────────────
drop policy if exists optimus_error_reports_select_own on public.error_reports;
create policy optimus_error_reports_select_own on public.error_reports
  for select to authenticated using (user_id = auth.uid());

drop policy if exists optimus_error_reports_admin_select on public.error_reports;
create policy optimus_error_reports_admin_select on public.error_reports
  for select to authenticated using (public.optimus_is_admin(auth.uid()));

drop policy if exists optimus_error_reports_insert_own on public.error_reports;
create policy optimus_error_reports_insert_own on public.error_reports
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists optimus_error_reports_admin_update on public.error_reports;
create policy optimus_error_reports_admin_update on public.error_reports
  for update to authenticated
  using (public.optimus_is_admin(auth.uid()))
  with check (public.optimus_is_admin(auth.uid()));


-- ───────────────────────────────────────────────────────────────────────────
--  4. RPC d'administration — transactionnelles, idempotentes, vérifiées
-- ───────────────────────────────────────────────────────────────────────────
-- Ces fonctions sont le SEUL chemin d'écriture recommandé pour le dashboard :
--   • elles vérifient le rôle AVANT toute écriture (une policy RLS ne protège
--     pas une fonction `security definer`) ;
--   • elles tiennent en une transaction : plus de paiement « paid » sans
--     licence, ni licence sans journal ;
--   • la date d'expiration est calculée par la BASE (UTC), plus par le
--     navigateur ;
--   • elles sont rejouables : revalider ne crée pas une deuxième licence.

-- ── 4.1 Valider un paiement → licence Premium 3 mois + journal ─────────────
create or replace function public.admin_validate_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_payment    public.paiements;
  v_licence_id uuid;
  v_expires    timestamptz;
  v_months     constant integer := 3;
begin
  if v_uid is null or not public.optimus_is_admin(v_uid) then
    raise exception 'administrateur requis' using errcode = '42501';
  end if;

  select * into v_payment from public.paiements where id = p_payment_id for update;
  if not found then
    raise exception 'paiement introuvable' using errcode = 'P0002';
  end if;

  -- Idempotence : une licence déjà émise pour ce paiement est rendue telle quelle.
  select l.id, l.expires_at into v_licence_id, v_expires
    from public.licences l
   where l.licence_hash = 'manual-' || p_payment_id::text
   order by l.created_at asc
   limit 1;

  if v_licence_id is not null then
    if v_payment.status <> 'paid' then
      update public.paiements set status = 'paid' where id = p_payment_id;
    end if;
    return jsonb_build_object(
      'already_paid', true,
      'payment_id',   p_payment_id,
      'licence_id',   v_licence_id,
      'expires_at',   v_expires
    );
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'paiement au statut « % » : validation refusée', v_payment.status
      using errcode = 'P0001';
  end if;

  -- Ancrage : 3 mois à compter de la VALIDATION (date d'activation), pas de la
  -- réception. `date_trunc('second')` évite les microsecondes dans l'affichage.
  v_expires := date_trunc('second', now()) + make_interval(months => v_months);

  insert into public.licences (user_id, licence_hash, plan, status, expires_at, activated_at)
  values (v_payment.user_id, 'manual-' || p_payment_id::text, 'premium', 'active', v_expires, now())
  returning id into v_licence_id;

  update public.paiements set status = 'paid' where id = p_payment_id;

  insert into public.admin_actions (admin_user_id, action, target_id, metadata)
  values (v_uid, 'validate_payment', p_payment_id::text, jsonb_build_object(
    'user_id',      v_payment.user_id,
    'licence_id',   v_licence_id,
    'expires_at',   v_expires,
    'amount_cents', v_payment.amount_cents,
    'currency',     v_payment.currency,
    'provider',     v_payment.provider
  ));

  return jsonb_build_object(
    'already_paid', false,
    'payment_id',   p_payment_id,
    'licence_id',   v_licence_id,
    'expires_at',   v_expires
  );
end;
$$;

-- ── 4.2 Révoquer une licence ───────────────────────────────────────────────
create or replace function public.admin_revoke_licence(p_licence_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.licences;
begin
  if v_uid is null or not public.optimus_is_admin(v_uid) then
    raise exception 'administrateur requis' using errcode = '42501';
  end if;

  update public.licences
     set status = 'revoked'
   where id = p_licence_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'licence introuvable' using errcode = 'P0002';
  end if;

  insert into public.admin_actions (admin_user_id, action, target_id, metadata)
  values (v_uid, 'revoke_licence', p_licence_id::text,
          jsonb_build_object('user_id', v_row.user_id, 'reason', p_reason));

  return jsonb_build_object('licence_id', v_row.id, 'status', v_row.status);
end;
$$;

-- ── 4.3 Révoquer en masse les licences expirées ────────────────────────────
create or replace function public.admin_revoke_expired_licences()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null or not public.optimus_is_admin(v_uid) then
    raise exception 'administrateur requis' using errcode = '42501';
  end if;

  update public.licences
     set status = 'revoked'
   where status = 'active'
     and expires_at is not null
     and expires_at < now();
  get diagnostics v_count = row_count;

  insert into public.admin_actions (admin_user_id, action, target_id, metadata)
  values (v_uid, 'revoke_expired', null, jsonb_build_object('count', v_count));

  return jsonb_build_object('revoked', v_count);
end;
$$;

-- ── 4.4 Statut d'un signalement ────────────────────────────────────────────
create or replace function public.admin_set_report_status(p_report_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.error_reports;
begin
  if v_uid is null or not public.optimus_is_admin(v_uid) then
    raise exception 'administrateur requis' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'resolved', 'ignored') then
    raise exception 'statut invalide : %', p_status using errcode = 'P0001';
  end if;

  update public.error_reports
     set status = p_status
   where id = p_report_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'signalement introuvable' using errcode = 'P0002';
  end if;

  insert into public.admin_actions (admin_user_id, action, target_id, metadata)
  values (v_uid, 'report_' || p_status, p_report_id::text,
          jsonb_build_object('type', v_row.type, 'user_id', v_row.user_id));

  return jsonb_build_object('report_id', v_row.id, 'status', v_row.status);
end;
$$;

-- ── 4.5 Purge du journal (> N jours) ───────────────────────────────────────
create or replace function public.admin_cleanup_actions(p_days_to_keep integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_deleted integer;
begin
  if v_uid is null or not public.optimus_is_admin(v_uid) then
    raise exception 'administrateur requis' using errcode = '42501';
  end if;

  if p_days_to_keep is null or p_days_to_keep < 30 then
    raise exception 'refus : conserver au moins 30 jours de journal' using errcode = 'P0001';
  end if;

  delete from public.admin_actions
   where created_at < now() - make_interval(days => p_days_to_keep);
  get diagnostics v_deleted = row_count;

  insert into public.admin_actions (admin_user_id, action, target_id, metadata)
  values (v_uid, 'cleanup_actions', null,
          jsonb_build_object('deleted', v_deleted, 'days_to_keep', p_days_to_keep));

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- ── 4.6 Exécution des RPC réservée aux comptes connectés ───────────────────
revoke all on function public.admin_validate_payment(uuid)          from public, anon;
revoke all on function public.admin_revoke_licence(uuid, text)      from public, anon;
revoke all on function public.admin_revoke_expired_licences()       from public, anon;
revoke all on function public.admin_set_report_status(uuid, text)   from public, anon;
revoke all on function public.admin_cleanup_actions(integer)        from public, anon;

grant execute on function public.admin_validate_payment(uuid)        to authenticated, service_role;
grant execute on function public.admin_revoke_licence(uuid, text)    to authenticated, service_role;
grant execute on function public.admin_revoke_expired_licences()     to authenticated, service_role;
grant execute on function public.admin_set_report_status(uuid, text) to authenticated, service_role;
grant execute on function public.admin_cleanup_actions(integer)      to authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────────────
--  5. Fonctions héritées : elles étaient appelables par N'IMPORTE QUI
-- ───────────────────────────────────────────────────────────────────────────
-- Mesuré avant correctif : un compte standard (is_admin = false) appelait
-- /rpc/revoke_expired_licences et /rpc/cleanup_old_admin_actions, tous deux
-- exécutés sans erreur (200). `cleanup_old_admin_actions(0)` supprimait tout
-- le journal d'audit. Ces fonctions restent utiles côté serveur (Cron), mais ne
-- doivent plus être exposées aux clients.

do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'cleanup_old_admin_actions') then
    execute 'revoke all on function public.cleanup_old_admin_actions(integer) from public, anon, authenticated';
    execute 'grant execute on function public.cleanup_old_admin_actions(integer) to service_role';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'revoke_expired_licences') then
    execute 'revoke all on function public.revoke_expired_licences() from public, anon, authenticated';
    execute 'grant execute on function public.revoke_expired_licences() to service_role';
  end if;
end
$do$;


-- ───────────────────────────────────────────────────────────────────────────
--  6. Désigner l'administrateur (à faire UNE fois, à la main)
-- ───────────────────────────────────────────────────────────────────────────
-- 1) Voir les comptes existants :
--      select id, email, is_admin, created_at from public.profiles order by created_at;
-- 2) Promouvoir le bon compte (décommenter et remplacer l'email) :
--      update public.profiles set is_admin = true where email = 'ADMIN@EXEMPLE.COM';
-- 3) Vérifier :
--      select email, is_admin from public.profiles where is_admin;
--
-- ⚠️ Remettre les autres comptes de test à false :
--      update public.profiles set is_admin = false
--       where email like '%@optimus-qa.invalid';


-- ───────────────────────────────────────────────────────────────────────────
--  7. CONTRÔLES (à rejouer après exécution — tout doit être vert)
-- ───────────────────────────────────────────────────────────────────────────

-- 7.1 Privilèges de table (attendu : can_select = t partout, anon = f partout)
-- select table_name,
--        has_table_privilege('authenticated', 'public.'||table_name, 'select') as can_select,
--        has_table_privilege('authenticated', 'public.'||table_name, 'insert') as can_insert,
--        has_table_privilege('authenticated', 'public.'||table_name, 'update') as can_update,
--        has_table_privilege('service_role',  'public.'||table_name, 'select') as service_can_select,
--        has_table_privilege('anon',          'public.'||table_name, 'select') as anon_can_select
--   from unnest(array['profiles','progressions','licences','paiements','admin_actions','error_reports']) as table_name;

-- 7.2 `is_admin` n'est plus une colonne modifiable
-- select column_name, privilege_type
--   from information_schema.column_privileges
--  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profiles'
--  order by column_name;
-- Attendu : is_admin ABSENT de la liste des colonnes UPDATE.

-- 7.3 Policies en place
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('profiles','progressions','licences','paiements','admin_actions','error_reports')
--  order by tablename, policyname;

-- 7.4 Les RPC d'administration ne sont plus accessibles à anon
-- select routine_name, grantee, privilege_type
--   from information_schema.routine_privileges
--  where routine_schema = 'public'
--    and routine_name like 'admin\_%'
--  order by routine_name, grantee;

-- 7.5 Aucune licence orpheline (paiement payé sans licence)
-- select p.id, p.reference, p.status
--   from public.paiements p
--   left join public.licences l on l.licence_hash = 'manual-' || p.id::text
--  where p.status = 'paid' and l.id is null;
