// Plugin Vite : remplace les gros JSON du catalog par un tableau vide
// UNIQUEMENT en SSR (worker Cloudflare). Côté client les vraies données
// sont chargées → app fonctionnelle. Économie ~1 MiB sur le worker.
export default function catalogSsrStub() {
  return {
    name: 'catalog-ssr-stub',
    enforce: 'pre',
    resolveId(source, importer, opts) {
      if (!opts?.ssr) return null;
      if (/\/content\/data\/(decks|cases|diagnostics)\.json(\?.*)?$/.test(source)) {
        return source.split('?')[0] + '?ssr-stub';
      }
      return null;
    },
    load(id) {
      if (id.endsWith('?ssr-stub')) return 'export default [];';
      return null;
    },
  };
}
