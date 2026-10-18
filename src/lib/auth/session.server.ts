/**
 * Extraction du jeton de session côté SERVEUR.
 *
 * Le jeton vit dans `localStorage["optimus_session"]` (contrat produit), mais
 * `localStorage` n'existe pas pendant le rendu serveur. `setToken()` en écrit
 * donc AUSSI une copie dans un cookie `optimus_session` (SameSite=Lax) : c'est
 * ce cookie qui permet au SSR de rendre la fiche complète dès le premier
 * octet, sans écran « Premium requis » qui clignote avant l'hydratation.
 *
 * ⚠️ Ce module ne lit que des en-têtes : il ne contient aucun secret et peut
 * être importé par du code isomorphe. Le cookie n'est PAS HttpOnly (le client
 * doit pouvoir le poser/l'effacer) : il ne porte qu'un jeton de 24 h, révocable
 * par expiration, et n'ouvre aucun droit d'écriture.
 */

export const SESSION_COOKIE_NAME = "optimus_session";

/** `Bearer <jeton>` (casse tolérée sur le préfixe, comme le veut la RFC 6750). */
export function bearerTokenFromHeaders(headers: Headers | null | undefined): string | null {
  const value = headers?.get("authorization")?.trim();
  if (!value) return null;
  const match = /^bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(value);
  return match?.[1] ?? null;
}

/** Valeur d'un cookie, sans dépendance (parseur volontairement minimal). */
export function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Jeton présenté par la requête : en-tête `Authorization` prioritaire
 * (contrat des appels `fetch`), puis cookie (rendu serveur).
 */
export function tokenFromRequest(request: Request | null | undefined): string | null {
  if (!request) return null;
  return (
    bearerTokenFromHeaders(request.headers) ??
    cookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME)
  );
}
