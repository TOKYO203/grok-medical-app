/**
 * SANITISATION DU CONTENU QCM — serveur uniquement.
 *
 * Pentest 2026-11-09 (plan de remédiation P2) : les actifs privés de `decks`
 * et `diagnostics` embarquent la grille de correction (`correct`) et
 * l'explication (`explanation`) de chaque question. Servis tels quels par
 * `/content/$type/$file`, ils permettaient à un utilisateur connecté de lire
 * les réponses AVANT de répondre (onglet réseau). Désormais la projection
 * envoyée au client ne porte plus ces deux champs : la correction est décidée
 * côté serveur par `POST /api/quiz/answer`, qui ne révèle la bonne réponse et
 * l'explication qu'APRÈS le choix.
 *
 * ⚠️ Module PUR (aucun `import.meta.glob`) : utilisable par la route de contenu
 * comme par les tests, sans tirer les actifs privés dans le graphe.
 *
 * Hors périmètre (assumé) : `demarches` au sens flashcards (réponse visible par
 * design), `signes` et `pathologies` (pas de QCM à clé de correction).
 */

/** Familles dont la grille de correction ne quitte jamais le serveur. */
export type QuizFamily = "decks" | "diagnostics";

/**
 * Retourne l'objet sans `correct` ni `explanation`. La déstructuration avec
 * renommage `_` évite tout avertissement lint et garantit l'ABSENCE des clés
 * dans la sérialisation JSON (mieux qu'une valeur `undefined` explicite).
 */
function stripAnswerFields<T extends Record<string, unknown>>(entry: T): T {
  const { correct: _correct, explanation: _explanation, ...rest } = entry;
  return rest as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** Projection d'un deck : questions sans `correct`/`explanation`. */
export function sanitizeDeckAsset(asset: unknown): unknown {
  if (!isObject(asset) || !Array.isArray(asset.questions)) return asset;
  return {
    ...asset,
    questions: asset.questions.map((question) =>
      isObject(question) ? stripAnswerFields(question) : question,
    ),
  };
}

/** Projection d'une démarche : étapes sans `correct`/`explanation`. */
export function sanitizeDiagnosticAsset(asset: unknown): unknown {
  if (!isObject(asset) || !Array.isArray(asset.steps)) return asset;
  return {
    ...asset,
    steps: asset.steps.map((step) => (isObject(step) ? stripAnswerFields(step) : step)),
  };
}

/** Aiguillage par famille : toute projection premium QCM passe par ici. */
export function sanitizeQuizAsset(family: QuizFamily, asset: unknown): unknown {
  return family === "decks" ? sanitizeDeckAsset(asset) : sanitizeDiagnosticAsset(asset);
}
