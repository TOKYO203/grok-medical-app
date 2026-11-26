import { createFileRoute } from "@tanstack/react-router";

/** SONDAGE TEMPORAIRE #534 : import dynamique de la grille auth, erreur exposee. */
export const Route = createFileRoute("/api/auth/diag2")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const mod = await import("@/lib/auth/server");
          return new Response(
            JSON.stringify({ ok: true, diag2: 1, keys: Object.keys(mod).slice(0, 12) }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.name + ": " + e.message : String(e);
          const stack = e instanceof Error
            ? (e.stack ?? "").split("\n").slice(0, 6).join(" | ")
            : "";
          return new Response(JSON.stringify({ ok: false, message, stack }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
