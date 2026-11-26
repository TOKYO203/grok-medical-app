import { defineEventHandler } from "h3";
import { getAuth } from "@/lib/auth/server";

/** TEMP #534 : sondage du catch-all Nitro (propriete Request + erreur better-auth). */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default defineEventHandler(async (event) => {
  const anyEvent = event as unknown as {
    req?: unknown;
    request?: unknown;
    node?: { req?: unknown };
  };
  const request =
    anyEvent.req instanceof Request
      ? anyEvent.req
      : anyEvent.request instanceof Request
        ? anyEvent.request
        : undefined;
  const path = request ? new URL(request.url).pathname : "inconnu";
  if (path.endsWith("/nitro-probe")) {
    let delegated = "non teste";
    if (request) {
      try {
        const response = await getAuth().handler(request);
        delegated = "status=" + response.status;
      } catch (e) {
        delegated =
          "THROWN " + (e instanceof Error ? e.name + ": " + e.message : String(e));
      }
    }
    return json({
      nitro: "live",
      reqType: request ? (request.constructor?.name ?? "?") : "absent",
      hasNodeReq: Boolean(anyEvent.node?.req),
      path,
      delegated,
      lastAuthError: (await import("@/lib/auth/server") as any).lastAuthError?.() ?? null,
    });
  }
  try {
    if (!request) return json({ error: "no-web-request", path }, 500);
    return await getAuth().handler(request);
  } catch (e) {
    return json({
      error: "auth-handler-failed",
      detail: e instanceof Error ? e.name + ": " + e.message : String(e),
    }, 500);
  }
});
