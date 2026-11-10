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
 * ⚠️ Depuis le pentest §4, le jeton vit dans `localStorage["optimus_session"]`
 * (contrat produit, repli hors-ligne explicite) et le cookie `optimus_session`
 * est posé par le SERVEUR (endpoints `/api/licenses/*`) en HttpOnly : le
 * client ne peut ni le lire, ni l'écrire, ni l'effacer. Le rendu serveur
 * reçoit toujours le jeton dès la requête suivante (pas de flash « Premium
 * requis ») ; un cookie périmé est inoffensif (le garde répond 401) et expire
 * au Max-Age fixé par le serveur.
 */

export const SESSION_STORAGE_KEY = "optimus_session";
export const SESSION_COOKIE_NAME = "optimus_session";

/** Drapeau mémoire : un jeton expiré a été purgé (lu par le bandeau Premium). */
let expiredSessionSeen = false;

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

/** Jeton courant, ou `null`. Un jeton expiré est purgé au passage. */
/**
 * Retourne le token SANS verifier l'expiration.
 * Sert au fallback offline (grace period 7j) : on doit pouvoir lire un token
 * expire sans qu'il soit purge, pour decider si on est encore dans la fenetre
 * de tolerance. Ne JAMAIS utiliser pour une decision d'acces : passer par
 * verifyLocalLicenseToken() qui valide la signature.
 */
export function getTokenRaw(): string | null {
  const store = storage();
  return store?.getItem(SESSION_STORAGE_KEY) ?? null;
}

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

/**
 * Enregistre le jeton dans `localStorage`.
 *
 * Pentest §4 : le cookie de session (HttpOnly) est posé par le SERVEUR, dans
 * la réponse des endpoints `/api/licenses/*` — le client ne peut pas écrire un
 * cookie HttpOnly, et ne doit plus écrire de cookie lisible par le JavaScript.
 * `expiresAt` reste disponible via `tokenExpiresAt()` pour la purge locale.
 */
export function setToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) return;
  storage()?.setItem(SESSION_STORAGE_KEY, trimmed);
}

/**
 * Purge le jeton local (401, déconnexion, licence révoquée).
 *
 * Pentest §4 : le cookie HttpOnly ne peut pas être effacé par le client. Il
 * est inoffensif (le garde répond 401 à un jeton périmé ou révoqué) et le
 * navigateur l'efface au Max-Age fixé par le serveur à l'émission.
 */
export function clearToken(): void {
  try {
    storage()?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // stockage indisponible : rien à purger
  }
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
    setToken(payload.token);
    return { ok: true, expiresAt };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * Demande un JETON D'ESSAI au serveur (pentest §14) et l'enregistre.
 *
 * L'essai Premium n'est plus un simple drapeau client : le contenu Pro vit
 * derrière le garde `/content/$type/$file`, et c'est ce jeton court (2 h,
 * quota par IP) qui le rend réel. Aucune clé, aucun compte requis — le client
 * l'appelle quand un catalogue Premium répond 401 sans session active.
 */
export async function requestTrialToken(): Promise<ContentTokenResult> {
  try {
    const response = await fetch("/api/licenses/trial-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    setToken(payload.token);
    return { ok: true, expiresAt };
  } catch {
    return { ok: false, error: "network" };
  }
}
