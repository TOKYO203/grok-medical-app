import { isSupabaseConfigured } from "@/lib/supabase";
import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is disabled
 * (`VITE_AUTH_ENABLED=false`, the shipped default). With auth on, the sandbox
 * live preview does real sign-in via the baked preview client. Its id is
 * `"dev-user"` — the SAME id `verify.server.ts` returns server-side — so per-user
 * rows written in that mode belong to one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state.
 *
 * ⚠️ AMORÇAGE — CE HOOK N'EST PLUS LE POINT D'ENTRÉE DES ÉCRANS.
 * Utilisez `useAppUser()` (`@/hooks/useAppUser`), qui fait autorité sur « qui est
 * connecté » en combinant Supabase et ce repli. Ce hook ne répond plus que pour
 * l'ancien système, et il est **court-circuité dès que Supabase est configuré** :
 *   - Supabase configuré (toujours vrai en production) → `{ user: null }`
 *     immédiatement. Sans ce garde, chaque page déclenchait un appel à
 *     `/api/auth/get-session`, qui répond 500 sur le déploiement (runtime sans
 *     base Better Auth) — une erreur console par navigation, pour rien.
 *   - Auth désactivée (`VITE_AUTH_ENABLED=false`) → `DEV_USER`, jamais pending.
 *   - Sinon → Better Auth `useSession()` (cookie déployé ; jeton en prévisualisation).
 *
 * `authEnabled` et `isSupabaseConfigured` sont des constantes figées au
 * chargement du module, donc l'ordre des hooks reste stable d'un rendu à
 * l'autre (même garantie que le garde historique sur `authEnabled`).
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  if (isSupabaseConfigured) return { user: null, isPending: false };
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  return {
    user: user
      ? {
          id: user.id,
          displayName: user.name ?? null,
          primaryEmail: user.email ?? null,
          profileImageUrl: user.image ?? null,
          isDevFallback: false,
        }
      : null,
    isPending,
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display (e.g.
 * `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
 * for redirects/guards use `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
