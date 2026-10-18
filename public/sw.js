/**
 * Service worker — politique de cache. LIRE AVANT DE MODIFIER `CACHE`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * BUG RÉEL (2026-10-18) : le compteur de /signes affichait « 1 / 10 » alors que
 * le serveur servait 110 fiches. Le composant React était correct (il affiche
 * `items.length`) : c'est CE fichier qui resservait un HTML mis en cache, lequel
 * référençait les bundles d'un ancien déploiement — celui des 10 premières
 * fiches. Deux défauts, tous les deux ici :
 *
 *   1. `CACHE` était figé à "optimus-v1" et `activate` ne supprime que les
 *      caches dont le nom DIFFÈRE : rien n'était jamais purgé d'un déploiement
 *      à l'autre, donc un ancien document restait indéfiniment.
 *   2. TOUTES les réponses GET étaient mises en cache, y compris les DOCUMENTS
 *      (`/signes`, `/`) et les bundles. Un document périmé épingle les URL de
 *      bundles de son époque → l'ancienne application redémarre avec son
 *      ancien contenu. Un réseau mobile instable suffit : `fetch` échoue,
 *      `caches.match` répond, et l'utilisateur revoit « 1 / 10 ».
 *
 * RÈGLES QUI EN DÉCOULENT
 *   • Incrémenter `CACHE` à chaque changement de politique : c'est le SEUL
 *     mécanisme de purge côté client (rien d'autre ne nettoie un cache local).
 *   • Ne JAMAIS mettre un document (navigation) en cache : le réseau fait foi.
 *     Un HTML frais référence toujours les bundles du build courant.
 *   • Seuls les actifs HACHÉS (`/assets/…`) sont servis cache-first : leur nom
 *     change à chaque build, ils ne peuvent donc pas être périmés.
 *   • Le contenu éditorial (`/content/…`) n'entre jamais dans un cache : il est
 *     privé côté serveur (jeton de contenu, session S1), et un cache partagé
 *     resservirait la réponse d'un client licencié à un visiteur anonyme.
 */
const CACHE = "optimus-v2";

/** Icônes et manifeste : stables, sans hash, utiles hors ligne. */
const PRECACHE = ["/manifest.webmanifest", "/__grok/icon-192.png", "/__grok/icon-512.png"];

/** Actif haché par le build (`index-cZ3LJ9pU.js`) : immuable par construction. */
const HASHED_ASSET =
  /\/assets\/[A-Za-z0-9._-]+-[A-Za-z0-9_-]{6,}\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|avif)$/;

/** Chemins qui ne doivent jamais passer par un cache applicatif. */
function bypass(pathname) {
  return (
    pathname.startsWith("/api/") || // données dynamiques
    pathname.startsWith("/__") || // chrome de la plateforme (hors app)
    pathname.startsWith("/content/") || // contenu éditorial, privé côté serveur
    pathname === "/sw.js" // le service worker se met à jour lui-même
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Origine tierce (CDN d'images…) : on ne s'en mêle pas.
  if (url.origin !== self.location.origin) return;
  if (bypass(url.pathname)) return;

  // ⚠️ NE JAMAIS CACHER UN DOCUMENT. C'était la cause du « 1 / 10 » : un HTML
  // conservé d'un ancien build relance l'ancienne application, quel que soit ce
  // que le serveur sert aujourd'hui. On laisse le navigateur aller au réseau.
  if (request.mode === "navigate") return;

  if (HASHED_ASSET.test(url.pathname)) {
    // Cache-first légitime : le nom porte le hash du build.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Tout le reste (manifeste, icônes) : réseau d'abord, cache en secours hors ligne.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
