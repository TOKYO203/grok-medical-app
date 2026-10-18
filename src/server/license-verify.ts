import { createHash } from "node:crypto";

/**
 * VÉRIFICATION D'UNE LICENCE — serveur uniquement.
 *
 * Deux familles de clés sont acceptées, dans cet ordre :
 *
 * 1. **Jeton de licence signé** — `OPT1.<charge>.<signature>`
 *    Émis hors ligne avec la clé PRIVÉE Ed25519 du propriétaire
 *    (`scripts/issue-license-token.mjs`, clé hors dépôt dans `~/.optimus-keys/`).
 *    Vérifié ici avec la SEULE clé publique (`LICENSE_PUBLIC_KEY`). C'est la
 *    forme recommandée : auto-porteuse, révocable par expiration, aucun accès
 *    base de données, donc aucun point de panne.
 *
 * 2. **Clé d'activation** `OPT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` — le parcours
 *    commercial existant (`POST /api/licenses/activate` + table
 *    `activation_keys`). On ne peut pas l'ignorer : les clients déjà vendus
 *    possèdent cette forme. La clé n'est jamais stockée en clair, on compare un
 *    SHA-256 et on exige que l'appareil corresponde à celui qui l'a activée —
 *    sinon une clé volée suffirait à fabriquer des jetons sur n'importe quel
 *    poste.
 *
 * ⚠️ Aucune clé privée n'est lue ici, jamais. La clé privée ne quitte pas
 * `~/.optimus-keys/` (hors dépôt) ni l'environnement serveur du propriétaire.
 */

/** Forme de la clé d'activation historique (identique à `/api/licenses/activate`). */
const ACTIVATION_KEY_PATTERN = /^OPT-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/;

/** Préfixe du jeton de licence signé. */
export const LICENSE_TOKEN_PREFIX = "OPT1.";

/** Domaine de signature : sépare ce jeton des reçus d'activation (v1). */
const TOKEN_SIGNING_CONTEXT = "OPTIMUS-LICENSE-TOKEN-V1";

/** Une clé d'activation est un identifiant opaque : 12 hex comme le profil. */
const DEVICE_ID_PATTERN = /^[a-f0-9]{12}$/i;

const MAX_KEY_LENGTH = 4096;
const MAX_LICENSE_ID_LENGTH = 128;

export type LicenseCheck =
  | { ok: true; licenseId: string; expiresAt: number | null; source: "signed" | "activation" }
  | { ok: false; reason: "invalid" | "unavailable" };

type SignedTokenPayload = {
  v?: unknown;
  licenseId?: unknown;
  tier?: unknown;
  exp?: unknown;
};

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  if (/[^A-Za-z0-9+/=]/.test(normalized)) return null;
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function fromHex(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Clé publique Ed25519 du propriétaire.
 * `LICENSE_PUBLIC_KEY` est la variable de référence ; on retombe sur
 * `VITE_LICENSE_SIGNING_PUBLIC_KEY` (même paire, déjà provisionnée pour la
 * vérification des reçus côté navigateur) pour ne pas dupliquer un secret
 * d'exploitation. Les deux sont des clés PUBLIQUES.
 */
export function licensePublicKeyValue(): string {
  return (
    process.env.LICENSE_PUBLIC_KEY ?? process.env.VITE_LICENSE_SIGNING_PUBLIC_KEY ?? ""
  ).trim();
}

async function importLicensePublicKey(): Promise<CryptoKey | null> {
  const value = licensePublicKeyValue();
  if (!value) return null;

  const bytes = /^[0-9a-f]{64}$/i.test(value) ? fromHex(value) : fromBase64Url(value);
  if (!bytes) return null;

  // 32 octets = clé brute (forme utilisée par le dépôt). Sinon on tente le DER
  // SPKI, ce qui accepte aussi une clé exportée par `openssl`.
  for (const format of ["raw", "spki"] as const) {
    try {
      return await crypto.subtle.importKey(format, bytes, { name: "Ed25519" }, false, [
        "verify",
      ]);
    } catch {
      // format suivant
    }
  }
  return null;
}

function parseSignedPayload(segment: string): SignedTokenPayload | null {
  const bytes = fromBase64Url(segment);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (parsed === null || typeof parsed !== "object") return null;
    return parsed as SignedTokenPayload;
  } catch {
    return null;
  }
}

