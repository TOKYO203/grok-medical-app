import { useAuth } from "@/hooks/useAuth";
import type { AppUser } from "@/lib/auth/use-current-user";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * QUI EST L'UTILISATEUR — une seule réponse pour toute l'application.
 *
 * POURQUOI CE HOOK
 * L'application comportait deux fournisseurs d'identité concurrents : Supabase
 * (porte d'entrée, contenu, synchronisation) et Better Auth (tunnel Mobile
 * Money, export de compte). Selon la page, « connecté » ne voulait donc pas dire
 * la même chose : un utilisateur authentifié par Supabase voyait
 * « Connexion requise pour un achat Premium » sur `/pro` — la fameuse double
 * authentification.
 *
 * Ce hook est désormais la SEULE source de vérité pour « qui est connecté ».
 * Sa règle est volontairement pauvre, donc prévisible :
 *
 *   - Supabase CONFIGURÉ (toujours vrai en production) : la session Supabase est
 *     l'unique identité. Better Auth n'est même pas interrogé (son hook renvoie
 *     immédiatement, cf. `use-current-user.ts`) — plus de requête vers
 *     `/api/auth/get-session`, donc plus de 500 en console ;
 *   - Supabase ABSENT (build purement local, déploiement historique) : repli sur
 *     Better Auth, avec `isDevFallback` pour que les écrans d'achat sachent
 *     qu'aucune identité réelle n'existe.
 *
 * `isPending` n'est vrai QUE pendant la résolution de session. Un `null` définitif
 * signifie « pas de session », et non « peut-être encore en train de charger » —
 * sans quoi chaque rechargement ferait clignoter les écrans d'achat.
 */
export type AppUserState = {
  /** L'utilisateur, ou `null` si personne n'est connecté. */
  user: AppUser | null;
  /** True tant que la session n'est pas résolue — ne pas conclure trop vite. */
  isPending: boolean;
  /** D'où vient l'identité — utile aux diagnostics et aux tests. */
  source: "supabase" | "better-auth" | "none";
  /** Supabase est-il configuré sur ce déploiement ? */
  cloudConfigured: boolean;
};

type SupabaseLikeUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Nom affichable : métadonnées OAuth si présentes, sinon la partie locale de l'email. */
export function displayNameFrom(user: SupabaseLikeUser): string | null {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.full_name, metadata.name, metadata.display_name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  const email = (user.email ?? "").trim();
  if (!email) return null;
  // « jean.rakoto@… » -> « Jean Rakoto » : on n'affiche jamais une adresse brute
  // là où le produit attend un prénom.
  const local = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  if (!local) return null;
  return local
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function avatarFrom(user: SupabaseLikeUser): string | null {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.avatar_url, metadata.picture];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function useAppUser(): AppUserState {
  /**
   * Les deux sources sont instanciées à CHAQUE rendu (ordre des hooks stable).
   * `useCurrentUserState` renvoie immédiatement quand Supabase est configuré,
   * donc ce n'est ni une requête ni un coût de rendu.
   */
  const cloud = useAuth();
  const legacy = useCurrentUserState();

  if (!isSupabaseConfigured) {
    return {
      user: legacy.user,
      isPending: legacy.isPending,
      source: legacy.user ? "better-auth" : "none",
      cloudConfigured: false,
    };
  }

  const supabaseUser = cloud.session?.user as SupabaseLikeUser | undefined;
  if (supabaseUser) {
    return {
      user: {
        id: supabaseUser.id,
        displayName: displayNameFrom(supabaseUser),
        primaryEmail: supabaseUser.email ?? null,
        profileImageUrl: avatarFrom(supabaseUser),
        isDevFallback: false,
      },
      isPending: false,
      source: "supabase",
      cloudConfigured: true,
    };
  }

  return {
    user: null,
    // « unavailable » (SDK injoignable hors-ligne) n'est PAS « en cours de
    // chargement » : attendre indéfiniment bloquerait les écrans d'achat.
    isPending: cloud.status === "loading",
    source: "none",
    cloudConfigured: true,
  };
}
