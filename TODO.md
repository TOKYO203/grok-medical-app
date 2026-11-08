# TODO


## 🎯 À faire — phase beta (20+ users)

- [x] **Backend classement réel** (Supabase) — livré le 2026-11-08 : migration 0023 (RPC get_leaderboard / set_leaderboard_pseudo, filtres anti-triche), src/lib/leaderboard.ts (server fns authentifiées), classement réel sur /classement avec pseudonymes choisis. Dérivé de optimus_user_state : pas de soumission de score séparée.
  - Auth utilisateur
  - Sync des scores (xp, streak, cases, mastery)
  - API `/api/leaderboard` avec pagination
  - Anti-triche côté serveur (validation events)
  - Remplacer `src/content/leaderboard.ts` par fetch API
