# Supabase — backend Phase 1 (identité + progression)

Ce dossier contient la **seule action manuelle** qui reste pour que la
synchronisation soit opérationnelle : accorder les droits du rôle `authenticated`
dans le projet Supabase.

Rien ici n'est exécuté automatiquement : `npm run build` ne touche pas au projet
distant, et aucun secret de type `service_role` ne vit dans le dépôt.

## 1. Ce que le client exige (mesuré, pas supposé)

Le client (`src/lib/sync-engine.ts`) écrit deux tables et n'écrit jamais dans la
troisième.

| Table | Colonnes envoyées par le client | Clé d'upsert |
| --- | --- | --- |
| `profiles` | `id` (= `auth.uid()`), `email`, `display_name`, `stats` (jsonb) | `id` |
| `progressions` | `user_id`, `deck_id`, `seen` (jsonb), `completed_lessons` (tableau), `updated_at` | `user_id, deck_id` |
| `licences` | **aucune écriture client** (lecture seule, Phase 2) | — |

### Schéma constaté le 2026-10-19 sur le projet de production

Sondé en lecture seule avec la clé `anon` sur `/rest/v1/<table>?select=<colonne>`.
PostgREST valide les colonnes **avant** les privilèges, donc `42703 column … does
not exist` prouve l'absence et `42501 permission denied` prouve l'existence —
sans jamais lire une ligne.

```
profiles       id, email, display_name, stats, created_at
progressions   user_id, deck_id, seen, completed_lessons, updated_at
licences       id, user_id, status, plan, created_at, expires_at, activated_at
```

⚠️ **`licences` n'a pas de colonne `license_id`** (ni `license_key`, `device_id`,
`email`, `order_id`). Le rattachement d'une licence à un compte (Phase 2) doit
donc se faire sur `id` — la documentation de `docs/SECURITY-PREMIUM.md` §12.3 a
été corrigée en conséquence.

## 2. L'action à faire (une seule fois)

1. Ouvrir **Dashboard → SQL Editor → New query**.
2. Coller l'intégralité de [`002-grants.sql`](./002-grants.sql) et exécuter.
   Le script est **idempotent** : il peut être rejoué sans erreur.
3. Rejouer les requêtes de contrôle en bas du fichier (privilèges + policies).

Le fichier fait **deux** choses, et les deux sont nécessaires :

- il accorde les **GRANT** de table (`select, insert, update` sur `profiles` et
  `progressions`, `select` seul sur `licences`, rien pour `anon`) ;
- il (re)pose les **policies RLS** minimales, parce que `enable row level
  security` **sans policy** refuse toute lecture et toute écriture — avec
  exactement le même code `42501` qu'un GRANT manquant. L'interface ne peut pas
  distinguer les deux causes, donc un script qui ne ferait qu'une moitié
  renverrait l'utilisateur vers un correctif déjà appliqué.

## 3. Vérifier depuis l'application

Depuis **Profil → Se connecter** (le gate d'authentification de `__root.tsx`),
puis **Profil → « Synchroniser maintenant »** (marqueur `data-cloud-sync-now`) :

| Résultat affiché | Signification |
| --- | --- |
| « N changement(s) synchronisé(s). » | GRANT + policies en place |
| « Supabase n'autorise pas encore l'enregistrement… » (`42501`) | Le script §2 n'a pas été exécuté, ou a échoué en cours de route |
| « La table Supabase … est introuvable » (`42P01`/`PGRST205`) | La table a été supprimée / n'est pas exposée à l'API |
| « Réseau indisponible… » | Hors-ligne : **rien n'est perdu**, la file locale est conservée |

Aucun de ces échecs ne détruit de données : la file de synchronisation n'est
purgée qu'après un succès **complet** (voir `src/lib/cloud/sync-policy.ts`).

## 4. Nettoyage du compte de test

La QA du 2026-10-19 a créé un compte `*@optimus-qa.invalid` pour prouver le
diagnostic `42501`. La procédure de suppression est en commentaire à la fin de
`002-grants.sql` (les lignes `profiles`/`progressions` d'abord, puis
`Authentication → Users`).

## 5. Ce qui n'est pas couvert ici

- **Aucune migration du schéma** : les trois tables préexistaient au projet et ne
  sont pas gérées par le dépôt. Toute évolution de colonne doit être écrite à la
  main dans le Dashboard, et la table ci-dessus (section 1) doit être mise à jour.
- **Aucun secret** : la clé `service_role` reste hors du dépôt ; le navigateur ne
  reçoit que `VITE_SUPABASE_ANON_KEY`.
- **Phase 2** (rattachement d'une licence à un compte) n'est pas implémentée ; le
  contrat est décrit au §12.3 de `docs/SECURITY-PREMIUM.md`.
