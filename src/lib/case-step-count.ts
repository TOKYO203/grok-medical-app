import type { ClinicalCase } from "@/core/types";

/**
 * Nombre d'étapes d'un dossier, même quand son contenu n'est pas chargé.
 *
 * Les dossiers `pro` sont publiés sans `steps` (correctif §14 du pentest) :
 * `stepCount` porte le total annoncé par l'index public, `steps` celui du
 * contenu réellement disponible. Sans ce garde, une carte de cas verrouillé
 * afficherait « 0 étape » alors que le dossier en compte sept.
 */
export function caseStepCount(clinical: ClinicalCase): number {
  return Math.max(clinical.stepCount ?? 0, clinical.steps.length);
}
