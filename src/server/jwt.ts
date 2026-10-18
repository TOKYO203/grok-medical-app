import { SignJWT, jwtVerify } from "jose";

/**
 * JWT de session « contenu Premium » — SERVEUR UNIQUEMENT.
 *
 * Un utilisateur qui possède une licence valide échange sa clé contre un JWT de
 * 24 h (`POST /api/licenses/verify`). Ce jeton est ensuite présenté à chaque
 * lecture de `/content/pathologies/**` et `/content/signes/**`.
 *
 * Choix d'algorithme : **HS256** (HMAC) et non Ed25519. Raison : la clé de
 * signature reste côté serveur et ne sert QU'À signer des sessions éphémères ;
 * il n'y a aucune raison d'en distribuer la moitié publique, ni de dépendre
 * d'une paire de clés supplémentaire à provisionner. La vérification Ed25519
 * reste utilisée là où elle a du sens : la CLÉ DE LICENCE elle-même (émise
 * hors ligne avec la clé privée du propriétaire, vérifiée avec la seule clé
 * publique — voir `src/server/license-verify.ts`).
 *
 * ⚠️ `LICENSE_JWT_SECRET` n'a AUCUNE valeur par défaut : sans secret (ou avec
 * un secret de moins de 32 caractères) la signature et la vérification
 * échouent volontairement (fail closed). Un secret par défaut committé
 * reviendrait à publier un laissez-passer universel.
 */

/** Durée de vie d'un jeton de contenu (le client redemande la clé après). */
export const CONTENT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** Longueur minimale acceptée pour le secret HMAC (256 bits en base64 ≈ 43). */
export const MIN_SECRET_LENGTH = 32;

const ISSUER = "optimus-medical";
const AUDIENCE = "optimus-content";

export type ContentTokenClaims = {
  licenseId: string;
  tier: "premium";
  issuedAt: number;
  expiresAt: number;
};

/** Secret HMAC, ou `null` si absent/trop court (⇒ service indisponible). */
export function contentJwtSecret(): Uint8Array | null {
  const secret = (process.env.LICENSE_JWT_SECRET ?? "").trim();
  if (secret.length < MIN_SECRET_LENGTH) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Signe un jeton de contenu.
 * @returns `null` si le secret serveur n'est pas configuré.
 */
export async function signContentToken(
  licenseId: string,
  now = Date.now(),
): Promise<{ token: string; expiresAt: number } | null> {
  const secret = contentJwtSecret();
  if (!secret || !licenseId) return null;

  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + CONTENT_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({ tier: "premium", licenseId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(licenseId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { token, expiresAt: expiresAt * 1000 };
}

/**
 * Vérifie signature, émetteur, audience et expiration.
 * @returns les claims, ou `null` (jamais d'exception).
 */
export async function verifyContentToken(
  token: string | null | undefined,
  now = Date.now(),
): Promise<ContentTokenClaims | null> {
  const secret = contentJwtSecret();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: new Date(now),
    });

    const licenseId = typeof payload.licenseId === "string" ? payload.licenseId : payload.sub;
    if (typeof licenseId !== "string" || licenseId.length === 0) return null;
    if (payload.tier !== "premium") return null;
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;

    return {
      licenseId,
      tier: "premium",
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    // Signature invalide, jeton expiré, mauvais algorithme (`alg: none`
    // inclus) : un seul chemin de sortie, jamais d'exception qui remonterait
    // en 500 et distinguerait les causes pour un attaquant.
    return null;
  }
}
