#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Optimus — « peut-on encaisser ? » en une commande.

     node scripts/payment-readiness.mjs            # lecture seule
     node scripts/payment-readiness.mjs --json     # sortie machine

   POURQUOI : le 2026-10-22, la variante Lemon Squeezy était `pending` et l'URL
   de checkout renvoyait sur l'ACCUEIL de la boutique. Un visiteur cliquait
   « Payer par carte » et n'avait rien à acheter. Aucun test ne l'aurait dit :
   la panne est chez le prestataire, pas dans le code. Ce script rend l'état
   visible AVANT d'annoncer une mise en vente.

   Ce qu'il vérifie :
     1. configuration présente (clés serveur, variables client inlinées au build)
     2. état réel chez Lemon Squeezy (boutique, produit, variante, webhook)
     3. l'URL de checkout mène bien à une PAGE PRODUIT (pas à l'accueil)
     4. migr. 0015 appliquée (contrainte `offer` accepte 'subscription')
     5. aucun webhook orphelin / aucune commande livrée sans licence

   Aucun secret n'est affiché : les clés sont résumées en longueur + empreinte.
   Aucune écriture : uniquement des SELECT et des GET.
   ═══════════════════════════════════════════════════════════════════════════ */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

const JSON_OUT = process.argv.includes("--json");

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const ENV = { ...readEnvFile(".env.local"), ...process.env };

const checks = [];
/** @param {"ok"|"warn"|"fail"|"skip"} status */
function check(id, status, label, detail = "", fix = "") {
  checks.push({ id, status, label, detail, fix });
}

function fingerprint(value) {
  if (!value) return "absent";
  const h = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return `présent (${value.length} car., sha ${h})`;
}

const PLACEHOLDER = /colle|ton_|xxx|placeholder|change[-_]?me|exemple/i;

/* ─── 1. Configuration ───────────────────────────────────────────────────── */

const SERVER_VARS = ["LEMONSQUEEZY_API_KEY", "LEMONSQUEEZY_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of SERVER_VARS) {
  const v = ENV[name];
  const set = Boolean(v) && !PLACEHOLDER.test(v);
  check(
    `env:${name}`,
    set ? "ok" : "fail",
    `${name} (serveur)`,
    set ? fingerprint(v) : v ? "valeur de remplissage" : "absent",
    set ? "" : "Renseigner la variable côté serveur (Production + Preview).",
  );
}

