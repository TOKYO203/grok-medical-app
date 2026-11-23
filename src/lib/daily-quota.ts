/**
 * Modèle freemium (chantier 2, docs/MODEL-FREEMIUM.md) — quota quotidien du
 * gratuit : 10 questions/jour, compteur visible, annoncé AVANT la friction.
 *
 * Module VOLONTAIREMENT PUR (aucun import runtime) : la logique de quota est
 * testable sans store, sans React et sans DOM, et réutilisable côté client
 * comme dans un futur contrôle serveur. Les décisions d'accès (entitlements,
 * essai) restent dans le store / le serveur : ce module ne fait que compter.
 */

/** Dose quotidienne gratuite (docs/MODEL-FREEMIUM.md, répartition). */
export const FREE_DAILY_QUESTION_LIMIT = 10;

export type DailyCounters = { key: string; answered: number };

export type DailyQuotaInput = {
  /** Compteurs du jour persistés par le store (s.daily). */
  daily: DailyCounters;
  /** Clé du jour courant (todayKey()) — injectée pour rester pur et testable. */
  todayKey: string;
  /** Premium (licence OPTIMUS_PRO active) ou essai 7 jours en cours. */
  isPremium: boolean;
};

export type DailyQuota = {
  /** null = illimité (premium). */
  limit: number | null;
  /** Réponses validées aujourd'hui (0 si le compteur date d'un autre jour). */
  used: number;
  /** Questions restantes aujourd'hui (null = illimité). */
  remaining: number | null;
  /** true = une NOUVELLE session ne doit pas démarrer. */
  blocked: boolean;
};

/**
 * Calcule le quota du jour. Le compteur persisté n'est cru sur parole que s'il
 * porte la clé du jour courant : un compteur d'hier ne bloque jamais (reset
 * quotidien par la date, jamais par une mutation destructive).
 */
export function dailyQuestionQuota({ daily, todayKey: today, isPremium }: DailyQuotaInput): DailyQuota {
  const used =
    daily && daily.key === today && Number.isFinite(daily.answered)
      ? Math.max(0, Math.floor(daily.answered))
      : 0;
  if (isPremium) {
    return { limit: null, used, remaining: null, blocked: false };
  }
  const limit = FREE_DAILY_QUESTION_LIMIT;
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, blocked: remaining <= 0 };
}

/** Essai premium actif : fenêtre temporelle stricte, forme invalide = inactif. */
export function isTrialActive(
  trial: { expiresAt: number } | null | undefined,
  now: number,
): boolean {
  return Boolean(trial && Number.isFinite(trial.expiresAt) && trial.expiresAt > now);
}
