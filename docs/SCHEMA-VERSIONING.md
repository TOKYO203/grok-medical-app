# Versionnement du schéma — état et procédure (2026-11-27)

## Le problème, en une phrase

Trois tables utilisées par le code n'existent dans **aucune** migration :

| Table | Utilisée par | Opération | Clé |
|---|---|---|---|
| `public.profiles` | `src/lib/sync-engine.ts` | `upsert` | anonyme |
| `public.progressions` | `src/lib/sync-engine.ts` | lecture/écriture | anonyme |
| `public.licences` | `src/lib/cloud/content-session.ts` | `select("*")` | anonyme |

Conséquence : leur structure et leurs policies RLS vivent uniquement dans le tableau de
bord Supabase. On ne peut ni les relire en revue, ni les recréer sur un environnement neuf,
ni écrire une policy sans risquer de casser la synchronisation.

## Action unique à faire (côté propriétaire, avec accès base)

```bash
# Option 1 — CLI Supabase (recommandé : reprend aussi les policies et les grants)
supabase link --project-ref <ref>
supabase db dump --schema public -f supabase/schema.sql

# Option 2 — pg_dump direct (nécessite DATABASE_URL avec le rôle postgres)
pg_dump "$DATABASE_URL" --schema-only --schema=public --no-owner --no-privileges \
  -f supabase/schema.sql
```

Puis :

1. Extraire des `CREATE TABLE` / `CREATE POLICY` / `GRANT` les définitions de `profiles`,
   `progressions` et `licences`.
2. Les déposer dans `migrations/0025_version_profiles_progressions_licences.sql`, **écrites en
   `IF NOT EXISTS`** pour être rejouables sur la base existante.
3. Ajouter les policies RLS manquantes (`auth.uid() = user_id`) dans le même fichier.
4. Retirer les trois entrées de l'allowlist de `scripts/rls-anon-invariant.test.mjs` et de
   `scripts/schema-drift.test.mjs` — les tests échouent tant que l'allowlist est périmée,
   c'est voulu.

## Le garde-fou déjà en place

`scripts/schema-drift.test.mjs` compare en CI :

- les tables **créées** par `migrations/*.sql` ;
- les tables **référencées** par un `.from("…")` dans `src/`.

Il échoue si une table référencée n'est ni versionnée ni dans l'allowlist explicite. Toute
nouvelle dépendance à une table hors migrations devient donc un choix visible en revue.

## Requêtes d'introspection

`docs/sql/introspect-tables.sql` liste colonnes, contraintes, index, triggers, policies et
grants des trois tables — de quoi écrire la migration sans se tromper sur les noms de
colonnes de jointure.

## Règle de revue

Toute PR qui ajoute un `.from("<table>")` doit, dans le même commit :

1. créer ou référencer la migration de la table ;
2. déclarer la table dans les allowlists si elle reste hors migrations (avec justification) ;
3. dire explicitement, dans `docs/DECISIONS.md`, qui peut la lire avec quelle clé.
