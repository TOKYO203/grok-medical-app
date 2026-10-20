import { loadSupabase } from "@/lib/supabase";
import { decideCloudSync, removeSyncedEvents } from "@/lib/cloud/sync-policy";
import {
  diagnoseSyncError,
  syncTargetLabel,
  type SyncErrorDiagnosis,
} from "@/lib/cloud/sync-error";
import { useOptimus } from "@/state/store";

/**
 * Synchronisation de la progression locale vers Supabase.
 *
 * Deux pièges de `@supabase/supabase-js` que ce module corrige :
 *
 *  1. **Aucune exception n'est levée** : PostgREST renvoie `{ error }`. Un
 *     `try/catch` autour d'un `.upsert()` ne voit donc JAMAIS un échec — et
 *     l'ancienne version vidait la file juste après, en perdant les données.
 *     Ici chaque appel est contrôlé via `error`, et la file n'est purgée
 *     qu'après un succès COMPLET.
 *  2. **Hors-ligne** : on sort avant tout appel réseau. La file et les données
 *     locales restent intactes, la prochaine sync (au retour du réseau)
 *     enverra le tout.
 */

const SYNC_INTERVAL_MS = 60_000;

export type CloudSyncResult =
  | { status: "synced"; pushed: number }
  | { status: "skipped"; reason: "unconfigured" | "offline" | "signed-out" | "empty" }
  | {
      status: "failed";
      reason: "session" | "progressions" | "profiles";
      /** Diagnostic lisible : jamais un dump technique, jamais muet. */
      diagnosis: SyncErrorDiagnosis;
    };

/** Dernier résultat — lu par l'interface (état de synchronisation du profil). */
let lastResult: CloudSyncResult | null = null;

export function lastCloudSyncResult(): CloudSyncResult | null {
  return lastResult;
}

function isOnline(): boolean {
  // `navigator.onLine === false` est fiable dans un sens : s'il dit hors-ligne,
  // on est hors-ligne. S'il dit en ligne, l'appel peut encore échouer — et dans
  // ce cas la file est conservée.
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

type ProgressRow = {
  user_id: string;
  deck_id: string;
  seen: Record<string, unknown>;
  completed_lessons: number[];
  updated_at: string;
};

function buildProgressRows(userId: string): ProgressRow[] {
  const state = useOptimus.getState();
  const updatedAt = new Date().toISOString();
  return Object.entries(state.progress).map(([deckId, progress]) => ({
    user_id: userId,
    deck_id: deckId,
    seen: progress.seen,
    completed_lessons: progress.completedLessons,
    updated_at: updatedAt,
  }));
}

/**
 * Lance une synchronisation et mémorise le résultat (lu par l'interface).
 * Ne rejette jamais : toute issue est un `CloudSyncResult`.
 */
export async function syncWithCloud(): Promise<CloudSyncResult> {
  const result = await runSync();
  lastResult = result;
  return result;
}

async function runSync(): Promise<CloudSyncResult> {
  const queueLength = useOptimus.getState().syncQueue.length;

  // Hors-ligne : on sort AVANT de charger le SDK et avant tout appel réseau.
  if (!isOnline()) return { status: "skipped", reason: "offline" };

  const client = await loadSupabase();
  if (!client) return { status: "skipped", reason: "unconfigured" };

  // Une session illisible (jeton expiré, horloge décalée, stockage corrompu)
  // n'est PAS une panne réseau : on le dit à l'utilisateur au lieu d'échouer muet.
  const sessionDiagnosis = () =>
    diagnoseSyncError(
      { code: "PGRST116", message: "invalid claim: jwt expired" },
      syncTargetLabel("progressions"),
    );

  let userId: string;
  let userEmail: string | null = null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn("[cloud-sync] session:", error.message);
      return { status: "failed", reason: "session", diagnosis: sessionDiagnosis() };
    }
    if (!data.session) return { status: "skipped", reason: "signed-out" };
    userId = data.session.user.id;
    userEmail = data.session.user.email ?? null;
  } catch {
    return { status: "failed", reason: "session", diagnosis: sessionDiagnosis() };
  }

  // Les trois premières conditions sont déjà prouvées ci-dessus ; on laisse la
  // MÊME fonction que celle testée trancher (dont « file vide »).
  const decision = decideCloudSync({
    configured: true,
    online: true,
    hasSession: true,
    queueLength,
  });
  if (decision.action === "skip") return { status: "skipped", reason: decision.reason };

  // Instantané de la file AVANT l'envoi : tout événement ajouté pendant les
  // requêtes (réponse à une carte, etc.) ne sera pas perdu.
  const queued = useOptimus.getState().syncQueue;
  const sentIds = queued.map((event) => event.id);

  const progressRows = buildProgressRows(userId);
  if (progressRows.length > 0) {
    const { error } = await client
      .from("progressions")
      .upsert(progressRows, { onConflict: "user_id,deck_id" });
    if (error) {
      // On journalise le code Postgres (utile au support) mais l'interface ne
      // reçoit qu'un message compréhensible.
      console.warn("[cloud-sync] progressions:", error.code, error.message);
      return {
        status: "failed",
        reason: "progressions",
        diagnosis: diagnoseSyncError(error, syncTargetLabel("progressions")),
      };
    }
  }

  const state = useOptimus.getState();
  const { error: profileError } = await client.from("profiles").upsert(
    {
      id: userId,
      email: userEmail,
      display_name: state.profile.displayName,
      stats: {
        xp: state.xp,
        streak: state.streak,
        casesCompleted: state.casesCompleted,
        badges: state.badges,
      },
    },
    { onConflict: "id" },
  );
  if (profileError) {
    console.warn("[cloud-sync] profiles:", profileError.code, profileError.message);
    return {
      status: "failed",
      reason: "profiles",
      diagnosis: diagnoseSyncError(profileError, syncTargetLabel("profiles")),
    };
  }

  // Succès complet : on ne retire QUE ce qui a été envoyé.
  useOptimus.setState((current) => ({
    syncQueue: removeSyncedEvents(current.syncQueue, sentIds),
  }));

  return { status: "synced", pushed: sentIds.length };
}

type SyncLoopHandle = { stop: () => void };

let activeLoop: SyncLoopHandle | null = null;

/**
 * Boucle de synchronisation (60 s + retour du réseau).
 *
 * Renvoie une fonction d'arrêt et refuse les boucles concurrentes : l'ancienne
 * version créait un `setInterval` supplémentaire à chaque changement de session,
 * sans jamais les nettoyer (fuite + appels concurrents).
 */
export function startSyncLoop(intervalMs: number = SYNC_INTERVAL_MS): () => void {
  if (typeof window === "undefined") return () => {};
  if (activeLoop) return activeLoop.stop;

  const run = () => {
    void syncWithCloud().catch(() => {
      // Jamais d'exception non gérée : la file est conservée pour la prochaine fois.
    });
  };

  const timer = window.setInterval(run, intervalMs);
  window.addEventListener("online", run);

  const stop = () => {
    window.clearInterval(timer);
    window.removeEventListener("online", run);
    if (activeLoop?.stop === stop) activeLoop = null;
  };

  activeLoop = { stop };
  return stop;
}
