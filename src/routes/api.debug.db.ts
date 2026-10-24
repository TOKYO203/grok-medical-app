import { createFileRoute } from "@tanstack/react-router";
import { getSql, dbSource } from "@/lib/db";

export const Route = createFileRoute("/api/debug/db" as never)({
  server: {
    handlers: {
      GET: async () => {
        if (dbSource !== "postgres") {
          return new Response(JSON.stringify({ status: "error", reason: "not-postgres", source: dbSource }), { status: 503, headers: { "content-type": "application/json" } });
        }
        try {
          const sql = await getSql();
          const rows = await sql.query("select 1 as ok");
          return new Response(JSON.stringify({ status: "ok", rows }), { status: 200, headers: { "content-type": "application/json" } });
        } catch (err) {
          const e = err as Error & { code?: string; errno?: string };
          return new Response(JSON.stringify({ status: "error", message: e.message, code: e.code, name: e.name }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
