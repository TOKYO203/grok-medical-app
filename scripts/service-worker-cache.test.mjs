/**
 * Garde-fou — politique de cache du service worker.
 *
 * BUG RÉEL (2026-10-18) : « 1 / 10 » sur /signes alors que le serveur servait
 * 110 fiches. Le HTML mis en cache référençait les bundles d'un ancien
 * déploiement (celui des 10 premières fiches) et le cache n'était **jamais**
 * purgé : le nom `optimus-v1` était figé, donc `activate` ne supprimait rien.
 *
 * Ces quatre assertions rendent le retour du bug impossible sans casser un test :
 *
 *   1. le cache est VERSIONNÉ (>= 2) — c'est le seul mécanisme de purge client ;
 *   2. les navigations (documents HTML) ne sont jamais mises en cache ;
 *   3. les réponses du contenu éditorial (`/content/`) et de l'API non plus ;
 *   4. le cache-first est réservé aux actifs hachés (`/assets/…`), dont le nom
 *      change à chaque build.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SW = readFileSync(join(ROOT, "public/sw.js"), "utf8");

test("le nom du cache est versionné (purge des anciennes versions)", () => {
  const match = SW.match(/const CACHE = "([^"]+)"/);
  assert.ok(match, "aucune constante `CACHE` dans public/sw.js");

  const [, name] = match;
  assert.match(name, /^optimus-v\d+$/, `nom de cache inattendu : ${name}`);

  const version = Number(name.replace("optimus-v", ""));
  assert.ok(
    version >= 2,
    "revenir à optimus-v1 réactive le bug « 1 / 10 » : ce cache n'est jamais purgé " +
      "et conserve des documents d'anciens déploiements. Incrémenter à chaque " +
      "changement de politique.",
  );
});

test("les documents (navigations) ne sont JAMAIS mis en cache", () => {
  assert.match(
    SW,
    /request\.mode === "navigate"/,
    "le service worker doit sortir du cache pour les navigations (request.mode === 'navigate')",
  );

  // La sortie anticipation doit précéder toute écriture en cache.
  const navigateAt = SW.indexOf('request.mode === "navigate"');
  const firstPut = SW.indexOf("cache.put(");
  assert.ok(firstPut !== -1, "aucune écriture de cache détectée (le SW ne cacherait plus rien)");
  assert.ok(
    navigateAt < firstPut,
    "le garde `navigate` doit s'exécuter AVANT le premier cache.put, sinon un document peut être mis en cache",
  );
});

test("l'API, le contenu éditorial et le SW lui-même ne passent pas par le cache", () => {
  for (const path of ["/api/", "/content/", "/sw.js"]) {
    assert.ok(
      SW.includes(`"${path}"`),
      `le chemin ${path} doit être exclu du cache (sinon réponse périmée, ou fuite d'un contenu privé)`,
    );
  }
  assert.ok(SW.includes('startsWith("/__")'), "les routes de la plateforme (/__) doivent rester hors cache");
});

test("le cache-first est réservé aux actifs hachés du build", () => {
  assert.match(SW, /HASHED_ASSET/, "aucune règle d'actif haché");

  // Le motif doit exiger le dossier /assets/ ET un hash -> un nom de fichier
  // non haché (comme `sw.js`, un JSON de données) ne peut pas matcher.
  const pattern = SW.match(/const HASHED_ASSET =\s*([\s\S]*?);/);
  assert.ok(pattern, "motif HASHED_ASSET illisible");
  assert.match(pattern[1], /\\\/assets\\\//, "HASHED_ASSET doit cibler /assets/");
  assert.match(pattern[1], /\{6,\}/, "HASHED_ASSET doit exiger un hash (>= 6 caractères)");

  // Le manifeste et les icônes restent servis réseau d'abord (secours hors ligne),
  // jamais cache-first : ils changeront sans changer de nom.
  assert.match(SW, /caches\.match\(request\)\)\)/, "le repli hors ligne des actifs non hachés doit rester un repli");
});

test("le service worker prend la main sans attendre un second chargement", () => {
  assert.match(SW, /self\.skipWaiting\(\)/);
  assert.match(SW, /self\.clients\.claim\(\)/);
  // La purge doit précéder la prise de contrôle : un client ne doit pas servir
  // l'ancien contenu pendant que les anciens caches existent encore.
  assert.ok(
    SW.indexOf("caches.delete") < SW.indexOf("self.clients.claim()"),
    "les anciens caches doivent être supprimés avant claim()",
  );
});
