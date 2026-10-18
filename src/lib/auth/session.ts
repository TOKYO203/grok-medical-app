/**
 * SESSION « CONTENU PREMIUM » — côté client.
 *
 * Le contenu payant est servi par un garde serveur (`/content/$type/$file`).
 * Le seul justificatif accepté est un JWT de 24 h, obtenu en échangeant une clé
 * de licence (`POST /api/licenses/verify`).
 *
 * ⚠️ Ce module ne contient AUCUN secret : il transporte un jeton opaque. Il ne
 * vérifie pas la signature du jeton (impossible sans le secret serveur) ; il
 * lit seulement `exp` pour purger un jeton périmé AVANT de faire un aller-retour
 * réseau voué au 401.
 *
 * ⚠️ Le jeton est écrit à DEUX endroits, volontairement :
 *   • `localStorage["optimus_session"]` — contrat produit, survit au rechargement ;
 *   • cookie `optimus_session` (SameSite=Lax, non HttpOnly) — permet au rendu
 *     SERVEUR de la fiche d'avoir le jeton dès la première requête, donc pas de
 *     flash « Premium requis » chez un client qui a payé.
 */

export const SESSION_STORAGE_KEY = "optimus_session";
export const SESSION_COOKIE_NAME = "optimus_session";

/** Drapeau mémoire : un jeton expiré a été purgé (lu par le bandeau Premium). */
let expiredSessionSeen = false;

/** Durée de vie par défaut, alignée sur `CONTENT_TOKEN_TTL_SECONDS` (24 h). */
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Navigation privée / stockage bloqué : on dégrade, on ne casse pas.
    return null;
  }
}

function decodeBase64UrlJson(segment: string): unknown {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/**
 * Date d'expiration lue dans la charge du JWT (epoch ms), `null` si illisible.
 * Lecture NON authentifiée : elle sert uniquement à éviter des requêtes
 * inutiles, jamais à autoriser quoi que ce soit.
 */
export function tokenExpiresAt(token: string): number | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload = decodeBase64UrlJson(segments[1]);
    if (payload === null || typeof payload !== "object") return null;
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function writeCookie(token: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  } catch {
    // Cookie refusé : le jeton reste utilisable via l'en-tête Authorization.
  }
}

function clearCookie(): void {
  if (typeof document === "undefined") return;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // rien à faire
  }
}

/** Jeton courant, ou `null`. Un jeton expiré est purgé au passage. */
export function getToken(now = Date.now()): string | null {
  const store = storage();
  const token = store?.getItem(SESSION_STORAGE_KEY);
  if (!token) return null;

  const expiresAt = tokenExpiresAt(token);
  if (expiresAt !== null && expiresAt <= now) {
    clearToken();
    expiredSessionSeen = true;
    return null;
  }
  return token;
}

/**
 * Drapeau « un jeton a expiré sur cet appareil », lu UNE fois.
 *
 * Permet au bandeau Premium de dire « votre accès de 24 h a expiré » plutôt
 * que « activez votre clé » à un client qui en a déjà une — sans exposer le
 * jeton ni son contenu.
 */
export function consumeExpiredSessionFlag(): boolean {
  const seen = expiredSessionSeen;
  expiredSessionSeen = false;
  return seen;
}

/** Enregistre le jeton (localStorage + cookie pour le rendu serveur). */
export function setToken(token: string, expiresAt?: number | null): void {
  const trimmed = token.trim();
  if (!trimmed) return;

  storage()?.setItem(SESSION_STORAGE_KEY, trimmed);

  const expires = expiresAt ?? tokenExpiresAt(trimmed);
  const maxAge =
    expires === null || expires === undefined
      ? DEFAULT_MAX_AGE_SECONDS
      : Math.max(0, Math.floor((expires - Date.now()) / 1000));
  writeCookie(trimmed, maxAge || DEFAULT_MAX_AGE_SECONDS);
}

/** Purge complète : localStorage ET cookie (401, déconnexion, licence révoquée). */
export function clearToken(): void {
  try {
    storage()?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // stockage indisponible : rien à purger
  }
  clearCookie();
}

/** Vrai si une session contenu est active (jeton présent et non expiré). */
export function hasContentSession(now = Date.now()): boolean {
  return getToken(now) !== null;
}

/**
 * `fetch` qui joint le jeton de contenu.
 *
 * Sur 401 avec un jeton envoyé, la session est purgée : un jeton signé par un
 * ancien secret, révoqué ou corrompu ne doit pas rester indéfiniment dans le
 * stockage en provoquant des 401 silencieux.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && token) clearToken();
  return response;
}

/** Nonce anti-replay : 16 octets aléatoires en base64url (22 caractères). */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type ContentTokenResult =
  | { ok: true; expiresAt: number | null }
  | { ok: false; error: string };

/**
 * Échange une clé de licence contre un jeton de contenu, puis l'enregistre.
 *
 * Appelé juste après une activation réussie (`/api/licenses/activate`), mais
 * aussi utilisable seul : c'est le même appel qui renouvelle l'accès de 24 h
 * une fois celui-ci expiré.
 */
export async function requestContentToken(
  licenseKey: string,
  deviceId?: string | null,
): Promise<ContentTokenResult> {
  try {
    const response = await fetch("/api/licenses/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Usage unique : une requête capturée ne peut pas être rejouée.
        "X-Nonce": randomNonce(),
      },
      body: JSON.stringify({ licenseKey, ...(deviceId ? { deviceId } : {}) }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      token?: unknown;
      expiresAt?: unknown;
      error?: unknown;
    };

    if (!response.ok || typeof payload.token !== "string") {
      return {
        ok: false,
        error: typeof payload.error === "string" ? payload.error : `http_${response.status}`,
      };
    }

    const expiresAt = typeof payload.expiresAt === "number" ? payload.expiresAt : null;
    setToken(payload.token, expiresAt);
    return { ok: true, expiresAt };
  } catch {
    return { ok: false, error: "network" };
  }
}
