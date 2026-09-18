# Preuve de migration des identités sur staging

La PR #16 reste en draft. Aucun merge vers `main` n'est nécessaire.
Les migrations SQL historiques ne sont pas modifiées.

## Configuration requise

Configurer l'environnement GitHub `staging` pour n'autoriser que
`release/v1-hardening`, avec ses protections et son secret
`NEON_STAGING_DATABASE_URL`. Utiliser une base Neon dédiée au staging,
jamais la branche de production. Vérifier cette association dans Neon avant
la première exécution : le nom d'hôte seul ne permet pas de déduire la fonction
réelle d'une base.

Variables indépendantes de l'URL :

- `NEON_STAGING_HOST` : hôte Neon direct exact (pas de `-pooler`).
- `NEON_STAGING_DATABASE` : nom exact de la base.
- `NEON_STAGING_ROLE` : rôle exact disposant des droits de migration.
- `NEON_STAGING_MAX_ORPHANS` : plafond de références orphelines autorisées,
  zéro par défaut. Une augmentation doit suivre l'examen des données historiques.

L'URL doit utiliser `sslmode=verify-full`. Aucun autre paramètre de connexion
n'est accepté. Aucun secret, nom d'utilisateur, URL ou contenu de ligne n'est
écrit dans le rapport. Les compteurs et noms de migrations sont conservés.

Suspendre les écritures applicatives et les déploiements pendant l'exécution.
Le verrou GitHub sérialise ce workflow et un verrou PostgreSQL empêche deux
exécutions du runner. Les tables publiques existantes sont verrouillées pendant
la transaction. Le migrateur de déploiement habituel ne prend pas le verrou
consultatif : ne pas le lancer en parallèle. Les verrous de tables expirent après
5 secondes d'attente, les requêtes après 60 secondes.

## Déroulement

1. Exécuter `Neon staging DB validation` sur `release/v1-hardening`, avec
   `confirmation=STAGING` et `apply=false`.
2. Le runner vérifie la branche, le SHA, l'hôte, la base, le rôle et TLS avant
   toute migration. Il vérifie également la base et le rôle réellement connectés.
3. Dans une seule transaction : inventaire des migrations, capture temporaire
   des lignes historiques, application des migrations manquantes, validation
   des types et des relations FK exactes, contrôle des orphelins et comparaison
   intégrale des trois tables d'identité. Seule la mise à NULL des références
   orphelines prévue par `0013` est autorisée. Les contenus, identifiants de ligne,
   dates et références valides doivent rester identiques.
4. La simulation se termine par ROLLBACK. Examiner l'artefact JSON, notamment
   `status`, `committed`, `commit`, `scenario`, `preflight`, `migrationsApplied`
   et les empreintes SHA-256 des fichiers de migration.
5. Après une simulation réussie et une sauvegarde/possibilité de restauration
   vérifiée dans Neon, relancer sur le même commit avec `apply=true`. Les mêmes
   contrôles sont refaits ; COMMIT n'intervient qu'après leur réussite.
6. Conserver le lien du run et l'artefact dans la preuve de #5. Relancer ensuite
   sans application pour vérifier que `migrationsApplied` est vide.

Tout échec avant COMMIT déclenche un ROLLBACK. Une coupure réseau pendant COMMIT
peut laisser un résultat indéterminé : ne pas conclure à un rollback à partir du
seul rapport ; reconnecter et vérifier l'état des migrations. Les erreurs SQL
brutes sont masquées pour ne pas divulguer de données.

## Portée exacte de la preuve

Les tests utilisent la même fonction que le runner sur PGlite, puis PostgreSQL 16
jetable en CI : base vide, reprise idempotente, références UUID valides, orphelins,
NULL, identifiants Better Auth non UUID, corruption simulée et rollback.
Ils ne constituent pas une preuve d'exécution sur Neon réel.

Le scénario `existing-database` décrit une base déjà dotée des tables applicatives.
Si `0006`/`0013` étaient déjà appliquées, le run ne prouve pas rétroactivement
la conservation des anciennes données lors de leur application. Pour obtenir
cette preuve, utiliser une copie staging de l'état antérieur. Une base vide ne
prouve pas à elle seule la reprise des données existantes.

Le runner ne crée aucune fixture et ne détruit aucune base sur Neon. Les fixtures
PostgreSQL de CI ne sont permises que sur localhost/127.0.0.1 et utilisent des
bases aléatoires supprimées après les tests. Le rapport final n'inclut aucun dump.
Les snapshots restent temporaires dans la transaction, sans artefact de données.
