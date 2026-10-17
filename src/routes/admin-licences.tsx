import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Plus, RefreshCw, ShieldAlert, ShieldOff, Copy } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminKey, getAdminSessionState } from "@/routes/admin-login";
import { useLocale, type Locale } from "@/i18n";
import { formatFullDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listActivationKeysForAdmin,
  issueLicense,
  revokeLicense,
  type AdminLicense,
  type AdminLicenseStatus,
} from "@/lib/activation-keys-admin";

export const Route = createFileRoute("/admin-licences")({
  component: AdminLicensesPage,
});

const STATUS_LABEL: Record<AdminLicenseStatus, string> = {
  pending: "En attente",
  active: "Active",
  expired: "Expirée",
  revoked: "Révoquée",
};

const STATUS_STYLE: Record<AdminLicenseStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
  revoked: "bg-red-500/15 text-red-400 border-red-500/40",
};

type Filter = "all" | AdminLicenseStatus;

function formatDate(ms: number | null, locale: Locale): string {
  if (!ms) return "—";
  return formatFullDate(ms, locale);
}

function daysLeft(ms: number | null): number | null {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}

function AdminLicensesPage() {
  const adminKey = getAdminKey();
  const sessionState = getAdminSessionState();
  const locale = useLocale();

  const [items, setItems] = useState<AdminLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [acting, setActing] = useState<string | null>(null);

  // Formulaire de génération
  const [genOptimusId, setGenOptimusId] = useState("OM-");
  const [genDays, setGenDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const result = await listActivationKeysForAdmin({ data: { adminKey, filter, limit: 200 } });
      setItems(result);
      setForbidden(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setForbidden(/forbidden/i.test(message));
      if (!/forbidden/i.test(message)) toast.error("Impossible de charger les licences");
    } finally {
      setLoading(false);
    }
  }, [filter, adminKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generate() {
    if (!adminKey) return;
    const id = genOptimusId.trim().toUpperCase();
    if (!/^OM-[A-F0-9]{8}$/.test(id)) {
      toast.error("Optimus ID invalide (format OM-XXXXXXXX)");
      return;
    }
    setGenerating(true);
    try {
      const result = await issueLicense({
        data: { adminKey, optimusId: id, days: genDays, product: "OPTIMUS_PRO" },
      });
      setLastGeneratedKey(result.key);
      toast.success(`Clé générée pour ${result.optimusId}`);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/forbidden/i.test(message)) {
        setForbidden(true);
        toast.error("Session admin invalide");
      } else {
        toast.error(message.slice(0, 100));
      }
    } finally {
      setGenerating(false);
    }
  }

  async function revoke(id: string) {
    if (!adminKey) return;
    setActing(id);
    try {
      await revokeLicense({ data: { adminKey, id } });
      toast.success("Licence révoquée");
      await refresh();
    } catch {
      toast.error("Révoquer impossible");
    } finally {
      setActing(null);
    }
  }

  async function copyKey() {
    if (!lastGeneratedKey) return;
    try {
      await navigator.clipboard.writeText(lastGeneratedKey);
      toast.success("Clé copiée");
    } catch {
      toast.error("Copie impossible");
    }
  }

  const counts = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) => i.status === "active").length,
      pending: items.filter((i) => i.status === "pending").length,
      revoked: items.filter((i) => i.status === "revoked").length,
    };
  }, [items]);

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
              Connecte-toi pour gérer les licences.
            </p>
            <Link
              to="/admin-login"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-primary px-6 py-3 text-sm font-medium text-primary-fg"
            >
              Se connecter
            </Link>
          </div>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell title="Licences">
      <Page className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Back-office
            </p>
            <h1 className="font-display text-2xl font-medium tracking-tight">Licences</h1>
          </div>
          <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted">
          Génère, surveille et révoque les clés d'accès Optimus Pro.
        </p>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: counts.total },
            { label: "Actives", value: counts.active, tone: "text-emerald-400" },
            { label: "En attente", value: counts.pending, tone: "text-amber-400" },
            { label: "Révoquées", value: counts.revoked, tone: "text-red-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-border)]">
              <p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{kpi.label}</p>
              <p className={cn("mt-1 font-mono text-xl tabular-nums", kpi.tone)}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Générateur */}
        <section className="mt-8 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Générer une clé
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_100px_auto]">
            <Input
              placeholder="OM-XXXXXXXX"
              value={genOptimusId}
              onChange={(e) => setGenOptimusId(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Input
              type="number"
              min={1}
              max={730}
              value={genDays}
              onChange={(e) => setGenDays(parseInt(e.target.value, 10) || 30)}
            />
            <Button onClick={() => void generate()} disabled={generating}>
              <Plus className="size-4" />
              {generating ? "…" : "Générer"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[30, 90].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGenDays(preset)}
                className={cn(
                  "h-8 rounded-[var(--radius-md)] px-3 text-xs font-medium transition-colors",
                  genDays === preset ? "bg-primary text-primary-fg" : "bg-secondary text-muted",
                )}
              >
                {preset === 30 ? "Mensuel (30 j)" : "Trimestriel (90 j)"}
              </button>
            ))}
          </div>
          {lastGeneratedKey ? (
            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-primary-soft p-3">
              <code className="flex-1 truncate font-mono text-sm text-primary-fg">
                {lastGeneratedKey}
              </code>
              <Button size="sm" variant="ghost" onClick={() => void copyKey()}>
                <Copy className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-subtle">
              ⚠️ La clé générée n'apparaîtra qu'une seule fois — note-la avant de fermer.
            </p>
          )}
        </section>

        {/* Filtres */}
        <div className="mt-8 flex flex-wrap gap-2">
          {(["all", "active", "pending", "expired", "revoked"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-full px-3 text-xs shadow-[var(--shadow-border)]",
                filter === f ? "bg-primary text-primary-fg" : "bg-card text-muted hover:bg-secondary",
              )}
            >
              {f === "all" ? "Toutes" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Table */}
        <section className="mt-4 space-y-2">
          {loading && items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Aucune licence dans cette catégorie.
            </p>
          ) : (
            items.map((lic) => {
              const left = daysLeft(lic.expiresAt);
              return (
                <div
                  key={lic.id}
                  className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                        STATUS_STYLE[lic.status],
                      )}
                    >
                      {STATUS_LABEL[lic.status]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm">{lic.optimusId}</p>
                      <p className="mt-1 text-xs text-muted">
                        {lic.product} · créée {formatDate(lic.createdAt, locale)}
                        {lic.activatedAt && ` · activée ${formatDate(lic.activatedAt, locale)}`}
                        {lic.expiresAt && ` · expire ${formatDate(lic.expiresAt, locale)}`}
                        {left !== null && left > 0 && lic.status === "active" && (
                          <span className="text-emerald-400"> ({left}j restants)</span>
                        )}
                      </p>
                      {lic.deviceId && (
                        <p className="mt-0.5 font-mono text-[10px] text-subtle">
                          device : {lic.deviceId.slice(0, 24)}
                          {lic.deviceId.length > 24 && "…"}
                        </p>
                      )}
                    </div>
                    {lic.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void revoke(lic.id)}
                        disabled={acting === lic.id}
                        title="Révoquer cette licence"
                      >
                        <ShieldOff className="size-4 text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {forbidden && (
          <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-lg)] bg-danger/15 p-4 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="font-medium">Session admin expirée ou invalide</p>
              <Link to="/admin-login" className="text-primary underline-offset-4 hover:underline">
                Reconnecte-toi
              </Link>
            </div>
          </div>
        )}
      </Page>
    </Shell>
  );
}
