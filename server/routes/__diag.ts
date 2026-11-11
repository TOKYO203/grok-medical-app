// TEMPORAIRE : route de diagnostic du 500 prod. A retirer une fois la cause trouvee.
const targets: Array<[string, () => Promise<unknown>]> = [
  ["src/lib/auth/server", () => import("../../src/lib/auth/server")],
  ["src/server/supabase-env.server", () => import("../../src/server/supabase-env.server")],
  ["src/server/license-signing-key.server", () => import("../../src/server/license-signing-key.server")],
  ["src/server/licence-session.server", () => import("../../src/server/licence-session.server")],
  ["src/lib/db", () => import("../../src/lib/db")],
  ["src/lib/security/rate-limit.server", () => import("../../src/lib/security/rate-limit.server")],
  ["src/content/international", () => import("../../src/content/international")],
  ["src/lib/supabase", () => import("../../src/lib/supabase")],
  ["virtual:grok-og-identity", () => import("virtual:grok-og-identity")],
];

function fmt(name: string, e: unknown) {
  const err = e as { name?: string; message?: string; stack?: string };
  return name + " -> " + (err?.name ?? "?") + ": " + (err?.message ?? String(e)) + "\n" + (err?.stack ?? "").split("\n").slice(0, 6).join("\n");
}

export default defineEventHandler(async () => {
  const lines: string[] = ["DIAG OK - handler atteint"];
  for (const [name, load] of targets) {
    try {
      await load();
      lines.push(name + " -> OK");
    } catch (e) {
      lines.push(fmt(name, e));
    }
  }
  setResponseHeader(event, "content-type", "text/plain; charset=utf-8");
  setResponseHeader(event, "x-robots-tag", "noindex");
  return lines.join("\n");
});
