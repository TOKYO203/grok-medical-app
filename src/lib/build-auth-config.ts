/**
 * Config d'auth capturée AU BUILD (pas à l'exécution).
 *
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sont des variables de compilation :
 * Vite les remplace dans le bundle au moment du build GitHub Actions. Une
 * variable runtime sur le Worker ne peut pas les réparer. Ce module fige, en
 * booléens uniquement (jamais de valeur), ce que le build a réellement vu —
 * exposé via /api/health/checkout pour répondre en une seconde à « pourquoi le
 * login affiche “cloud non configuré” ? ».
 */
export const BUILD_CLIENT_SUPABASE = {
  urlSet: Boolean((import.meta.env?.VITE_SUPABASE_URL ?? "").trim()),
  anonKeySet: Boolean((import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "").trim()),
};
