/**
 * Garde-fou : le script SQL de back-office (docs/supabase/003-admin-dashboard.sql)
 * est exécuté par le propriétaire à la main dans Supabase. S'il est faux, on ne
 * l'apprend qu'en production — donc on l'exécute ici, sur un PostgreSQL embarqué
 * (PGlite), avec un schéma stub reproduisant le projet client :
 *
 *   • le script s'exécute et il est IDEMPOTENT (rejouable) ;
 *   • `is_admin` n'est plus une colonne modifiable par `authenticated`
 *     (régression mesurée le 2026-10-22 : auto-promotion en un PATCH) ;
 *   • les GRANT `service_role` sont rétablis, `anon` n'a rien ;
 *   • les policies, triggers et RPC d'administration existent ;
 *   • COMPORTEMENT : un étudiant ne peut ni se promouvoir ni appeler les RPC ;
 *     un admin valide un paiement → licence Premium à +3 mois calendaires,
 *     paiement `paid`, action journalisée, revalidation idempotente.
 *
 * Aucune connexion réseau : tout est local, donc exécutable en CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const SQL = readFileSync("docs/supabase/003-admin-dashboard.sql", "utf8");

/** État « avant 003 » : rôles réels, GRANT de table trop large, policies de 002. */
const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, display_name text, locale text default 'fr',
  stats jsonb default '{}'::jsonb, is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.progressions (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null, seen int default 0, completed_lessons int default 0,
  updated_at timestamptz default now(), primary key (user_id, deck_id)
);
create table public.licences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  licence_hash text not null, plan text not null default 'premium',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz, activated_at timestamptz
);
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text, amount_cents bigint, currency text default 'MGA',
  reference text, status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id),
  action text not null, target_id text, metadata jsonb,
  created_at timestamptz not null default now()
);
create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text, message text not null, status text not null default 'pending',
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.licences to authenticated;
alter table public.profiles enable row level security;
create policy optimus_profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy optimus_profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.cleanup_old_admin_actions(days_to_keep integer)
returns integer language plpgsql security definer as $$ begin return 0; end $$;
create or replace function public.revoke_expired_licences()
returns integer language plpgsql security definer as $$ begin return 0; end $$;
`;

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STUDENT = "22222222-2222-2222-2222-222222222222";
const PAYMENT = "44444444-4444-4444-4444-444444444444";

/** Bascule le rôle SQL + l'identité JWT, exécute, restaure le rôle. */
async function asUser(db, uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await db.exec(sql);
  } finally {
    await db.exec("reset role;");
  }
}

test("003-admin-dashboard.sql", async (t) => {
  const db = await new PGlite();
  await db.exec(BOOTSTRAP);

  await t.test("s'exécute sans erreur et de façon idempotente", async () => {
    await db.exec(SQL);
    await db.exec(SQL); // un second passage ne doit pas échouer
  });

  await t.test("is_admin n'est plus modifiable par un compte connecté", async () => {
    const cols = await db.query(
      `select column_name from information_schema.column_privileges
        where grantee='authenticated' and table_schema='public'
          and table_name='profiles' and privilege_type='UPDATE'`,
    );
    const updatable = cols.rows.map((r) => r.column_name);
    assert.ok(!updatable.includes("is_admin"), `is_admin modifiable : ${updatable.join(",")}`);
    assert.ok(updatable.includes("display_name"), "les colonnes légitimes doivent rester modifiables");

    const tableUpdate = await db.query(
      `select count(*)::int as n from information_schema.table_privileges
        where grantee='authenticated' and table_schema='public'
          and table_name='profiles' and privilege_type='UPDATE'`,
    );
    assert.equal(tableUpdate.rows[0].n, 0, "un GRANT UPDATE de table annulerait la restriction par colonne");
  });

  await t.test("service_role est rétabli, anon ne reçoit rien", async () => {
    const rows = await db.query(
      `select t.table_name,
              has_table_privilege('service_role','public.'||t.table_name,'select') as svc,
              has_table_privilege('anon','public.'||t.table_name,'select') as guest
         from unnest(array['profiles','licences','paiements','admin_actions','error_reports']) t(table_name)`,
    );
    for (const r of rows.rows) {
      assert.equal(r.svc, true, `service_role ne lit pas ${r.table_name}`);
      assert.equal(r.guest, false, `anon lit ${r.table_name}`);
    }
  });

  await t.test("policies, triggers et RPC d'administration sont en place", async () => {
    const pol = await db.query(`select policyname from pg_policies where schemaname='public'`);
    const names = pol.rows.map((r) => r.policyname);
    for (const p of [
      "optimus_profiles_admin_select",
      "optimus_paiements_admin_select",
      "optimus_paiements_admin_update",
      "optimus_licences_admin_select",
      "optimus_licences_admin_update",
      "optimus_admin_actions_admin_select",
      "optimus_admin_actions_admin_insert",
      "optimus_error_reports_admin_select",
      "optimus_error_reports_insert_own",
      "optimus_error_reports_admin_update",
    ]) {
      assert.ok(names.includes(p), `policy manquante : ${p}`);
    }

    const trg = await db.query(
      `select tgname from pg_trigger where not tgisinternal and tgrelid='public.profiles'::regclass`,
    );
    const triggers = trg.rows.map((r) => r.tgname);
    assert.ok(triggers.includes("optimus_guard_profiles_is_admin"), "trigger UPDATE absent");
    assert.ok(triggers.includes("optimus_guard_profiles_insert_admin"), "trigger INSERT absent");

    const priv = await db.query(
      `select routine_name, grantee from information_schema.routine_privileges
        where routine_schema='public' and routine_name like 'admin\\_%'`,
    );
    const routines = [...new Set(priv.rows.map((r) => r.routine_name))].sort();
    assert.deepEqual(routines, [
      "admin_cleanup_actions",
      "admin_revoke_expired_licences",
      "admin_revoke_licence",
      "admin_set_report_status",
      "admin_validate_payment",
    ]);
    assert.equal(priv.rows.filter((r) => r.grantee === "anon").length, 0, "anon ne doit exécuter aucune RPC admin");

    const legacy = await db.query(
      `select has_function_privilege('authenticated','public.cleanup_old_admin_actions(integer)','execute') as a,
              has_function_privilege('authenticated','public.revoke_expired_licences()','execute') as b`,
    );
    assert.equal(legacy.rows[0].a, false, "cleanup_old_admin_actions doit être retirée aux clients");
    assert.equal(legacy.rows[0].b, false, "revoke_expired_licences doit être retirée aux clients");
  });

  await db.exec(`insert into auth.users(id) values ('${ADMIN}'), ('${STUDENT}');
    insert into public.profiles(id,email,is_admin) values
      ('${ADMIN}','admin@optimus.test',true),
      ('${STUDENT}','student@optimus.test',false);`);

  await t.test("un étudiant ne peut pas s'auto-promouvoir", async () => {
    await assert.rejects(
      () => asUser(db, STUDENT, `update public.profiles set is_admin = true where id = '${STUDENT}';`),
      /is_admin|permission|42501/i,
    );
    const still = await db.query(`select is_admin from public.profiles where id='${STUDENT}'`);
    assert.equal(still.rows[0].is_admin, false);
  });

  await t.test("les RPC d'administration refusent un non-admin", async () => {
    await assert.rejects(
      () => asUser(db, STUDENT, `select public.admin_validate_payment('33333333-3333-3333-3333-333333333333');`),
      /administrateur requis|42501/i,
    );
  });

  await t.test("un admin valide un paiement : licence +3 mois, paid, journal, idempotent", async () => {
    await db.exec(`insert into public.paiements(id,user_id,provider,amount_cents,currency,reference,status)
      values ('${PAYMENT}','${STUDENT}','MVola',2700000,'MGA','QA-SQL-001','pending');`);

    await asUser(db, ADMIN, `select public.admin_validate_payment('${PAYMENT}');`);

    const lic = await db.query(
      `select id, plan, status, licence_hash from public.licences where licence_hash = 'manual-${PAYMENT}'`,
    );
    assert.equal(lic.rows.length, 1, "une licence doit être créée");
    assert.equal(lic.rows[0].status, "active");
    assert.equal(lic.rows[0].plan, "premium");

    // Décalage CALENDAIRE (22 oct → 22 janv = 92 jours : un test en « jours
    // fixes » serait faux une partie de l'année).
    const shift = await db.query(
      `select date_trunc('month', expires_at) = date_trunc('month', created_at) + interval '3 months' as month_ok,
              extract(day from expires_at) = extract(day from created_at) as day_ok,
              expires_at > now() as future
         from public.licences where licence_hash='manual-${PAYMENT}'`,
    );
    assert.equal(shift.rows[0].month_ok, true, "l'échéance doit être à +3 mois calendaires");
    assert.equal(shift.rows[0].day_ok, true, "le jour doit être conservé");
    assert.equal(shift.rows[0].future, true);

    const paid = await db.query(`select status from public.paiements where id='${PAYMENT}'`);
    assert.equal(paid.rows[0].status, "paid");

    const audit = await db.query(
      `select action, admin_user_id from public.admin_actions where target_id='${PAYMENT}'`,
    );
    assert.equal(audit.rows.length, 1, "l'action doit être journalisée");
    assert.equal(audit.rows[0].action, "validate_payment");
    assert.equal(audit.rows[0].admin_user_id, ADMIN, "l'auteur de l'action doit être attribuable");

    // Idempotence : revalider ne crée pas une seconde licence.
    await asUser(db, ADMIN, `select public.admin_validate_payment('${PAYMENT}');`);
    const count = await db.query(
      `select count(*)::int as n from public.licences where licence_hash='manual-${PAYMENT}'`,
    );
    assert.equal(count.rows[0].n, 1);
  });

  await t.test("un étudiant peut signaler une erreur", async () => {
    await asUser(db, STUDENT, `insert into public.error_reports(user_id,type,message)
      values ('${STUDENT}','bug','QA');`);
    const rows = await db.query(`select count(*)::int as n from public.error_reports where user_id='${STUDENT}'`);
    assert.equal(rows.rows[0].n, 1);
  });
});
