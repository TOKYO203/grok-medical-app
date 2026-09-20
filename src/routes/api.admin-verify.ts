import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { adminKey?: string };
        const key = (body?.adminKey ?? "").trim();
        const expected = (process.env.ADMIN_PASSWORD ?? "").trim();

        return new Response(
          JSON.stringify({
            valid: expected.length > 0 && key === expected,
            debug: {
              envDefined: expected.length > 0,
              envLength: expected.length,
              keyLength: key.length,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
