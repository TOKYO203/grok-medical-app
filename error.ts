// ⚠️ DIAGNOSTIC TEMPORAIRE (incident 500 en prod) — À RETIRER après résolution.
// Expose le message + stack de toute erreur serveur dans la réponse, pour
// lire la cause réelle depuis l'extérieur (les logs Worker ne sont pas accessibles).
import { defineErrorHandler } from "nitro";

export default defineErrorHandler((error, event) => {
  const err = error as Error & { stack?: string };
  const path = (() => {
    try {
      return (event as any)?.path ?? (event as any)?.url?.pathname ?? "?";
    } catch {
      return "?";
    }
  })();
  const body = [
    "DIAG " + String(path),
    "name=" + String(err?.name ?? "?"),
    "message=" + String(err?.message ?? err),
    "stack=" + String(err?.stack ?? "").split("\n").slice(0, 12).join(" | "),
  ].join("\n");
  return new Response(body, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
  });
});
