import { createFileRoute } from "@tanstack/react-router";
import { clearAdminSessionCookie } from "@/lib/security/admin-auth.server";

/**
 * `POST /api/admin-logout` — efface le cookie de session admin (HttpOnly ne
 * peut pas être effacé par le client). Pentest 2026-11-09 §5.
 */
export const Route = createFileRoute("/api/admin-logout")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Set-Cookie": clearAdminSessionCookie(),
          },
        });
      },
    },
  },
});
