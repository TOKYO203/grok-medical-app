// Stub `pg` (node-postgres) pour Cloudflare Pages — cf. vite.config.ts (STUBS CLOUDFLARE PAGES).
// node-postgres exige net.Socket, absent du runtime workerd : toute utilisation
// réelle échoue de toute façon ("query-failed"). La seule consommatrice est
// Better Auth (src/lib/auth/server.ts), et VITE_AUTH_ENABLED=false en prod :
// les méthodes ne sont jamais appelées. ⚠️ Le constructeur NE DOIT PAS lever —
// `new Pool(...)` y est évalué au chargement du module, c'est-à-dire au scope
// global du worker, où toute opération disallowed fait échouer le déploiement.
export class Pool {
  constructor(_options?: unknown) {
    /* no-op : jamais connecté (auth désactivée en prod CF). */
  }
  async connect(): Promise<never> {
    throw new Error("[pg-stub] pg (node-postgres) is not available on Cloudflare Pages (workerd has no net.Socket).");
  }
  async query(): Promise<never> {
    throw new Error("[pg-stub] pg (node-postgres) is not available on Cloudflare Pages (workerd has no net.Socket).");
  }
  async end(): Promise<void> {}
  on(): this {
    return this;
  }
}
export default { Pool };
