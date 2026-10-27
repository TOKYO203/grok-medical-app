import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth/server";
import { isAriariConfigured } from "@/server/ariari/ariari.server";

export const Route = createFileRoute("/api/checkout/ariari")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const trace: string[] = [];

        // Étape 1 : getAuth()
        let auth;
        try {
          trace.push("step1: before getAuth()");
          auth = getAuth();
          trace.push("step1: getAuth() OK");
        } catch (e) {
          return Response.json({
            ok: false,
            failedAt: "getAuth",
            trace,
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
          }, { status: 500 });
        }

        // Étape 2 : auth.api.getSession()
        let session;
        try {
          trace.push("step2: before getSession()");
          session = await auth.api.getSession({ headers: request.headers });
          trace.push(`step2: getSession() OK, user=${session?.user ? "yes" : "no"}`);
        } catch (e) {
          return Response.json({
            ok: false,
            failedAt: "getSession",
            trace,
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
          }, { status: 500 });
        }

        // Étape 3 : isAriariConfigured()
        let ariariConfigured = false;
        try {
          trace.push("step3: before isAriariConfigured()");
          ariariConfigured = isAriariConfigured();
          trace.push(`step3: ariariConfigured=${ariariConfigured}`);
        } catch (e) {
          return Response.json({
            ok: false,
            failedAt: "isAriariConfigured",
            trace,
            error: e instanceof Error ? e.message : String(e),
          }, { status: 500 });
        }

        return Response.json({
          ok: true,
          trace,
          hasUser: Boolean(session?.user),
          ariariConfigured,
        });
      },
    },
  },
});
