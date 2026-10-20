import {
  getToken,
  hasContentSession,
  requestContentToken,
  setToken,
  tokenExpiresAt,
} from "@/lib/auth/session";
import {
  activeLicence,
  isVerifiableLicenceKey,
  licenceIdentity,
  licenceKeyFromRow,
  type LicenceRow,
} from "@/lib/cloud/licence";
import { getCloudAuthSnapshot, subscribeCloudAuth, type CloudAuthSnapshot } from "@/lib/cloud/session";
import { loadSupabase } from "@/lib/supabase";
import { useOptimus } from "@/state/store";

/**
 * PONT « LICENCE SUPABASE → SESSION DE CONTENU » — côté navigateur.
 *
 * PROBLÈME RÉSOLU
 * `/signes` et `/pathologie/$slug` lisent du contenu servi par un garde serveur
 * qui exige un JWT de contenu (`Authorization: Bearer …` ou cookie
 * `optimus_session`). Ce jeton ne s'obtenait qu'en SAISISSANT une clé sur
 * `/pro`. Un client dont la licence est créée dans Supabase (aucune clé
 * saisissable, et souvent aucune colonne de clé du tout) restait donc bloqué
 * sur « Activer ma licence ».
 *
 * STRATÉGIE (deux chemins, le plus sûr d'abord)
 *   1. **Chemin rapide** : un jeton valide est déjà en stockage → rien à faire.
 *   2. **Clé disponible** : si la ligne `licences` porte une clé ÉCHANGEABLE
 *      (`OPT1.…` ou `OPT-…`), on passe par le parcours commercial existant
 *      (`POST /api/licenses/verify`, nonce + quota).
 *   3. **Sinon (cas réel du schéma actuel)** : on présente le jeton d'accès
 *      Supabase à `POST /api/licenses/session`, qui le fait vérifier par
 *      Supabase puis signe un jeton de contenu si une licence est ACTIVE.
 *
 * Le jeton obtenu est écrit par `setToken()` dans `localStorage` ET dans le
 * cookie `optimus_session` : le rendu SERVEUR des fiches de nosographie le voit
 * donc dès la requête suivante (c'est pourquoi les pages rechargent leur loader
 * quand la session passe de « absente » à « prête »).
 *
 * ⚠️ Rien ici n'est une frontière de sécurité : la décision d'accorder le jeton
 * est prise côté serveur. Ce module ne fait que TRANSPORTER la demande, et il
 * ne journalise jamais une clé de licence.
 */

const AUTH_WAIT_MS = 2_500;
const STEP_TIMEOUT_MS = 8_000;

/** Marge avant expiration : on renouvelle plutôt que de risquer un 401. */
const TOKEN_SKEW_MS = 60_000;

/** Mémo négatif : inutile d'interroger Supabase à chaque montage de page. */
const MEMO_KEY = "optimus_content_session_memo";
const NO_LICENCE_MEMO_MS = 60_000;

export type ContentSessionReason =
  | "no-session"
  | "no-licence"
  | "rejected"
  | "unconfigured"
  | "offline";

export type ContentSessionSnapshot = {
  status: "idle" | "checking" | "ready" | "none";
  reason: ContentSessionReason | null;
  /**
   * Incrémenté à CHAQUE nouveau jeton : les pages qui ont déjà chargé leur
   * contenu (et reçu un 401) s'en servent pour relancer leur chargement, sans
   * rechargement de page ni clic de l'utilisateur.
   */
  generation: number;
};

export type ContentSessionResult =
  | { status: "ready"; source: "token" | "licence-key" | "cloud-session" }
  | { status: "none"; reason: ContentSessionReason };

const SERVER_SNAPSHOT: ContentSessionSnapshot = Object.freeze({
  status: "idle",
  reason: null,
  generation: 0,
});

let snapshot: ContentSessionSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let inflight: Promise<ContentSessionResult> | null = null;

