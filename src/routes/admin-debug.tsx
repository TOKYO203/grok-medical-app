import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { getAdminSession, getAdminSessionState, setAdminKey, clearAdminKey } from "@/routes/admin-login";

export const Route = createFileRoute("/admin-debug")({ component: AdminDebugPage });

function AdminDebugPage() {
  const [raw, setRaw] = useState<string>("(vide)");
  const [state, setState] = useState<string>("none");
  const [now, setNow] = useState(Date.now());

  function refresh() {
    if (typeof window === "undefined") return;
    setRaw(window.localStorage.getItem("optimus.admin.session.v2") ?? "(vide)");
    setState(getAdminSessionState());
    setNow(Date.now());
  }

  useEffect(() => { refresh(); }, []);

  const session = getAdminSession();
  const expired = state === "expired";
  const valid = state === "valid";

  return (
    <Shell title="Admin Debug">
      <Page className="mx-auto max-w-2xl">
        <h1 className="mt-6 font-display text-2xl">Debug session admin</h1>
        <p className="mt-2 text-sm text-muted">
          Cette page est temporaire — à supprimer après validation.
        </p>

        <div className="mt-6 space-y-3 rounded-lg border border-border bg-bg-elevated p-4 text-sm">
          <div><strong>État :</strong> <span className={valid ? "text-green-500" : expired ? "text-amber-500" : "text-muted"}>{state}</span></div>
          <div><strong>Maintenant :</strong> {now} ({new Date(now).toISOString()})</div>
          <div className="break-all"><strong>Raw :</strong> <code className="text-xs">{raw}</code></div>
          {session && (
            <>
              <div><strong>Token :</strong> <code>{session.token}</code></div>
              <div><strong>Créée :</strong> {new Date(session.createdAt).toISOString()}</div>
              <div><strong>Expire :</strong> {new Date(session.expiresAt).toISOString()}</div>
              <div><strong>Reste :</strong> {Math.max(0, Math.round((session.expiresAt - now) / 1000 / 3600))} h</div>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={refresh} className="rounded bg-primary px-4 py-2 text-sm text-primary-fg">
            Rafraîchir
          </button>
          <button onClick={() => { setAdminKey("Mandresy@#01"); refresh(); }} className="rounded bg-primary px-4 py-2 text-sm text-primary-fg">
            Simuler login (7j)
          </button>
          <button onClick={() => {
            if (typeof window === "undefined") return;
            const s = getAdminSession();
            if (s) {
              window.localStorage.setItem("optimus.admin.session.v2", JSON.stringify({ ...s, expiresAt: 0, createdAt: 0 }));
              refresh();
            }
          }} className="rounded bg-amber-500 px-4 py-2 text-sm text-white">
            Simuler expiration
          </button>
          <button onClick={() => { clearAdminKey(); refresh(); }} className="rounded bg-red-500 px-4 py-2 text-sm text-white">
            Déconnexion
          </button>
        </div>

        <div className="mt-6 flex gap-3 text-sm">
          <Link to="/admin" className="text-primary underline">→ /admin</Link>
          <Link to="/admin-login" className="text-primary underline">→ /admin-login</Link>
        </div>
      </Page>
    </Shell>
  );
}
