/**
 * Essai Premium de 7 jours — Mission International, Session 1 (A03).
 *
 * L'essai est volontairement un état LOCAL, distinct des droits serveur :
 * il n'accorde aucun entitlement et ne déchiffre pas les Decks chiffrés
 * (impossible sans licence émise et signée par le serveur). Pendant 7
 * jours, il ouvre l'intégralité des cas cliniques et démarches Premium
 * vérifiés côté client — exactement ce que l'aperçu gratuit limite.
 *
 * Un seul essai par profil : une fois `premiumTrial` défini, il n'est
 * jamais réinitialisé (voir `startPremiumTrial` dans src/state/store.ts).
 */

export const TRIAL_DAYS = 7;
const DAY_MS = 86_400_000;

export type PremiumTrial = {
  startedAt: number;
  expiresAt: number;
};

export function startTrial(now = Date.now()): PremiumTrial {
  return { startedAt: now, expiresAt: now + TRIAL_DAYS * DAY_MS };
}

export function isTrialActive(
  trial: PremiumTrial | null | undefined,
  now = Date.now(),
): boolean {
  return Boolean(trial && trial.expiresAt > now);
}

/** Jours restants, arrondis au supérieur (J-7 … J-1, 0 si expiré). */
export function trialRemainingDays(
  trial: PremiumTrial | null | undefined,
  now = Date.now(),
): number {
  if (!trial) return 0;
  return Math.max(0, Math.ceil((trial.expiresAt - now) / DAY_MS));
}
