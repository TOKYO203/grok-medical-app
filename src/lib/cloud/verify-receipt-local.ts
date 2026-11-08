/**
 * Verification LOCALE d'un jeton de licence signe (Ed25519).
 *
 * Format : `OPT1.<payload_base64url>.<signature_base64url>`
 *   - payload  : JSON encode en base64url
 *   - signature : Ed25519 (64 octets) en base64url
 *
 * Le but : permettre a l'app de fonctionner OFFLINE quand le jeton est
 * deja en cache local et que son expiration n'est pas depassee. La cle
 * publique est exposee via VITE_LICENSE_PUBLIC_KEY (publique par nature,
 * aucun risque a l'exposer cote client).
 *
 * ⚠️ Ne remplace PAS la verification serveur. C'est un FALLBACK quand :
 *   - pas de reseau
 *   - serveur injoignable
 *   - timeout de /api/licenses/verify
 *
 * Si le jeton local est invalide (signature, expiration), on retourne
 * null et l'appelant DOIT fallback sur le serveur ou refuser l'acces.
 */

const TOKEN_PREFIX = "OPT1.";
const SIGNING_CONTEXT = "OPTIMUS-LICENSE-TOKEN-V1";

/**
 * Payload du jeton signe — aligne EXACTEMENT sur src/server/license-verify.ts.
 * Le serveur exige : v=1, tier="premium", licenseId non vide, exp en SECONDES.
 */
export type LocalLicensePayload = {
  /** Version du format (doit etre 1). */
  v: 1;
  /** Tier (doit etre "premium"). */
  tier: "premium";
  /** ID de licence (non vide). */
  licenseId: string;
  /** Epoch SECONDES (pas ms) d'expiration. */
  exp: number;
  /** Subject (user id). */
  sub?: string;
  /** Issued-at en SECONDES. */
  iat?: number;
};

function base64urlToBytes(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

/** Parse et decoupe le token sans verification. */
function splitToken(token: string): { payloadB64: string; sigB64: string } | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const rest = token.slice(TOKEN_PREFIX.length);
  const parts = rest.split(".");
  if (parts.length !== 2) return null;
  return { payloadB64: parts[0], sigB64: parts[1] };
}

/**
 * Recupere la cle publique Ed25519 (VITE_LICENSE_PUBLIC_KEY en priorite,
 * fallback VITE_LICENSE_SIGNING_PUBLIC_KEY, deja provisionnee pour les recus).
 * Garde contre import.meta.env undefined (Node pur, SSR sans Vite).
 */
function getPublicKeyValue(): string | null {
  // 1. import.meta.env (Vite, Cloudflare Pages, navigateur)
  const meta = (typeof import.meta !== "undefined" ? import.meta : undefined) as
    | { env?: Record<string, string | undefined> }
    | undefined;
  const viteEnv = meta?.env ?? {};

  // 2. process.env (Node, tests, SSR sans Vite)
  const procEnv = (typeof process !== "undefined" && process.env ? process.env : {}) as Record<
    string,
    string | undefined
  >;

  const raw =
    viteEnv.VITE_LICENSE_PUBLIC_KEY?.trim() ??
    viteEnv.VITE_LICENSE_SIGNING_PUBLIC_KEY?.trim() ??
    procEnv.VITE_LICENSE_PUBLIC_KEY?.trim() ??
    procEnv.VITE_LICENSE_SIGNING_PUBLIC_KEY?.trim();

  return raw && raw.length > 0 ? raw : null;
}

/** Decode une valeur (hex 64 ou base64url) en ArrayBuffer. */
function decodeKeyBytes(value: string): ArrayBuffer | null {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    const buffer = new ArrayBuffer(32);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < 32; i++) view[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return buffer;
  }
  try {
    return base64urlToBytes(value);
  } catch {
    return null;
  }
}

/** Verifie la signature Ed25519 (essaie raw puis spki, comme le serveur). */
async function verifySignature(payloadB64: string, sigB64: string): Promise<boolean> {
  const keyValue = getPublicKeyValue();
  if (!keyValue) {
    console.warn("[license-local] Cle publique absente (VITE_LICENSE_PUBLIC_KEY / VITE_LICENSE_SIGNING_PUBLIC_KEY) : verification locale desactivee");
    return false;
  }

  const bytes = decodeKeyBytes(keyValue);
  if (!bytes) {
    console.warn("[license-local] Cle publique invalide (ni hex ni base64url)");
    return false;
  }

  let key: CryptoKey | null = null;
  for (const format of ["raw", "spki"] as const) {
    try {
      key = await crypto.subtle.importKey(format, bytes, { name: "Ed25519" }, false, ["verify"]);
      break;
    } catch {
      // try next format
    }
  }
  if (!key) {
    console.warn("[license-local] Import cle publique echoue (raw + spki)");
    return false;
  }

  const message = new TextEncoder().encode(`${SIGNING_CONTEXT}\nOPT1.${payloadB64}`);
  try {
    return await crypto.subtle.verify("Ed25519", key, base64urlToBytes(sigB64), message);
  } catch {
    return false;
  }
}

/**
 * Verifie un jeton local : signature + expiration.
 * Retourne le payload si valide, null sinon.
 */
export async function verifyLocalLicenseToken(
  token: string,
  now = Date.now(),
  options: { allowExpiredMs?: number } = {},
): Promise<LocalLicensePayload | null> {
  const parts = splitToken(token);
  if (!parts) return null;

  if (!(await verifySignature(parts.payloadB64, parts.sigB64))) return null;

  let payload: LocalLicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts.payloadB64)));
  } catch {
    return null;
  }

  // Validation alignee sur le serveur (cf. verifySignedLicenseToken)
  if (payload.v !== 1) return null;
  if (payload.tier !== "premium") return null;
  if (typeof payload.licenseId !== "string" || payload.licenseId.length === 0) return null;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;

  // exp est en SECONDES : comparer en ms
  const expiresAtMs = payload.exp * 1000;
  const graceMs = options.allowExpiredMs ?? 0;
  if (expiresAtMs + graceMs <= now) return null;

  return payload;
}

/**
 * Extrait le payload SANS verifier la signature.
 * Utile pour logger ou debug (jamais pour une decision d'acces).
 */
export function peekLocalLicenseToken(token: string): LocalLicensePayload | null {
  const parts = splitToken(token);
  if (!parts) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64urlToBytes(parts.payloadB64)));
  } catch {
    return null;
  }
}
