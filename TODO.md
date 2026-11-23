# TODO

## 🎯 À faire — phase beta (20+ users)

- [x] **Couche compétition (LB-2, 2026-11-08)** — défi hebdo (deck désigné déterministe par semaine, migration 0024, RPC plafonnées semaine-en-cours uniquement), carte défi sur /classement, rivaux silencieux (compteurs, jamais d'identités), classe des facultés (somme des XP hebdo). Restent : badges collectifs de promo, duels 1v1 (moteur WebRTC p2p déjà présent).

- [x] **Backend classement réel** (Supabase) — livré le 2026-11-08 : migration 0023 (RPC get_leaderboard / set_leaderboard_pseudo, filtres anti-triche), src/lib/leaderboard.ts (server fns authentifiées), classement réel sur /classement avec pseudonymes choisis. Dérivé de optimus_user_state : pas de soumission de score séparée.
  - Auth utilisateur
  - Sync des scores (xp, streak, cases, mastery)
  - API `/api/leaderboard` avec pagination
  - Anti-triche côté serveur (validation events)
  - Remplacer `src/content/leaderboard.ts` par fetch API

## 📌 Dettes & prochaines étapes (2026-11-12)

Détail et mesures : `docs/ETAT-PROJET-2026-11-12.md`,
`docs/CONTENU-PREMIUM-ECARTS.md`. Séquencement : `docs/ROADMAP-PRODUIT-SERIEUX.md`.

### Contenu (gel médical tant que le cahier des charges n'est pas fourni)

- [ ] Relecture médicale : 236/236 fiches `pending-medical-review`, 43/43 démarches sans `reviewStatus`, 0 `reviewedBy` en imagerie et histologie
- [ ] Decks pour les spécialités à zéro (gynéco, pédiatrie, néphro, hémato, endocrino, pneumo, gastro, rhumato, urologie, psychiatrie, ophtalmo, ORL, orthopédie)
- [ ] Normaliser 5 cas cliniques sans champ `access` et 3 fiches sans `specialty`
- [ ] Module « Examens complémentaires » (5 indications) — non commencé
- [ ] Imagerie : 4 modalités (aujourd'hui 5 cas `radio` seulement)
- [ ] Auscultation : porter le catalogue à 20–30 sons (10 aujourd'hui)
- [ ] Décision i18n contenu : traduire 20 fiches ou retirer la promesse internationale (contenu 100 % `fr`)

### Produit / Premium

- [ ] Statistiques par spécialité (points faibles) dans `/profil`
- [ ] Cas vitrine hebdomadaire en lecture seule
- [ ] Quotas ECG / imagerie 5 par jour (seul le quota 10 questions/jour existe)
- [ ] Vérifier le déclenchement de l'essai 7 jours au pic d'engagement (streak 3–5)

### Exploitation / sécurité

- [x] Sauvegarde production scriptée et chiffrée (`scripts/backup-postgres.mjs` + `db-backup.yml`, restauration vérifiée à chaque exécution) — 2026-11-12
- [ ] Créer les secrets GitHub `DATABASE_URL`, `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY` et activer le PITR des deux projets Supabase
- [x] Monitoring : sonde `/api/health`, alerte webhook sur 5xx et sonde uptime planifiée — 2026-11-12
- [ ] Poser `ERROR_ALERT_WEBHOOK` (alertes 5xx) et `UPTIME_ALERT_WEBHOOK` (sonde) comme secrets pour activer les alertes
- [ ] Dater le premier exercice de restauration trimestriel dans `docs/production-runbook.md` § 4.2
- [ ] Trancher le back-office unique (`ADMIN_PASSWORD` vs `is_admin`, P0-9)
- [ ] Quotas `/content/*` et webhook (P1-6)
- [ ] Supprimer les vestiges de déploiement : Worker `optimus-medical-prod`, Pages `optimusmedical` / `grok-medical-app`, Netlify `cheerful-otter-56f2b3`
- [ ] Domaine canonique custom (`optimus-medical.com`) et redirections

### Technique

- [x] `build:cloudflare` corrigé : délègue à `build:worker` et exige un vrai artefact Worker (`wrangler.json` + `dist/index.html`) — 2026-11-12
- [x] Re-vérification de production scriptée (`npm run prod:verify`, branchée en fin de déploiement) — 2026-11-12
- [ ] Redéployer le Worker depuis `HEAD` et exiger `prod:verify` vert (sauf alertes de configuration attendues)
- [ ] Nettoyage code mort (1 suppression = 1 vérification = 1 test)
- [ ] Mode daltonien ECG (F48, reporté)
- [ ] Rejouer les gates après `npm ci` : `typecheck`, `test`, `build`