function publish(next: ContentSessionSnapshot): void {
  if (
    next.status === snapshot.status &&
    next.reason === snapshot.reason &&
    next.generation === snapshot.generation
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

function markReady(
  source: "token" | "licence-key" | "cloud-session",
): ContentSessionResult {
  // La génération n'avance QUE sur une transition : une session déjà prête
  // n'oblige pas les pages à recharger leur contenu (aucun flash inutile).
  if (snapshot.status !== "ready") {
    publish({ status: "ready", reason: null, generation: snapshot.generation + 1 });
  }
  clearMemo();
  return { status: "ready", source };
}

function markNone(reason: ContentSessionReason): ContentSessionResult {
  publish({ status: "none", reason, generation: snapshot.generation });
  return { status: "none", reason };
}

/** `null` si le délai expire : aucun appel ne peut bloquer indéfiniment l'UI. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Attend que la session cloud soit RÉSOLUE (jamais plus de `ms`).
 *
 * Sans cette attente, le pont interrogerait Supabase alors que le SDK n'a pas
 * encore rendu la main et conclurait « pas de session » à tort, à chaque
 * démarrage à froid.
 */
function waitForCloudAuth(ms: number): Promise<CloudAuthSnapshot> {
  const current = getCloudAuthSnapshot();
  if (current.status !== "loading") return Promise.resolve(current);

  return new Promise((resolve) => {
    let unsubscribe: () => void = () => {};
    const finish = (value: CloudAuthSnapshot) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const timer = setTimeout(() => finish(getCloudAuthSnapshot()), ms);
    unsubscribe = subscribeCloudAuth(() => {
      const next = getCloudAuthSnapshot();
      if (next.status !== "loading") finish(next);
    });
  });
}

function deviceId(): string | null {
  try {
    const value = useOptimus.getState().profile.deviceId;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

/** Mémo négatif en `sessionStorage` (survit à la navigation, pas au jour). */
function readMemo(subject: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(MEMO_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { subject?: unknown; at?: unknown };
    if (parsed.subject !== subject || typeof parsed.at !== "number") return false;
    return Date.now() - parsed.at < NO_LICENCE_MEMO_MS;
  } catch {
    return false;
  }
}

function writeMemo(subject: string): void {
  try {
    window.sessionStorage.setItem(MEMO_KEY, JSON.stringify({ subject, at: Date.now() }));
  } catch {
    // stockage indisponible : on refera la requête, rien de cassé
  }
}

function clearMemo(): void {
  try {
    window.sessionStorage.removeItem(MEMO_KEY);
  } catch {
    // rien à faire
  }
}

/** Lignes de licence de l'utilisateur courant (RLS), ou `null` si illisible. */
async function readLicences(
  client: NonNullable<Awaited<ReturnType<typeof loadSupabase>>>,
): Promise<LicenceRow[] | null> {
  try {
    const { data, error } = await client.from("licences").select("*");
    if (error) {
      // 42501 = GRANT/policy manquants : configuration, pas « pas de licence ».
      console.warn("[content-session] licences:", error.code, error.message);
      return null;
    }
    return Array.isArray(data) ? (data as LicenceRow[]) : [];
  } catch {
    return null;
  }
}

type SessionTokenResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * `POST /api/licenses/session` — présente le jeton d'accès Supabase.
 *
 * Pas de nonce ici : le nonce protège une CLÉ (réutilisable), alors que ce
 * jeton d'accès est déjà un porteur éphémère et personnel ; le rejouer ne donne
 * rien de plus que ce qu'il permet déjà. Le quota, lui, reste en place.
 */
async function requestSessionToken(accessToken: string): Promise<SessionTokenResult> {
  try {
    const response = await fetch("/api/licenses/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      token?: unknown;
      expiresAt?: unknown;
      error?: unknown;
    };
    if (!response.ok || typeof payload.token !== "string") {
      return {
        ok: false,
        status: response.status,
        error: typeof payload.error === "string" ? payload.error : `http_${response.status}`,
      };
    }
    setToken(payload.token, typeof payload.expiresAt === "number" ? payload.expiresAt : null);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

async function runEnsure(): Promise<ContentSessionResult> {
  // 1. Chemin rapide : jeton déjà présent (et pas au bord de l'expiration).
  const existing = getToken();
  if (existing) {
    const expiresAt = tokenExpiresAt(existing);
    if (expiresAt === null || expiresAt - Date.now() > TOKEN_SKEW_MS) {
      return markReady("token");
    }
  }

  publish({ status: "checking", reason: null, generation: snapshot.generation });

  const auth = await waitForCloudAuth(AUTH_WAIT_MS);
  // Un autre appel (autre onglet, pont du root) a pu poser le jeton entre-temps.
  if (getToken()) return markReady("token");

  if (auth.status !== "authenticated") {
    return markNone(auth.status === "unavailable" ? "offline" : "no-session");
  }

  const client = await withTimeout(loadSupabase(), STEP_TIMEOUT_MS);
  if (!client) return markNone("unconfigured");

  // Jeton d'accès FRAIS : `getSession()` rafraîchit un jeton expiré, alors que
  // l'instantané du store peut dater de plusieurs minutes.
  const fresh = await withTimeout(
    client.auth
      .getSession()
      .then(({ data }) => data.session)
      .catch(() => null),
    STEP_TIMEOUT_MS,
  );
  const accessToken = fresh?.access_token ?? auth.session?.access_token ?? null;
  const subject = fresh?.user?.id ?? auth.session?.user?.id ?? null;
  if (!accessToken || !subject) return markNone("no-session");

  /**
   * Mémo négatif consulté AVANT toute I/O.
   *
   * ⚠️ Placé ici et pas dans le bloc de lecture client : si le navigateur ne
   * peut pas lire `licences` (GRANT/RLS manquants), ce bloc est sauté — le mémo
   * devait donc rester en amont, sinon chaque montage de page repayait un
   * aller-retour serveur pour un compte sans licence (le cas le plus fréquent)
   * jusqu'à épuiser le quota de 30 appels/heure.
   */
  if (readMemo(subject)) return markNone("no-licence");

  /**
   * Lecture CLIENT des licences : ce n'est qu'une OPTIMISATION.
   *
   * Elle sert à trouver une clé échangeable (parcours commercial historique) et
   * à éviter un aller-retour quand l'utilisateur n'a manifestement aucune
   * licence. Elle ne doit JAMAIS décider seule : si elle échoue (RLS, droits
   * manquants, jeton refusé, réseau), seule la lecture SERVEUR fait autorité.
   * ⚠️ Bug corrigé (QA) : on renvoyait « query-failed » ici, donc le pont
   * n'interrogeait jamais `/api/licenses/session` — le seul chemin capable de
   * débloquer un client dont la licence n'a pas de clé. Une erreur de lecture
   * côté navigateur suffisait à le laisser verrouillé à vie.
   */
  const rows = await withTimeout(readLicences(client), STEP_TIMEOUT_MS);

  if (Array.isArray(rows)) {
    const licence = activeLicence(rows);
    if (!licence) {
      // Même règle que le serveur (LIC-BRIDGE-3) : inutile de lui demander.
      writeMemo(subject);
      return markNone("no-licence");
    }

    // 2. Clé échangeable présente ? On garde le parcours commercial historique.
    const key = licenceKeyFromRow(licence);
    if (key && isVerifiableLicenceKey(key)) {
      const granted = await withTimeout(requestContentToken(key, deviceId()), STEP_TIMEOUT_MS);
      if (granted?.ok) return markReady("licence-key");
      console.warn(
        `[content-session] clé refusée pour ${licenceIdentity(licence)}: ${
          granted ? granted.error : "timeout"
        }`,
      );
    }
  }

  // 3. Sinon : pont serveur, qui vérifie la session Supabase et l'état de la
  //    licence. Une clé stockée sous forme de hash n'est pas échangeable, donc
  //    ce chemin est le SEUL qui la débloque.
  const granted = await withTimeout(requestSessionToken(accessToken), STEP_TIMEOUT_MS);
  if (granted?.ok) return markReady("cloud-session");

  if (!granted) return markNone("rejected");
  if (granted.status === 403) {
    // Refus EXPLICITE du serveur : l'utilisateur est authentifié mais n'a aucune
    // licence active. On pose le même mémo que dans le chemin client — sinon
    // chaque montage de page referait l'aller-retour pour un compte sans licence
    // (et un compte sans licence est le cas le PLUS fréquent).
    writeMemo(subject);
    return markNone("no-licence");
  }
  if (granted.status === 401) return markNone("rejected");
  return markNone(granted.status === 0 ? "offline" : "rejected");
}

/**
 * S'assure qu'une session de contenu existe, en essayant TOUS les chemins.
 *
 * Idempotent et dédupliqué : plusieurs composants peuvent l'appeler au même
 * moment (pont du root, /signes, écran verrouillé de /pathologie), un seul
 * aller-retour réseau part.
 */
export function ensureContentSession(): Promise<ContentSessionResult> {
  if (typeof window === "undefined") {
    return Promise.resolve<ContentSessionResult>({ status: "none", reason: "unconfigured" });
  }
  inflight ??= runEnsure()
    .catch(() => markNone("offline"))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Attente « juste ce qu'il faut » avant de charger un contenu protégé.
 *
 * On n'attend QUE si l'utilisateur a probablement une licence (session cloud
 * active ou jeton déjà présent) : un visiteur anonyme voit le bandeau Premium
 * immédiatement, il ne paie pas l'attente d'un pont qui ne le concerne pas.
 */
export async function awaitContentSessionIfLikely(): Promise<void> {
  if (hasContentSession()) return;
  if (snapshot.status === "ready") return;
  if (getCloudAuthSnapshot().status !== "authenticated") return;
  await ensureContentSession().catch(() => undefined);
}

export function subscribeContentSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getContentSessionSnapshot(): ContentSessionSnapshot {
  return snapshot;
}

/** Instantané serveur — constant, donc identique au premier rendu client. */
export function getContentServerSnapshot(): ContentSessionSnapshot {
  return SERVER_SNAPSHOT;
}
