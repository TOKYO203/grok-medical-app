import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  listContentReportsForAdmin,
  reviewContentReport,
  type AdminContentReport,
  type ContentReportStatus,
} from "@/lib/content-reports-admin";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAdminKey, getAdminSessionState } from "@/routes/admin-login";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-reports")({ component: AdminReportsPage });

const STATUS_LABEL: Record<ContentReportStatus, string> = {
  new: "Nouveau",
  reviewing: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
};

const STATUS_STYLE: Record<ContentReportStatus, string> = {
  new: "bg-red-500/15 text-red-400 border-red-500/40",
  reviewing: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  rejected: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
};

function AdminReportsPage() {
  const nav = useNavigate();
  const adminKey = getAdminKey();
  const sessionState = getAdminSessionState();

  useEffect(() => {
    if (!adminKey) {
      nav({ to: "/admin-login" });
    }
  }, [adminKey, nav]);

  if (!adminKey) {
    const expired = sessionState === "expired";
    return (
      <Shell title="Admin">
        <Page className="mx-auto max-w-md">
          <div className="mt-10 text-center">
            <h1 className="mt-4 font-display text-2xl">
              {expired ? "Session expirée" : "Accès administrateur"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {expired
                ? "Ta session a expiré. Redirection…"
                : "Redirection vers la page de connexion…"}
            </p>
          </div>
        </Page>
      </Shell>
    );
  }
  const [reports, setReports] = useState<AdminContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState<ContentReportStatus | "all">("new");
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listContentReportsForAdmin({ data: { adminKey, status: filter } });
      setReports(result);
      setForbidden(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setForbidden(/forbidden/i.test(message));
      if (!/forbidden/i.test(message)) {
        console.error("[admin-reports] Erreur chargement:", message);
        toast.error(`Erreur : ${message.slice(0, 100)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatus(id: string, status: ContentReportStatus) {
    setActing(id);
    try {
      await reviewContentReport({ data: { adminKey, id, status } });
      toast.success(`Signalement ${STATUS_LABEL[status].toLowerCase()}`);
      await refresh();
    } catch {
      toast.error("Action impossible");
    } finally {
      setActing(null);
    }
  }

  if (forbidden) {
    return (
      <Shell title="Admin — Signalements">
        <Page className="mx-auto max-w-lg">
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-red-500/30 bg-red-500/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
            <div>
              <p className="text-sm font-medium text-red-400">Accès refusé</p>
              <p className="mt-1 text-xs text-red-300/70">
                Cette page est réservée aux administrateurs. Ajoutez votre identifiant dans
                PURCHASE_ADMIN_USER_IDS.
              </p>
            </div>
          </div>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell title="Admin — Signalements">
      <Page>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">
              Signalements de contenu
            </h1>
            <p className="mt-1 text-sm text-muted">
              {reports.length} signalement{reports.length > 1 ? "s" : ""} · filtre{" "}
              <span className="font-medium">{filter === "all" ? "Tous" : STATUS_LABEL[filter]}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Rafraîchir"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted transition-colors hover:text-fg"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          </button>
        </div>

        {/* Filtres */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(["new", "reviewing", "resolved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "h-9 rounded-full px-3 text-xs transition-colors",
                filter === s
                  ? "bg-primary text-primary-fg"
                  : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-fg",
              )}
            >
              {s === "all" ? "Tous" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Chargement…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-subtle">Aucun signalement dans cette catégorie.</p>
          ) : (
            reports.map((r) => (
              <article
                key={r.id}
                className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          STATUS_STYLE[r.status],
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
                        {r.issueLabel}
                      </span>
                      <span className="font-mono text-[10px] text-subtle">
                        {r.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{r.label}</p>
                    {r.details ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{r.details}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-subtle">
                      Deck : {r.deckId ?? "—"}
                      {r.deckVersion ? ` · v${r.deckVersion}` : ""} · Question : {r.contentId}
                    </p>
                    <p className="mt-0.5 text-[10px] text-subtle">
                      {new Date(r.createdAt).toLocaleString("fr-FR")} · user {r.userId.slice(0, 8)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.deckId ? (
                    <Link
                      to="/parcours/$deckId"
                      params={{ deckId: r.deckId }}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
                    >
                      Voir le deck →
                    </Link>
                  ) : null}
                  {r.status === "new" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acting === r.id}
                      onClick={() => void setStatus(r.id, "reviewing")}
                    >
                      <AlertTriangle className="size-3.5" /> Prendre en charge
                    </Button>
                  ) : null}
                  {r.status !== "resolved" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acting === r.id}
                      onClick={() => void setStatus(r.id, "resolved")}
                    >
                      <CheckCircle2 className="size-3.5" /> Résolu
                    </Button>
                  ) : null}
                  {r.status !== "rejected" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acting === r.id}
                      onClick={() => void setStatus(r.id, "rejected")}
                    >
                      <XCircle className="size-3.5" /> Rejeter
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </Page>
    </Shell>
  );
}
