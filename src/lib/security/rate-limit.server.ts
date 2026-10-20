import { clientIpSubject } from "./client-ip.server.ts";

/**
 * Limitation de débit des handlers de route.
 *
 * Deux implémentations, un seul contrat (`RateLimitResult`) :
 *
 *  1. **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
 *     quand les variables existent — le compteur est PARTAGÉ entre instances,
 *     donc la limite annoncée tient réellement en production multi-région.
 *     Sans ce backend, chaque isolate (Cloudflare Workers) ou chaque instance
 *     (Vercel) comptait séparément : « 10 vérifications de licence par heure »
 *     devenait « 10 par isolate et par heure », soit un quota effectif bien
 *     supérieur à celui écrit dans la documentation.
 *  2. **Repli en mémoire** sinon (dev local, ou panne Upstash) : fenêtre fixe
 *     BORNÉE, pour que le limiteur ne devienne jamais un vecteur d'épuisement
 *     mémoire (un sujet forgé par requête ne doit pas faire grossir la Map).
 *
 * Dans les deux cas le SUJET n'est pas choisi par l'attaquant : `clientIpSubject`
 * ne croit que les en-têtes possédés par la plateforme (ou `TRUST_PROXY_HEADERS=true`).
 *
 * ⚠️ Aucune dépendance : Upstash est appelé en REST (même doctrine que
 * `src/server/replay-guard.ts`). Ajouter `@upstash/redis` + `@upstash/ratelimit`
 * aurait pesé sur le budget de bundle pour deux commandes Redis.
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

// --- 1. UPSTASH (production, compteur partagé) -------------------------------

type UpstashConfig = { url: string; token: string };

/** Configuration lue À CHAQUE appel : testable, et une rotation d'env s'applique. */
function upstashConfig(): UpstashConfig | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if (!url || !token) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, token };
}

/** Préfixe commun : isole nos clés de compteur du reste de la base Redis. */
const KEY_PREFIX = "optimus:ratelimit:";

/**
 * Une seule requête HTTP pour compter, poser la fenêtre et lire le temps restant.
 *
 * `INCR` puis `PEXPIRE … NX` : l'expiration n'est posée que sur la PREMIÈRE
 * incrémentation de la fenêtre (`NX`), sinon chaque appel repousserait la fin de
 * fenêtre et créerait un compteur glissant perpétuel — un client régulier ne
 * serait alors jamais réinitialisé.
 *
 * `PTTL` sert uniquement à renvoyer un `Retry-After` honnête. Il est dans le
 * même pipeline, donc sans aller-retour supplémentaire.
 */
async function hitUpstash(
  config: UpstashConfig,
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const redisKey = `${KEY_PREFIX}${key}`;
  const window = Math.max(1, Math.ceil(windowMs));
  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, window, "NX"],
        ["PTTL", redisKey],
      ]),
      // Un compteur de sécurité ne doit jamais être servi par un cache HTTP.
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length < 3) return null;

    const entries = payload as Array<{ result?: unknown; error?: unknown } | null>;
    if (entries.some((entry) => entry && typeof entry === "object" && entry.error)) return null;

    const count = Number(entries[0]?.result);
    if (!Number.isFinite(count)) return null;

    const ttl = Number(entries[2]?.result);
    const remainingTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : window;

    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      resetAt: Date.now() + remainingTtl,
    };
  } catch {
    // Réseau, DNS, TLS, JSON invalide : on retombe sur le seau mémoire local.
    return null;
  }
}

// --- 2. REPLI EN MÉMOIRE (dev local / Upstash indisponible) ------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQ = 20;
const MAX_BUCKETS = 10_000;

/** Drop expired buckets, then evict oldest-first (Map preserves insertion order). */
function evict(now: number, incoming: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size + incoming > MAX_BUCKETS && buckets.size > 0) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

function rateLimitMemory(key: string, max = MAX_REQ, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    evict(now, 1);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (b.count >= max) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: max - b.count, resetAt: b.resetAt };
}

// --- 3. API EXPOSÉE ----------------------------------------------------------

/**
 * Limiteur SYNCHRONE (mémoire uniquement).
 *
 * Réservé aux contextes qui n'ont pas d'objet `Request` à portée — les server
 * functions d'administration (`admin-auth.server.ts`) construisent leur sujet
 * depuis `getRequest().headers`. Les handlers de route doivent préférer
 * `rateLimitRequest`, seul à bénéficier du compteur partagé.
 */
export function rateLimit(key: string, max = MAX_REQ, windowMs = WINDOW_MS): RateLimitResult {
  return rateLimitMemory(key, max, windowMs);
}

/**
 * Limiteur ASYNCHRONE des handlers de route : Upstash si configuré, repli
 * mémoire sinon.
 *
 * Une panne Upstash ne doit pas couper le service (les routes concernées
 * incluent la lecture de contenu et le proxy IA) : on journalise et on retombe
 * sur le seau mémoire local, qui reste une limite réelle — seulement par
 * instance. Aucune requête n'est donc laissée sans plafond.
 */
export async function rateLimitRequest(
  request: Request,
  scope: string,
  max = MAX_REQ,
  windowMs = WINDOW_MS,
): Promise<RateLimitResult> {
  const subject = clientIpSubject(request.headers);
  const key = `${scope}:${subject}`;

  const config = upstashConfig();
  if (config) {
    const shared = await hitUpstash(config, key, max, windowMs);
    if (shared) return shared;
    console.warn("⚠️ Limiteur partagé (Upstash) indisponible — bascule sur le seau mémoire local.");
  }

  return rateLimitMemory(key, max, windowMs);
}

export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
