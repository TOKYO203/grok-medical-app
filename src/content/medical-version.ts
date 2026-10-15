/**
 * Version du contenu médical (B14) — distincte de la version applicative
 * gérée par src/lib/version-engine.ts (application, pas contenu).
 *
 * Format : v<année>.<mois>-Mada. À incrémenter à chaque cycle de relecture
 * médicale documenté dans docs/CLINICAL-VALIDATION.md.
 */
export const MEDICAL_CONTENT_VERSION = "v2026.10-Mada";

/** Date de la dernière mise à jour du registre éditorial (ISO). */
export const MEDICAL_CONTENT_UPDATED_AT = "2026-10-08";
