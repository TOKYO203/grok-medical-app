import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Coque Capacitor d'Optimus (phase 1 : WebView distante).
 *
 * Phase 1 : server.url (variable CAP_SERVER_URL au build) pointe vers
 * l'app deployee (Worker Cloudflare). L'auth Supabase, les jetons de
 * contenu premium (/content/$type/$file) et le backend Worker restent
 * inchanges : aucun garde a reimplementer.
 * Phase 2 (hors-ligne, plus tard) : servir un bundle local via webDir
 * (decks chiffres embarques + PGLite). Ne pas supprimer server.url sans
 * avoir reimplemente les routes serveur /content cote local.
 */
const config: CapacitorConfig = {
  appId: 'mg.optimus.medical',
  appName: 'Optimus',
  webDir: 'dist-mobile',
  server: {
    androidScheme: 'https',
    ...(process.env.CAP_SERVER_URL ? { url: process.env.CAP_SERVER_URL } : {}),
  },
};

export default config;