const CLIENT_VARS = ["VITE_LEMONSQUEEZY_STORE_SLUG", "VITE_LEMONSQUEEZY_VARIANT_ID", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
for (const name of CLIENT_VARS) {
  const v = ENV[name];
  const set = Boolean(v) && !PLACEHOLDER.test(v);
  check(
    `env:${name}`,
    set ? "ok" : "fail",
    `${name} (client, inlinée au build)`,
    // Jamais la valeur : même la clé `anon` est publique mais un log se partage.
    set ? (v.startsWith("http") ? v.replace(/^(https:\/\/[^.]+\.).*$/, "$1…") : fingerprint(v)) : "absent",
    set ? "" : "Absente du bundle : le bouton restera inactif. REBUILD obligatoire après ajout.",
  );
}

/* ─── 2. Lemon Squeezy ───────────────────────────────────────────────────── */

const LS_API = "https://api.lemonsqueezy.com/v1";
const API_KEY = ENV.LEMONSQUEEZY_API_KEY;

/** Le slug de variante peut être un UUID ou l'id numérique : on compare l'URL finale. */
function normaliseCheckout(url) {
  return String(url).trim().replace(/\/+$/, "").toLowerCase();
}

async function ls(path) {
  const res = await fetch(`${LS_API}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/vnd.api+json" },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const variantId = ENV.VITE_LEMONSQUEEZY_VARIANT_ID;
const storeSlug = ENV.VITE_LEMONSQUEEZY_STORE_SLUG;

if (API_KEY && !PLACEHOLDER.test(API_KEY)) {
  try {
    const stores = await ls("/stores");
    if (stores.status !== 200) throw new Error(`HTTP ${stores.status}`);
    const store = stores.json?.data?.[0];
    check("ls:store", store ? "ok" : "fail", "boutique Lemon Squeezy joignable", store ? `#${store.id} « ${store.attributes?.name} » · ${store.attributes?.currency}` : "aucune boutique");

    // Mode test ou live : lisible via la variante (test_mode) et les webhooks.
    let variant = null;
    if (variantId) {
      const byId = await fetch(`${LS_API}/variants/${variantId}`, {
        headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/vnd.api+json" },
      });
      if (byId.status === 200) {
        variant = (await byId.json()).data;
        const prod = await ls(`/products/${variant.attributes?.product_id}`);
        globalThis.__lsBuyNowUrl = prod.json?.data?.attributes?.buy_now_url ?? null;
      } else {
        // L'endpoint n'accepte que l'id numérique ; l'UUID est le *slug*.
        const products = await ls(`/products?filter[store_id]=${store?.id}`);
        for (const product of products.json?.data ?? []) {
          const variants = await ls(`/variants?filter[product_id]=${product.id}`);
          const match = (variants.json?.data ?? []).find(
            (v) => v.attributes?.slug === variantId || String(v.id) === String(variantId),
          );
          if (match) {
            variant = match;
            // Lemon Squeezy expose le lien d'achat qu'il a lui-même généré.
            globalThis.__lsBuyNowUrl = product.attributes?.buy_now_url ?? null;
            break;
          }
        }
      }
    }

    if (!variant) {
      check("ls:variant", "fail", "variante configurée introuvable chez Lemon Squeezy", `VITE_LEMONSQUEEZY_VARIANT_ID=${variantId ?? "absent"}`, "Le slug de variante ne correspond à aucune variante : l'URL de checkout ne trouvera aucun produit.");
    } else {
      // DOCUMENTATION LEMON SQUEEZY : « If only one variant exists for a product,
      // it is considered the default variant and it is not shown as a separate
      // option at checkout. It will also have a pending status. »
      // `pending` n'est donc PAS un défaut quand la variante est la seule du
      // produit : c'est la forme normale. Le confondre avec « non publiée » a
      // produit un faux blocage le 2026-10-22 (checkout vérifié fonctionnel au
      // navigateur, 19,00 € facturés tous les 3 mois).
      const productVariants = await ls(`/variants?filter[product_id]=${variant.attributes?.product_id}`);
      const siblings = productVariants.json?.data ?? [];
      const isSoleVariant = siblings.length <= 1;
      const published = variant.attributes?.status === "published";
      const acceptable = published || (isSoleVariant && variant.attributes?.status === "pending");
      check(
        "ls:variant",
        acceptable ? "ok" : "fail",
        published
          ? "variante publiée"
          : acceptable
            ? "variante par défaut (statut « pending » = normal)"
            : `variante en statut « ${variant.attributes?.status} »`,
        `#${variant.id} « ${variant.attributes?.name} » · ${(variant.attributes?.price ?? 0) / 100} ${store?.attributes?.currency ?? ""} · ${variant.attributes?.is_subscription ? `abonnement ${variant.attributes?.interval_count} ${variant.attributes?.interval}(s)` : "paiement unique"} · slug ${variant.attributes?.slug} · ${siblings.length} variante(s)`,
        acceptable
          ? ""
          : "Lemon Squeezy → Produits → variante → publier. Sans cela le checkout ne trouve aucun produit à vendre.",
      );

      const price = variant.attributes?.price ?? 0;
      check(
        "ls:price",
        price > 0 ? "ok" : "fail",
        price > 0 ? "prix renseigné" : "aucun prix : le checkout ne peut rien facturer",
        `${price / 100} ${store?.attributes?.currency ?? ""}${variant.attributes?.is_subscription ? ` / ${variant.attributes?.interval_count} ${variant.attributes?.interval}(s)` : ""}`,
        price > 0 ? "" : "Renseigner un prix sur la variante.",
      );

      const testMode = variant.attributes?.test_mode;
      check(
        "ls:mode",
        testMode ? "warn" : "ok",
        testMode ? "boutique en MODE TEST" : "boutique en mode LIVE",
        testMode ? "les paiements ne sont pas réels" : "les paiements sont réels",
        testMode ? "Pour encaisser : passer la boutique en live, régénérer la clé API ET le secret du webhook (ils diffèrent du mode test)." : "",
      );
    }

    const webhooks = await ls(`/webhooks?filter[store_id]=${store?.id}`);
    const hooks = webhooks.json?.data ?? [];
    const wanted = ["order_created", "subscription_created"];
    const covering = hooks.find((h) => wanted.every((e) => (h.attributes?.events ?? []).includes(e)));
    check(
      "ls:webhook",
      covering ? "ok" : "fail",
      covering ? "webhook déclaré" : "aucun webhook ne couvre order_created + subscription_created",
      covering ? `${covering.attributes?.url} · ${(covering.attributes?.events ?? []).join(", ")} · ${covering.attributes?.test_mode ? "mode TEST" : "mode LIVE"}` : `${hooks.length} webhook(s) déclaré(s)`,
      covering ? "" : "Lemon Squeezy → Settings → Webhooks : URL https://<domaine>/api/webhooks/lemonsqueezy, événements order_created + subscription_created.",
    );
    const mismatch = covering && (covering.attributes?.test_mode ?? false) !== Boolean(variant?.attributes?.test_mode);
    if (mismatch) {
      check("ls:webhook-mode", "fail", "webhook et variante dans des modes différents", `webhook ${covering.attributes?.test_mode ? "TEST" : "LIVE"} · variante ${variant?.attributes?.test_mode ? "TEST" : "LIVE"}`, "Le secret d'un webhook test ne vérifie PAS les payloads live (et inversement) : signature refusée en 401.");
    }
  } catch (e) {
    check("ls:api", "fail", "API Lemon Squeezy injoignable", e.message, "Vérifier la clé API et la connectivité.");
  }
} else {
  check("ls:api", "skip", "API Lemon Squeezy non interrogée", "clé API absente");
}

/* ─── 3. L'URL de checkout est-elle celle que Lemon Squeezy génère ? ─────── */
//
// PIÈGE MESURÉ LE 2026-10-22 : la page de checkout est une SPA servie par
// Cloudflare. Un `fetch` reçoit un 302 vers /checkout puis un document vide en
// 404 — alors que la page RÉELLE, chargée dans un navigateur, affiche le prix,
// le formulaire et le bouton de paiement. Juger sur le code HTTP produit donc un
// FAUX BLOCAGE. On compare au contraire notre URL à `buy_now_url`, que Lemon
// Squeezy génère lui-même : c'est la source de vérité, sans navigateur.
//
// L'ultime vérification reste humaine : ouvrir l'URL une fois et voir le prix.

if (storeSlug && variantId && !PLACEHOLDER.test(storeSlug)) {
  const composed = `https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}`;
  const official = globalThis.__lsBuyNowUrl;
  if (official) {
    const same = normaliseCheckout(official) === normaliseCheckout(composed);
    check(
      "checkout:link",
      same ? "ok" : "warn",
      same ? "URL de checkout conforme à celle générée par Lemon Squeezy" : "URL de checkout différente de celle générée par Lemon Squeezy",
      `notre lien ${composed.replace(/^https:\/\/[^.]+\./, "….")}`,
      same
        ? "Vérifier une fois à l'œil : ouvrir le lien, le prix doit s'afficher."
        : `Lemon Squeezy génère : ${official}. Utiliser cette valeur pour VITE_LEMONSQUEEZY_VARIANT_ID.`,
    );
  } else {
    check("checkout:link", "skip", "lien de checkout non comparé", "produit non résolu via l'API");
  }
} else {
  check("checkout:link", "skip", "lien de checkout non testé", "slug de boutique ou variante absent");
}

/* ─── 4 & 5. Base de données serveur ─────────────────────────────────────── */

if (!ENV.DATABASE_URL) {
  check("db", "skip", "base serveur non interrogée", "DATABASE_URL absent");
} else {
  const client = new pg.Client({
    connectionString: ENV.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();

    const constraint = await client.query(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'purchase_orders_offer_check'",
    );
    const def = constraint.rows[0]?.def ?? "";
    check(
      "db:offer",
      def.includes("subscription") ? "ok" : "fail",
      def.includes("subscription") ? "migration 0015 appliquée" : "migration 0015 MANQUANTE",
      def || "contrainte absente",
      def.includes("subscription") ? "" : "Un abonnement Mobile Money échouerait en 23514 : paiement encaissé, aucune commande. Lancer `npm run db:migrate`.",
    );

    const orphans = await client.query(`
      select count(*)::int as n
        from purchase_orders p
        left join activation_keys k on k.purchase_reference = p.reference
       where p.status = 'delivered' and k.id is null
    `);
    check(
      "db:orphans",
      orphans.rows[0].n === 0 ? "ok" : "fail",
      "commande livrée sans licence",
      `${orphans.rows[0].n} orpheline(s)`,
      orphans.rows[0].n === 0 ? "" : "Une commande payée sans accès : créer la licence manquante avant d'annoncer la vente.",
    );

    const expired = await client.query(`
      select count(*)::int as n from activation_keys
       where revoked_at is null and expires_at is not null and expires_at < now()
    `);
    check("db:expired", "ok", "licences expirées non révoquées", `${expired.rows[0].n} (révocation paresseuse, sans incidence sur le client)`);

    const orders = await client.query("select count(*)::int as n from purchase_orders");
    const hooks = await client.query("select count(*)::int as n from webhook_events");
    check(
      "db:activity",
      orders.rows[0].n === 0 ? "warn" : "ok",
      orders.rows[0].n === 0 ? "aucune commande réelle en base" : "activité réelle en base",
      `${orders.rows[0].n} commande(s) · ${hooks.rows[0].n} webhook(s) reçu(s)`,
      orders.rows[0].n === 0
        ? "Aucune commande : la chaîne de bout en bout n'a JAMAIS été exercée en production. Faire un achat de test réel avant d'annoncer la vente."
        : "",
    );
  } catch (e) {
    check("db", "warn", "base serveur non joignable", e.message.slice(0, 120));
  } finally {
    await client.end().catch(() => {});
  }
}

/* ─── Verdict ────────────────────────────────────────────────────────────── */

const fails = checks.filter((c) => c.status === "fail");
const warns = checks.filter((c) => c.status === "warn");
const verdict = fails.length === 0 && warns.length === 0 ? "READY" : fails.length ? "BLOQUÉ" : "PRÊT SOUS RÉSERVE";

if (JSON_OUT) {
  console.log(JSON.stringify({ at: new Date().toISOString(), verdict, checks }, null, 2));
  process.exit(fails.length === 0 ? 0 : 1);
}

const ICON = { ok: "✔", warn: "⚠", fail: "✖", skip: "·" };
console.log(`\n═══ Optimus — encaissement : ${verdict} ═══\n`);
for (const c of checks) {
  console.log(`${ICON[c.status]} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
  if (c.fix && c.status !== "ok") console.log(`   → ${c.fix}`);
}
console.log(
  `\n${checks.filter((c) => c.status === "ok").length} OK · ${warns.length} alerte(s) · ${fails.length} bloquant(s)`,
);
if (fails.length === 0 && warns.length === 0) {
  console.log("Encaissement possible. Faire un achat réel de bout en bout avant d'annoncer la vente.\n");
}
process.exit(fails.length === 0 ? 0 : 1);
