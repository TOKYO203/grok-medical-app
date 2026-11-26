/**
 * Alerte d'erreur serveur — sans SDK, sans dépendance, sans fuite de données.
 *
 * POURQUOI CE MODULE
 * `server/middleware/00-observability.ts` journalise déjà chaque requête en JSON
 * structuré avec un `x-request-id`, mais **personne ne lit les logs** : un 500
 * isolé ne réveille personne. Ce module transforme une erreur serveur en un
 * message court envoyé à un webhook (Slack, Discord, Teams, n8n…), sans jamais
 * inclure de corps de requête, d'en-tête, de cookie, d'IP ni d'identifiant
 * utilisateur.
 *
 * GARDE-FOUS
 *   • désactivé si `ERROR_ALERT_WEBHOOK` n'est pas configuré ;
 *   • jamais bloquant : l'envoi est « fire and forget », l'erreur d'envoi est
 *     avalée (une alerte qui casse la réponse serait pire que le silence) ;
 *   • anti-bruit : une même signature (chemin + nom d'erreur) n'est envoyée
 *     qu'une fois par fenêtre (60 s par défaut), table bornée ;
 *   • timeout court (2 s) pour ne pas retenir l'isolate.
 */

export type ErrorAlertInput = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  errorName: string;
  durationMs: number;
};

export type ErrorAlert = ErrorAlertInput & {
  type: "server_error";
  at: string;
};

export type AlertTransport = (url: string, body: string) => Promise<unknown>;

const MAX_PATH_LENGTH = 200;
const MAX_REQUEST_ID_LENGTH = 128;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_THROTTLE_ENTRIES = 100;
const WEBHOOK_TIMEOUT_MS = 2_000;

/** Chemin journalisable : sans query string (elle peut contenir un jeton). */
export function sanitizePath(path: string): string {
  const withoutQuery = (path ?? "").split("?")[0] ?? "/";
  const trimmed = withoutQuery.trim();
  if (!trimmed) return "/";
  return trimmed.slice(0, MAX_PATH_LENGTH);
}

export function buildErrorAlert(input: ErrorAlertInput, now: Date = new Date()): ErrorAlert {
  const status = Number.isFinite(input.status) ? Math.trunc(input.status) : 0;
  return {
    type: "server_error",
    requestId: (input.requestId || "unknown").slice(0, MAX_REQUEST_ID_LENGTH),
    method: (input.method || "GET").toUpperCase().slice(0, 10),
    path: sanitizePath(input.path),
    status: Math.max(0, status),
    errorName: (input.errorName || "UnknownError").slice(0, 100),
    durationMs: Math.max(0, Math.round(input.durationMs || 0)),
    at: now.toISOString(),
  };
}

/** Message lisible, identique pour Slack (`text`) et Discord (`content`). */
export function formatAlertText(alert: ErrorAlert): string {
  const label = alert.status >= 500 ? `HTTP ${alert.status}` : "exception";
  return `[Optimus] ${label} · ${alert.method} ${alert.path} · ${alert.errorName} · requestId ${alert.requestId} · ${alert.durationMs} ms`;
}

const lastSentAt = new Map<string, number>();

/** Remise à zéro (tests uniquement). */
export function resetAlertThrottle(): void {
  lastSentAt.clear();
}

/**
 * `true` si cette signature peut être envoyée maintenant.
 * L'appel enregistre l'envoi (même si le transport échoue ensuite) : un webhook
 * cassé ne doit pas provoquer une tempête de tentatives.
 */
export function shouldSendAlert(
  alert: Pick<ErrorAlert, "path" | "errorName">,
  nowMs: number = Date.now(),
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const key = `${alert.path}|${alert.errorName}`;
  const previous = lastSentAt.get(key);
  if (previous !== undefined && nowMs - previous < windowMs) return false;
  lastSentAt.set(key, nowMs);
  if (lastSentAt.size > MAX_THROTTLE_ENTRIES) {
    let oldestKey: string | undefined;
    let oldestValue = Number.POSITIVE_INFINITY;
    for (const [candidate, sentAt] of lastSentAt) {
      if (sentAt < oldestValue) {
        oldestValue = sentAt;
        oldestKey = candidate;
      }
    }
    if (oldestKey) lastSentAt.delete(oldestKey);
  }
  return true;
}

async function defaultTransport(url: string, body: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envoie l'alerte si un webhook est configuré et si l'anti-bruit l'autorise.
 * Ne lève jamais : renvoie `true` seulement si le transport a réussi.
 */
export async function sendErrorAlert(
  alert: ErrorAlert,
  options: {
    webhookUrl?: string;
    transport?: AlertTransport;
    nowMs?: number;
    windowMs?: number;
  } = {},
): Promise<boolean> {
  const webhookUrl = (options.webhookUrl ?? "").trim();
  if (!webhookUrl) return false;
  if (!shouldSendAlert(alert, options.nowMs ?? Date.now(), options.windowMs)) return false;

  const text = formatAlertText(alert);
  const body = JSON.stringify({ text, content: text, alert });
  const transport = options.transport ?? defaultTransport;
  try {
    await transport(webhookUrl, body);
    return true;
  } catch {
    // Volontairement silencieux : la réponse HTTP ne doit jamais dépendre de
    // la disponibilité du service d'alerte.
    return false;
  }
}
