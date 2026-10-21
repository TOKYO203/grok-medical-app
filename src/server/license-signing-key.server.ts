/**
 * Lecture de la clé privée de signature des reçus de licence — SERVEUR only.
 *
 * POURQUOI CE MODULE EXISTE
 * Deux garde-fous du dépôt interdisent qu'une clé privée soit référencée ailleurs
 * que dans `src/routes/api.*`, `src/server/**` ou un fichier `*.server.ts` :
 *   · scripts/security-license.test.mjs  — « aucun secret de licence ne peut
 *     atteindre le navigateur » ;
 *   · scripts/purchase-security.test.mjs — « device private material and raw
 *     proof files stay outside commerce and learning cloud stores ».
 * `src/lib/purchase-orders.ts` est importé par des composants clients (les
 * server functions y sont déclarées) : y lire la clé, même dans un handler
 * serveur, laissait le motif dans un module isomorphe et faisait échouer les
 * deux tests. Lire la clé ICI, et n'exposer qu'un *getter*, remet la frontière
 * là où elle doit être — et rend la violation impossible à réintroduire par
 * simple copier-coller.
 *
 * La clé n'est jamais journalis��e, ni renvoyée au client : un appelant reçoit
 * `null` et décide de dégrader (reçu non signé) sans révéler pourquoi.
 */

/** Valeur brute de la clé, ou `null` si absente/vide. */
export function readLicenseSigningKey(): string | null {
  const pem = (process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "").trim();
  return pem.length > 0 ? pem : null;
}
