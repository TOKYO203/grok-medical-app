// Stub PGlite pour Cloudflare Pages — PGlite (WASM Postgres) pèse ~730 KiB et
// n'est JAMAIS utilisé en prod : Cloudflare Pages + Supabase = Postgres distant
// via DATABASE_URL. Le stub est aliasé uniquement quand CF_PAGES=true.
// Voir vite.config.ts → resolve.alias.
export class PGlite {
  constructor() { throw new Error("[pglite-stub] PGlite is not available on Cloudflare Pages (prod uses DATABASE_URL)."); }
  async waitReady(): Promise<void> { throw new Error("[pglite-stub] no-op"); }
  async exec(): Promise<void> { throw new Error("[pglite-stub] no-op"); }
}
