/**
 * Client de mesure produit.
 *
 * RÈGLES DE CONCEPTION (toutes dictées par un usage réel) :
 *   • ne JAMAIS ralentir l'interface : `track()` ne lève pas, ne bloque pas, et
 *     abandonne silencieusement si le réseau est absent (marché à connexion
 *     instable) ;
 *   • ne pas multiplier les requêtes : les événements sont groupés (flush à
 *     2 s, à 10 événements, ou à la fermeture de l'onglet via `sendBeacon`) ;
 *   • ne pas collecter d'identité : `anon_id` est un identifiant aléatoire créé
 *     localement, sans lien avec le compte ;
 *   • respecter le refus : `navigator.doNotTrack` et un interrupteur local
 *     (`optimus.analytics.optOut`) désactivent tout envoi ;
 *   • être inerte côté serveur (SSR) : aucun accès à `window` hors fonction.
 */
import { isAnonId, type EventProps, type ProductEventName } from "./events";

const ANON_KEY = "optimus.analytics.anonId";
const OPT_OUT_KEY = "optimus.analytics.optOut";
const FLUSH_DELAY_MS = 2_000;
const MAX_QUEUE = 10;

type Queued = { name: ProductEventName; anonId: string | null; props: EventProps };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // navigation privée / stockage bloqué
  }
}

/** Interrupteur utilisateur, exposé dans /donnees. */
export function isOptedOut(): boolean {
  const store = storage();
  if (!store) return false;
  return store.getItem(OPT_OUT_KEY) === "1";
}

export function setOptedOut(optedOut: boolean): void {
  const store = storage();
  if (!store) return;
  try {
    if (optedOut) store.setItem(OPT_OUT_KEY, "1");
    else store.removeItem(OPT_OUT_KEY);
    if (optedOut) queue = [];
  } catch {
    /* stockage indisponible : on n'insiste pas */
  }
}

/** Identifiant aléatoire opaque, stable localement, sans lien avec le compte. */
function anonId(): string | null {
  const store = storage();
  if (!store) return null;
  let id = store.getItem(ANON_KEY);
  if (isAnonId(id)) return id;
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    store.setItem(ANON_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function send(events: Queued[]): void {
  if (typeof window === "undefined" || events.length === 0) return;
  const body = JSON.stringify({ events });

  // À la fermeture de l'onglet, `fetch` est coupé : `sendBeacon` est le seul
  // moyen fiable de ne pas perdre le dernier événement (achat, session terminée).
  if (document.visibilityState === "hidden" && typeof navigator.sendBeacon === "function") {
    try {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    } catch {
      /* on retombe sur fetch */
    }
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    /* hors ligne : la mesure est perdue, l'utilisateur ne le voit jamais */
  });
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const pending = queue;
  queue = [];
  send(pending);
}

/**
 * Enregistre un événement produit. À appeler depuis un gestionnaire d'événement
 * utilisateur (jamais pendant le rendu).
 */
export function track(name: ProductEventName, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  if (isOptedOut() || dntEnabled()) return;

  queue.push({ name, anonId: anonId(), props });
  if (queue.length >= MAX_QUEUE) {
    flush();
    return;
  }
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/**
 * À monter une seule fois (dans `__root`) : vide la file quand l'onglet se
 * cache, sinon les derniers événements seraient perdus à la fermeture.
 */
export function installAnalyticsFlush(): () => void {
  if (typeof document === "undefined") return () => {};
  const onHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHidden);
  return () => document.removeEventListener("visibilitychange", onHidden);
}

/** Utilitaire de test : vide la file immédiatement. */
export function __flushNow(): void {
  flush();
}
