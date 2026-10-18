/**
 * ANTI-REPLAY des demandes de jeton (`POST /api/licenses/verify`).
 *
 * Chaque demande porte un nonce à usage unique (`X-Nonce`). Sans ce garde, une
 * requête capturée (proxy, journal, poste partagé) pourrait être rejouée
 * indéfiniment pour récupérer un nouveau JWT toutes les 24 h.
 *
 * DEUX BACKENDS, UNE SEULE DOCTRINE :
 *   • Upstash Redis (REST) si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *     sont configurés : `SET nonce:… 1 NX EX 300` est ATOMIQUE, donc deux
 *     rejeux simultanés ne peuvent pas réussir tous les deux ;
 *   • sinon cache mémoire par instance (dev, auto-hébergement mono-instance).
 *     Suffisant pour un déploiement à une instance, insuffisant en multi-région
 *     — c'est documenté dans docs/SECURITY-PREMIUM.md.
 *
 * ⚠️ FAIL CLOSED : si le backend configuré répond mal ou tombe, la demande est
 * refusée (`unavailable` → 503). Accepter « au cas où » transformerait une
 * panne de Redis en fenêtre de rejeu illimitée.
 */

/** Durée de rétention d'un nonce : au-delà, la fenêtre de rejeu est couverte. */
export const NONCE_TTL_MS = 5 * 60 * 1000;
const NONCE_TTL_SECONDS = NONCE_TTL_MS / 1000;

/** Forme acceptée : base64url / hexadécimal, 16 à 64 caractères. */
export const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Borne mémoire : un nonce oublié ne doit pas devenir un vecteur d'OOM. */
const MAX_MEMORY_ENTRIES = 50_000;

export type NonceVerdict = "fresh" | "replayed" | "unavailable";

const memory = new Map<string, number>();

type UpstashConfig = { url: string; token: string };

function upstashConfig(): UpstashConfig | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if (!url || !token) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, token };
}

/** Une seule décision par nonce, atomique côté Redis. */
async function consumeInRedis(
  config: UpstashConfig,
  nonce: string,
): Promise<NonceVerdict> {
  const key = encodeURIComponent(`nonce:${nonce}`);
  try {
    const response = await fetch(
      `${config.url}/set/${key}/1?NX&EX=${NONCE_TTL_SECONDS}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${config.token}` },
        // Un anti-replay ne doit jamais être servi par un cache HTTP.
        cache: "no-store",
      },
    );
    if (!response.ok) return "unavailable";
    const payload = (await response.json()) as { result?: unknown; error?: unknown };
    if (payload.error) return "unavailable";
    // `SET … NX` renvoie "OK" quand la clé a été créée, `null` si elle existait.
    return payload.result === "OK" ? "fresh" : "replayed";
  } catch {
    return "unavailable";
  }
}

function consumeInMemory(nonce: string, now: number): NonceVerdict {
  // Purge paresseuse : on ne balaie que si la table grossit.
  if (memory.size >= MAX_MEMORY_ENTRIES) {
    for (const [key, expiresAt] of memory) {
      if (expiresAt <= now) memory.delete(key);
    }
    if (memory.size >= MAX_MEMORY_ENTRIES) return "unavailable";
  }

  const expiresAt = memory.get(nonce);
  if (expiresAt !== undefined && expiresAt > now) return "replayed";

  memory.set(nonce, now + NONCE_TTL_MS);
  return "fresh";
}

/**
 * Consomme un nonce.
 * @returns `fresh` (première vue), `replayed` (déjà utilisé) ou `unavailable`.
 */
export async function consumeNonce(nonce: string, now = Date.now()): Promise<NonceVerdict> {
  if (!NONCE_PATTERN.test(nonce)) return "unavailable";
  const config = upstashConfig();
  if (config) return consumeInRedis(config, nonce);
  return consumeInMemory(nonce, now);
}

/** Remise à zéro (tests uniquement — jamais appelé par le code applicatif). */
export function resetNonceStore(): void {
  memory.clear();
}
