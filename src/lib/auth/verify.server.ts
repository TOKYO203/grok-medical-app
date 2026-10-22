import { getRequest } from "@tanstack/react-start/server";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth, authConfigured } from "./server";
import { resolveSupabaseBearer } from "./supabase-identity.server";

/**
 * Server-side session resolution (server-only).
 *
 * Because this app runs its OWN Better Auth at same-origin `/api/auth/*`, the
 * session cookie is sent with every request to this app — server functions AND
 * SSR loaders included. So we resolve the user straight from the request cookies
 * via `auth.api.getSession` (no client-minted JWT needed). Never trust a
 * client-supplied user id — only the result of this verification.
 */

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Re-export so callers can branch on it without importing `server.ts`. */
export { authConfigured };

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is disabled (VITE_AUTH_ENABLED=false) " +
      "— requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

/** Dev fallback user id, used only when auth is disabled (VITE_AUTH_ENABLED=false). */
export const DEV_USER_ID = "dev-user";

/**
 * Thrown by `requireUserId` when the caller has no valid session. Carries
 * `status: 401`; the message is a stable contract — match
 * `err.message === "Unauthorized"` client-side to send the visitor to sign-in.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * L'identité n'a pas pu être VÉRIFIÉE (Supabase ne répond pas).
 *
 * Distinct de `UnauthorizedError` à dessein : renvoyer 401 ferait afficher
 * « reconnectez-vous » alors que la session est parfaitement valide et que la
 * seule chose en cause est une panne passagère. `status: 503` dit « réessayez ».
 */
export class IdentityUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super("La vérification du compte est momentanément indisponible. Réessayez dans un instant.");
    this.name = "IdentityUnavailableError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Resolve the signed-in user from the current request, or `null` when auth isn't
 * configured / nobody is signed in. Safe to call from server functions and SSR
 * loaders.
 *
 * `bearerToken` is for the LIVE PREVIEW: the app runs in a partitioned iframe
 * whose cookies don't reach the server, so `authMiddleware` forwards the session
 * as a bearer token, which we present as `Authorization: Bearer …` (the `bearer`
 * plugin resolves it). When deployed no token is passed and the cookie is used.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured && !gateIdentityEnabled()) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Resolve the current user id for a server function, or throw when unauthorized.
 * Prefer `authMiddleware` (`./middleware`), which calls this for you.
 *
 * ORDRE DE RÉSOLUTION — Supabase d'abord, Better Auth ensuite.
 *
 * Supabase est l'identité de PRODUCTION : c'est le seul fournisseur capable
 * d'ouvrir une session sur le déploiement (l'ancien `/api/auth/*` n'y répond
 * pas). Better Auth ne sert plus que de repli pour le bac à sable de
 * prévisualisation et les déploiements historiques.
 *
 *   1. jeton Supabase vérifié par son émetteur -> son `sub` ;
 *   2. jeton Supabase refusé -> `UnauthorizedError` (401) — on ne retombe PAS
 *      sur Better Auth : un jeton falsifié ne doit pas devenir une identité ;
 *   3. Supabase injoignable -> `IdentityUnavailableError` (503, « réessayez ») ;
 *   4. jeton absent ou émis par un autre système -> chemin Better Auth historique
 *      (auth désactivée + base réelle = échec fermé ; auth désactivée sans base
 *      = utilisateur de développement partagé).
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  const supabase = await resolveSupabaseBearer(bearerToken);
  if (supabase.kind === "verified") return supabase.userId;
  if (supabase.kind === "rejected") throw new UnauthorizedError();
  if (supabase.kind === "unreachable") throw new IdentityUnavailableError();

  if (!authConfigured && !gateIdentityEnabled()) {
    if (databaseConfigured) {
      throw new Error(
        "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
          "refusing to fall back to the shared dev user against a real database.",
      );
    }
    return DEV_USER_ID;
  }
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}
