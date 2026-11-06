// Stub `postgres` driver pour Cloudflare Pages — n'est utilisé que quand
// DATABASE_URL est absent (dev local). En prod Cloudflare, DATABASE_URL pointe
// toujours Supabase, donc ce driver n'est jamais appelé. Voir vite.config.ts.
export default function postgres() {
  throw new Error("[postgres-stub] `postgres` driver is not available on Cloudflare Pages (prod uses DATABASE_URL + pg Pool).");
}
