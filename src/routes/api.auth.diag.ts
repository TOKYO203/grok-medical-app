import { createFileRoute } from "@tanstack/react-router";

/** SONDAGE TEMPORAIRE #534 : jamais atteint si le dispatch /api/auth/* est casse. */
export const Route = createFileRoute("/api/auth/diag")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, diag: 1 }), {
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
