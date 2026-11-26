import { createFileRoute } from "@tanstack/react-router";

/** SONDAGE #534 : import pas a pas des modules du graphe auth. */
export const Route = createFileRoute("/api/auth/diag2")({
  server: {
    handlers: {
      GET: async () => {
        const results: Record<string, string> = {};
        const targets: [string, string][] = [
          ["kysely", "kysely"],
          ["react-start-server", "@tanstack/react-start/server"],
          ["better-auth", "better-auth"],
          ["better-auth-api", "better-auth/api"],
          ["better-auth-plugins", "better-auth/plugins"],
          ["better-auth-cookies", "better-auth/cookies"],
          ["better-auth-oauth2", "better-auth/oauth2"],
          ["better-auth-tanstack", "better-auth/tanstack-start"],
          ["kysely-adapter", "@better-auth/kysely-adapter"],
          ["pg", "pg"],
          ["db-module", "@/lib/db"],
          ["auth-server", "@/lib/auth/server"],
        ];
        for (const [label, specifier] of targets) {
          try {
            await import(/* @vite-ignore */ specifier);
            results[label] = "OK";
          } catch (e: unknown) {
            results[label] = e instanceof Error ? e.name + ": " + e.message : String(e);
            break;
          }
        }
        return new Response(JSON.stringify(results, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
