import type { CloudAuthStatus } from "@/lib/cloud/session";

/**
 * Politique d'accès du gate d'authentification — module PUR (aucun import
 * runtime), donc testable sous Node et utilisable côté SSR comme côté client.
 *
 * La décision doit être IDENTIQUE au rendu serveur et au premier rendu client,
 * sinon React signale un mismatch d'hydratation. Elle ne dépend donc que de
 * valeurs déjà connues des deux côtés : le chemin demandé et un instantané
 * déterministe de la session.
 */

/**
 * Surfaces PUBLIQUES : marketing, achat, légal et connexion.
 *
 * Pourquoi ne pas tout verrouiller : `/tarifs` doit rester consultable (et
 * indexable) pour qu'un visiteur puisse acheter AVANT d'avoir un compte, et
 * les pages légales doivent rester accessibles sans session. Vider ce tableau
 * transforme le gate en mur complet — c'est un choix produit, pas technique.
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/tarifs",
  "/a-propos",
  "/changelog",
  "/contact",
  "/institutionnel",
  "/soutenir",
  "/conditions",
  "/confidentialite",
  "/conseil-editorial",
  "/validation-clinique",
];

export type CloudGateMode = "public" | "splash" | "locked" | "app";

/** Chemin normalisé : sans query, sans hash, sans slash final, en minuscules. */
export function normalizePathname(pathname: string | undefined | null): string {
  if (!pathname) return "/";
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "/";
  const trimmed = withoutQuery.replace(/\/+$/, "");
  const lowered = (trimmed || "/").toLowerCase();
  return lowered.startsWith("/") ? lowered : `/${lowered}`;
}

export function isPublicPath(pathname: string | undefined | null): boolean {
  const path = normalizePathname(pathname);
  return PUBLIC_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
}

export type CloudGateInput = {
  /** Faux quand les variables Supabase sont absentes : on ne verrouille rien. */
  configured: boolean;
  status: CloudAuthStatus;
  pathname: string | null | undefined;
};

/**
 * - `public` : la route s'affiche sans session (aucun voile) ;
 * - `splash` : session en cours de résolution (borne : 2 s) ;
 * - `locked` : pas de session -> écran de connexion ;
 * - `app`    : application (session active, cloud non configuré, ou cloud
 *              momentanément injoignable).
 *
 * On ne verrouille QUE sur une réponse explicite (« aucune session »). Une
 * absence de réponse (`unavailable` : chunk du SDK non téléchargé hors-ligne,
 * requête expirée) laisse passer en mode local : le contenu déjà en cache et la
 * progression locale restent utilisables, et une session retrouvée plus tard
 * rebascule l'écran sans navigation. Le verrou est de toute façon une commodité
 * d'interface, pas une frontière de sécurité — les données sont protégées par
 * les policies RLS et le contenu par le jeton S1.
 */
export function resolveCloudGate({ configured, status, pathname }: CloudGateInput): CloudGateMode {
  if (!configured) return "app";
  if (isPublicPath(pathname)) return "public";
  if (status === "loading" || status === "unconfigured") return "splash";
  if (status === "anonymous") return "locked";
  return "app";
}
