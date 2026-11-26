import { buildErrorAlert, sendErrorAlert } from "../lib/error-alert";

interface ObservabilityEvent {
  url?: URL;
  path?: string;
  req: { method: string; headers: Headers };
}

function eventPath(event: ObservabilityEvent): string {
  try {
    return event.path ?? event.url?.pathname ?? "/";
  } catch {
    return "/";
  }
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function logJson(level: "info" | "error", payload: Record<string, unknown>) {
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else console.info(line);
}

/**
 * Webhook d'alerte (Slack/Discord/Teams/n8n…). Absent = aucune alerte, jamais
 * d'erreur : un environnement sans monitoring ne doit pas se comporter
 * différemment d'un environnement surveillé.
 */
function alertWebhook(): string {
  try {
    return (process.env.ERROR_ALERT_WEBHOOK ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Alerte « fire and forget » : la réponse HTTP ne doit jamais attendre ni
 * dépendre du service d'alerte. Toute erreur du transport est avalée par
 * `sendErrorAlert`.
 */
function notifyServerError(input: {
  requestId: string;
  method: string;
  path: string;
  status: number;
  errorName: string;
  durationMs: number;
}) {
  const webhookUrl = alertWebhook();
  if (!webhookUrl) return;
  const alert = buildErrorAlert(input);
  void sendErrorAlert(alert, { webhookUrl });
}

/**
 * Minimal production-safe observability baseline.
 *
 * We intentionally never log query strings, bodies, cookies, authorization,
 * user identifiers or IP addresses. API requests receive a correlation id so
 * a client-side error report can be matched with platform logs without
 * exposing medical or authentication data.
 *
 * Depuis le 2026-11-12 : une erreur serveur (exception ou réponse 5xx) est
 * aussi poussée vers `ERROR_ALERT_WEBHOOK` (voir `server/lib/error-alert.ts`),
 * une seule fois par signature et par minute, sans corps ni identité.
 */
export default async function observabilityMiddleware(
  event: ObservabilityEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const startedAt = Date.now();
  let requestId = "";
  try {
    requestId = event.req.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
  } catch {
    requestId = "unknown";
  }
  const method = event.req?.method || "GET";
  const path = eventPath(event);
  const isApi = path.startsWith("/api/") || path === "/api";
  let alerted = false;

  try {
    const result = await next();
    if (!(result instanceof Response)) return result;

    const durationMs = Date.now() - startedAt;
    const status = result.status;

    if (isApi || status >= 500) {
      logJson(status >= 500 ? "error" : "info", {
        type: "http_request",
        requestId,
        method,
        path,
        status,
        durationMs,
      });
    }

    if (status >= 500 && !alerted) {
      alerted = true;
      notifyServerError({
        requestId,
        method,
        path,
        status,
        errorName: "ServerResponse",
        durationMs,
      });
    }

    return withRequestId(result, requestId);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logJson("error", {
      type: "http_error",
      requestId,
      method,
      path,
      durationMs,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    if (!alerted) {
      alerted = true;
      notifyServerError({
        requestId,
        method,
        path,
        status: 0,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs,
      });
    }
    throw error;
  }
}
