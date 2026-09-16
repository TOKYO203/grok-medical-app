interface ObservabilityEvent {
  url: URL;
  req: { method: string; headers: Headers };
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
 * Minimal production-safe observability baseline.
 *
 * We intentionally never log query strings, bodies, cookies, authorization,
 * user identifiers or IP addresses. API requests receive a correlation id so
 * a client-side error report can be matched with platform logs without
 * exposing medical or authentication data.
 */
export default async function observabilityMiddleware(
  event: ObservabilityEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const startedAt = Date.now();
  const requestId = event.req.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
  const method = event.req.method || "GET";
  const path = event.url.pathname;
  const isApi = path.startsWith("/api/") || path === "/api";

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

    return withRequestId(result, requestId);
  } catch (error) {
    logJson("error", {
      type: "http_error",
      requestId,
      method,
      path,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
