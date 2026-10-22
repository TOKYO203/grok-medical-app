# Politique de conservation et d'effacement des données — Optimus

> Version 1. Cadre général : `docs/LEGAL-MADAGASCAR.md` (loi 2014-038, CMIL, statut EI).
> ⚠️ À valider juridiquement avant la mise en production commerciale (issue #13).

## 1. Principes

- **Minimisation** : email + pseudonyme + progression + licence. Rien d'autre.
- **Contrôle utilisateur** : export JSON, effacement pédagogique, suppression totale du compte (`/donnees`).
- **Priorité des obligations comptables** : les seules écritures commerciales sont conservées pour la durée légale, compensées par une **anonymisation immédiate**.

## 2. Trois actions proposées à l'utilisateur

| Action | Portée | Réversible |
| --- | --- | --- |
| Export | Copie JSON des données liées au compte (sans clés d'appareil) | — |
| Suppression de la progression cloud | Snapshot pédagogique serveur + tombstone `user_erasure` | Oui : reprise explicite de la synchronisation |
| **Suppression totale du compte** | Identité Better Auth + toutes les données personnelles rattachées | **Non** |

## 3. Traitement par catégorie (suppression totale)

| Catégorie | Emplacement | Traitement |
| --- | --- | --- |
| Identité (user, sessions, comptes OAuth, jetons de vérification) | `migrations/auth/0001_auth.sql` | **Suppression immédiate** (cascade sessions/comptes) |
| Progression pédagogique cloud | `optimus_user_state` | **Suppression** + tombstone `account_erasure` |
| Réponses aux enquêtes | `survey_responses` | **Suppression** |
| Signalements de contenu | `content_reports` | **Suppression** |
| Publications et enquêtes (contenu de l'application) | `publications`, `surveys` | **Conservées, détachées** (`created_by` → NULL) |
| Registre commercial | `purchase_orders`, `purchase_order_events` | **Conservation légale + anonymisation immédiate** : `user_id` → pseudonyme irréversible, identifiants d'appareil supprimés (`device_id`, `device_key_id`, `device_public_key`, clés `deviceId`/`optimusId`/`email` retirées des métadonnées). Montants, références, statuts et dates restent pour l'audit financier uniquement |
| Supabase Phase 1 (identité + progression client) | `profiles`, `progressions` | **Suppression best-effort par email** quand les tables existent dans la même base (unifiée depuis la PR #92) |
| Licences (Phase 2, Supabase) | `licences` | Détachement à traiter côté opérateur ; l'accès Premium prend fin avec le compte |

## 4. Durées de conservation

- **Données pédagogiques cloud** : jusqu'à suppression par l'utilisateur.
- **Écritures commerciales anonymisées** : durée des obligations comptables malgaches (10 ans usuel), puis suppression.
- **Sessions Better Auth** : suppression en cascade à la suppression du compte ; expiration naturelle sinon.
- **Tombstone `account_erasure`** : conservé (identifiant technique seul) pour empêcher toute recréation silencieuse par un autre appareil.

## 5. Pseudonyme commercial

`erased:` + SHA-256 de `optimus-account-erasure-v1:<user id>` : irréversible, stable par compte, **jamais réutilisé** — un nouveau compte produit un nouvel identifiant, donc un nouveau pseudonyme. Les lignes restent auditables sans être rattachables à une personne.

## 6. Implémentation

- Migration `0016_account_erasure.sql` (contrainte `reason` élargie).
- `src/lib/optimus-sync.ts` : `deleteOptimusAccountEntirely` — **une seule instruction SQL atomique** (CTE à modification de données) ; échec = rien n'est effacé.
- `/donnees` : confirmation par saisie « SUPPRIMER MON COMPTE » ; au succès, rechargement → profil local.
- Tests : `scripts/optimus-privacy.test.mjs` (PGLite — identité supprimée, commerce anonymisé, tombstone, détachement des publications, nettoyage Phase 1).
