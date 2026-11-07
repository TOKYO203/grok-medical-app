// Stub better-auth pour SSR Cloudflare quand VITE_AUTH_ENABLED=false.
// Les vraies fonctions ne sont jamais appelées (authDisabled=true côté serveur).
// Économie : ~1.8 MiB sur le worker. Le client garde le vrai code.
export const betterAuth = (_opts: any) => ({ api: { getSession: async () => null, signOut: async () => ({}) }, handler: async () => new Response(null, { status: 404 }) });
export const bearer = (_opts?: any) => ({ id: "bearer" });
export const genericOAuth = (_opts?: any) => ({ id: "genericOAuth" });
export const tanstackStartCookies = () => ({ id: "tanstackStartCookies" });
export const createAuthMiddleware = (_fn?: any) => async (ctx: any) => ctx;
export const getSessionFromCtx = async (_ctx: any) => null;
export const parseSetCookieHeader = (_header: string) => new Map();
export const handleOAuthUserInfo = async (_ctx: any) => ({});
export const createKyselyAdapter = () => { throw new Error("[stub] kysely"); };

// Client-side createAuthClient stub — utilisé par client.ts qui est bundlé
// dans le worker via le route tree (TanStack Start inclut tout).
export const createAuthClient = (_opts?: any) => ({
  signIn: { social: async () => ({}), email: async () => ({}) },
  signOut: async () => ({}),
  useSession: () => ({ data: null, isPending: false, error: null }),
  getSession: async () => null,
});
// Hook better-auth/react standard (jamais appelé, auth désactivée — mais l'import nommé doit exister côté worker).
export const useSession = () => ({ data: null, isPending: false, error: null });
