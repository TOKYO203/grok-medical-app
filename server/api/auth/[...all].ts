import { defineEventHandler } from "h3";
import { getAuth } from "@/lib/auth/server";

/** TEMP #534 : sondage du catch-all Nitro (propriete Request + erreur better-auth). */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function dbUrlDiagnostics(): Record<string, unknown> {
  const raw = process.env.DATABASE_URL;
  const out: Record<string, unknown> = { present: typeof raw === "string" && raw.length > 0 };
  if (typeof raw === "string" && raw.length > 0) {
    const trimmed = raw.trim();
    out.sameWhenTrimmed = trimmed === raw;
    out.length = raw.length;
    out.hasNewline = raw !== raw.replace(/\r?\n/g, "");
    out.hasQuotes = raw.startsWith(String.fromCharCode(34));
    try {
      const url = new URL(trimmed);
      out.parsesAsUrl = true;
      out.protocol = url.protocol;
      out.hasHost = url.hostname.length > 0;
      out.hasPath = url.pathname.replace(/^\//, "").length > 0;
      out.stackInsideHost = url.hostname.startsWith("aws-");
    } catch (e) {
      out.parsesAsUrl = false;
      out.urlError = e instanceof Error ? e.name + ": " + e.message : String(e);
    }
  }
  return out;
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
    void dbUrlDiagnostics;
    return json({
      nitro: "live",
      reqType: request ? (request.constructor?.name ?? "?") : "absent",
      hasNodeReq: Boolean(anyEvent.node?.req),
      path,
      delegated,
      dbUrl: typeof process.env.DATABASE_URL === "string" ? dbUrlDiagnostics() : "absent",
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
