// Plugin Vite : remplace better-auth par un stub en SSR UNIQUEMENT (prod CF).
// Économie ~1.8 MiB sur le worker. Client intact (auth UI fonctionne).
export default function authStubSsr() {
  // Ne stubbe QUE si l'auth est désactivée. Si activée, better-auth réel est bundlé.
  if (process.env.VITE_AUTH_ENABLED !== 'false') {
    return { name: 'auth-stub-ssr-disabled', enforce: 'pre' };
  }
  const stub = new URL('../src/lib/auth/stub-ssr.ts', import.meta.url).pathname;
  const mods = [
    'better-auth', 'better-auth/react', 'better-auth/plugins', 'better-auth/tanstack-start',
    'better-auth/api', 'better-auth/cookies', 'better-auth/oauth2',
    '@better-auth/core', '@better-auth/kysely-adapter',
  ];
  return {
    name: 'auth-stub-ssr',
    enforce: 'pre',
    resolveId(source, _importer, opts) {
      if (opts?.ssr && mods.some((m) => source === m || source.startsWith(m + '/'))) return stub;
      return null;
    },
  };
}
