import { createFileRoute } from "@tanstack/react-router";
import { dbSource, getSql } from "@/lib/db";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import {
  mergedServerEnv,
  readServerSupabaseConfig,
  resolveSupabaseServiceKey,
} from "@/server/supabase-env.server";
import { isLemonCheckoutConfigured, readLemonCheckoutConfig } from "@/content/international";

/**
 * `GET /api/health/checkout` — « ce DÉPLOIEMENT peut-il encaisser ? »
 *
 * POURQUOI CETTE ROUTE EXISTE
 * Le 2026-10-22, le bouton « Payer par Carte » répondait 503 en production alors
 * que tout était vert localement : les variables existaient dans `.env.production`
 * (donc dans le bundle) mais **pas** dans l'environnement d'exécution du worker.
 * Aucun outil ne pouvait le voir depuis l'extérieur — `payment:readiness` lit le
 * poste de développement, `assert-supabase-build` lit l'artefact publié, et
 * personne ne lit l'environnement RÉEL d'exécution. Un `curl` sur cette route
 * répond désormais à la question en une seconde.
 *
 * CE QUE LA ROUTE NE DIT JAMAIS
 * Aucune valeur : ni URL, ni clé, ni identifiant de projet. Uniquement des
 * booléens et une source de base (`postgres` / `pglite`). C'est suffisant pour
 * diagnostiquer, inutile pour un attaquant.
 *
 * Réponses :
 *   200 dans tous les cas — `ready: false` décrit une configuration incomplète,
 *       ce n'est pas une erreur HTTP (un moniteur doit pouvoir la lire).
 *   429 quota dépassé.
 */

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Une base injoignable ne doit pas laisser la route pendue. */
const DB_PROBE_TIMEOUT_MS = 4_000;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
      ...extra,
    },
  });
}

/** `select 1` borné : la seule façon honnête de dire « la base répond ». */
async function probeDatabase(): Promise<{ reachable: boolean | null; reason?: string }> {
  // Avec PGLite (aucune `DATABASE_URL`), la base est un WASM local : sur un
  // worker Cloudflare elle ne peut pas démarrer. On ne tente donc PAS la requête
  // (elle ferait échouer le handler) — la source dit déjà tout.
  if (dbSource !== "postgres") return { reachable: null, reason: "embedded-pglite" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const sql = await getSql();
    const query = sql.query<{ ok: number }>("select 1 as ok");
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), DB_PROBE_TIMEOUT_MS);
    });
    await Promise.race([query, timeout]);
    return { reachable: true };
  } catch {
    // Le détail (message du driver, code SQLSTATE) reste dans les journaux du
    // serveur : il peut contenir un hôte, un utilisateur ou un nom de base.
    return { reachable: false, reason: "query-failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/health/checkout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const decision = await rateLimitRequest(
          request,
          "health-checkout",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        const env = mergedServerEnv();
        const supabase = readServerSupabaseConfig(env);
        const serviceKey = resolveSupabaseServiceKey(env);
        const lemon = readLemonCheckoutConfig(env);
        const database = await probeDatabase();

        const report = {
          ready: Boolean(supabase) && Boolean(serviceKey) && database.reachable === true,
          supabase: {
            /** URL + clé publique résolues (indispensable pour vérifier une identité). */
            identity: Boolean(supabase),
            /** Clé de service (écriture de `licences` à la livraison). */
            serviceKey: Boolean(serviceKey),
          },
          database: {
            /** `postgres` = `DATABASE_URL` fournie ; `pglite` = repli local, non déployable. */
            source: dbSource,
            reachable: database.reachable,
            ...(database.reason ? { reason: database.reason } : {}),
          },
          lemon: {
            apiKey: Boolean((env.LEMONSQUEEZY_API_KEY ?? "").trim()),
            webhookSecret: Boolean((env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "").trim()),
            /** Variante lue au build : sans elle, le bouton n'ouvre aucun checkout. */
            checkoutConfigured: isLemonCheckoutConfigured(lemon),
          },
        };

        return json(report);
      },
    },
  },
});