/** Vérifie un jeton `OPT1.<charge>.<signature>` avec la clé PUBLIQUE seule. */
async function verifySignedLicenseToken(
  raw: string,
  now: number,
): Promise<LicenseCheck> {
  const segments = raw.split(".");
  if (segments.length !== 3) return { ok: false, reason: "invalid" };
  const [, payloadSegment, signatureSegment] = segments;

  const payload = parseSignedPayload(payloadSegment);
  if (!payload) return { ok: false, reason: "invalid" };

  const licenseId = typeof payload.licenseId === "string" ? payload.licenseId.trim() : "";
  if (
    payload.v !== 1 ||
    payload.tier !== "premium" ||
    !licenseId ||
    licenseId.length > MAX_LICENSE_ID_LENGTH
  ) {
    return { ok: false, reason: "invalid" };
  }

  let expiresAt: number | null = null;
  if (payload.exp !== undefined && payload.exp !== null) {
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return { ok: false, reason: "invalid" };
    }
    expiresAt = payload.exp * 1000;
    if (expiresAt <= now) return { ok: false, reason: "invalid" };
  }

  const key = await importLicensePublicKey();
  // Clé publique absente = configuration incomplète : on refuse sans dire
  // pourquoi au client (message générique côté route), mais on le distingue
  // ici pour que l'exploitant trouve la cause dans les journaux.
  if (!key) return { ok: false, reason: "unavailable" };

  const signature = fromBase64Url(signatureSegment);
  if (!signature) return { ok: false, reason: "invalid" };

  // Message signé = contexte + `OPT1.<charge>` (exactement les octets reçus,
  // signature exclue) : aucune re-sérialisation JSON, donc aucun risque de
  // divergence d'ordre de clés entre l'émetteur et le vérificateur.
  const message = new TextEncoder().encode(
    `${TOKEN_SIGNING_CONTEXT}\n${segments[0]}.${segments[1]}`,
  );
  try {
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
    if (!valid) return { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, licenseId, expiresAt, source: "signed" };
}

type ActivationRow = {
  id: string;
  expires_at: string | Date | null;
  device_id: string | null;
};

/** Vérifie une clé d'activation contre `activation_keys` (jamais en clair). */
async function verifyActivationKey(
  key: string,
  deviceId: string | null,
  now: number,
): Promise<LicenseCheck> {
  // Une clé non encore activée ne peut pas produire de jeton : l'activation est
  // ce qui lie la clé à un appareil. Exiger `deviceId` ferme la porte à
  // l'utilisation d'une clé volée depuis n'importe quel poste.
  if (!deviceId || !DEVICE_ID_PATTERN.test(deviceId)) return { ok: false, reason: "invalid" };

  const keyHash = createHash("sha256").update(key, "utf8").digest("hex");

  let row: ActivationRow | undefined;
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<ActivationRow>(
      `select id, expires_at, device_id
         from activation_keys
        where key_hash = $1
          and revoked_at is null
          and (expires_at is null or expires_at > now())`,
      [keyHash],
    );
    row = rows[0];
  } catch (error) {
    console.warn("[licenses/verify] DB error:", (error as Error).message);
    return { ok: false, reason: "unavailable" };
  }

  if (!row) return { ok: false, reason: "invalid" };
  if (!row.device_id || row.device_id.toLowerCase() !== deviceId.toLowerCase()) {
    return { ok: false, reason: "invalid" };
  }

  const expiresAt = row.expires_at === null ? null : new Date(row.expires_at).getTime();
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, licenseId: row.id, expiresAt, source: "activation" };
}

/**
 * Point d'entrée : vérifie une clé de licence (deux formes) et rend
 * l'identifiant de licence à placer dans le JWT.
 */
export async function verifyLicenseKey(
  rawKey: string,
  options: { deviceId?: string | null; now?: number } = {},
): Promise<LicenseCheck> {
  const now = options.now ?? Date.now();
  const trimmed = String(rawKey ?? "").trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return { ok: false, reason: "invalid" };

  // Jeton signé : la charge est sensible à la casse (base64url), on ne
  // normalise donc SURTOUT pas.
  if (trimmed.startsWith(LICENSE_TOKEN_PREFIX)) {
    return verifySignedLicenseToken(trimmed, now);
  }

  // Clé d'activation : insensible à la casse et aux espaces (saisie humaine).
  const normalized = trimmed.toUpperCase().replace(/\s+/g, "");
  if (!ACTIVATION_KEY_PATTERN.test(normalized)) return { ok: false, reason: "invalid" };

  return verifyActivationKey(normalized, options.deviceId ?? null, now);
}
