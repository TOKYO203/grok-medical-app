import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/checkout/ariari")({
  server: {
    handlers: {
      POST: async () => Response.json({ ok: true, debug: "minimal" }),
    },
  },
});
