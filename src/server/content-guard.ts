import { getRequest } from "@tanstack/react-start/server";
import { tokenFromRequest } from "@/lib/auth/session.server";
import { verifyContentToken, type ContentTokenClaims } from "./jwt";

/**
 * GARDE D'ACCÈS AU CONTENU PREMIUM — serveur uniquement.
 *
 * Un seul point de décision, utilisé par :
 *   • la route `/content/$type/$file` (ce que le navigateur appelle) ;
 *   • les lecteurs `.server.ts` des catalogues (SSR et fonctions serveur), pour
 *     qu'aucun autre chemin ne puisse servir le contenu sans jeton. C'est le
 *     point critique : `createServerFn` expose un endpoint HTTP public, donc un
 *     lecteur « interne » non gardé serait une porte dérobée équivalente au CDN.
 *
 * Un jeton valide n'est PAS un droit d'écriture : il n'autorise que la lecture
 * du contenu verrouillé, et il expire au bout de 24 h.
 */

export type ContentAuth =
  | { ok: true; claims: ContentTokenClaims }
  | { ok: false; reason: "missing" | "invalid" | "unconfigured" };

/** Statut HTTP associé : 401 pour un jeton absent/invalide, 503 si non configuré. */
export function statusForAuth(auth: ContentAuth): number {
  if (auth.ok) return 200;
  return auth.reason === "unconfigured" ? 503 : 401;
}

export async function authenticate(request: Request | null | undefined): Promise<ContentAuth> {
  const token = tokenFromRequest(request);

  if (!token) {
    // Distinguer « pas de jeton » de « secret absent » évite de répondre 401 à
    // un déploiement mal configuré : l'exploitant verrait des clients
    // « non autorisés » alors que rien ne pourrait jamais autoriser.
    return { ok: false, reason: contentSecretConfigured() ? "missing" : "unconfigured" };
  }

  const claims = await verifyContentToken(token);
  return claims ? { ok: true, claims } : { ok: false, reason: "invalid" };
}

/** Le secret HMAC est-il présent ? (le détail reste dans `jwt.ts`) */
function contentSecretConfigured(): boolean {
  return (process.env.LICENSE_JWT_SECRET ?? "").trim().length >= 32;
}

/**
 * Authentifie la requête HTTP COURANTE (contexte TanStack Start : rendu serveur
 * d'un loader, fonction serveur, handler de route).
 */
export async function authenticateCurrentRequest(): Promise<ContentAuth> {
  let request: Request | null = null;
  try {
    request = getRequest();
  } catch {
    // Aucun contexte de requête (script, test, pré-rendu) : par défaut, pas
    // d'accès. Le contenu protégé ne se lit jamais « hors requête ».
    request = null;
  }
  return authenticate(request);
}

/** Réponse 401 normalisée (jamais de détail sur la cause). */
export function unauthorizedResponse(): Response {
  return jsonResponse({ error: "unauthorized" }, 401);
}

export function contentUnavailableResponse(): Response {
  return jsonResponse({ error: "content_protection_unavailable" }, 503);
}

/**
 * Réponse JSON du contenu protégé.
 *
 * ⚠️ `Cache-Control: private` + `Vary: Authorization` sont OBLIGATOIRES : sans
 * eux, un CDN ou un cache intermédiaire pourrait resservir le 200 d'un client
 * autorisé à un visiteur anonyme — le défaut exact que ce chantier corrige.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=60" : "no-store",
      Vary: "Authorization, Cookie",
      // Le contenu est du JSON : jamais interprété comme du HTML si un
      // navigateur l'ouvre directement.
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
