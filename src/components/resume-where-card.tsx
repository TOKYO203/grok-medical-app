import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { History } from "lucide-react";
import { EXPLORE_GROUPS, NAV } from "@/lib/navigation";
import { useI18n } from "@/i18n";

const LAST_ROUTE_KEY = "optimus.lastRoute";

/*
 * Carte « Reprendre où vous étiez » (Session 10 — vague UX navigation) :
 * n’apparaît sur l’accueil que si une route utile différente a été visitée ;
 * le libellé de la page cible est résolu depuis la taxonomie centrale.
 */
function resolvePageLabelKey(path: string) {
  const pages = [...NAV, ...EXPLORE_GROUPS.flatMap((group) => [...group.items])];
  return (
    pages.find((page) => page.to === path) ??
    pages.find((page) => page.to !== "/" && path.startsWith(page.to + "/"))
  )?.labelKey;
}

export function ResumeWhereCard() {
  const { t } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LAST_ROUTE_KEY);
      if (stored && stored !== "/" && stored !== window.location.pathname) {
        setTarget(stored);
      }
    } catch {
      /* stockage indisponible — la carte reste masquée */
    }
  }, []);

  if (!target) return null;
  const labelKey = resolvePageLabelKey(target);

  return (
    <button
      type="button"
      onClick={() => router.history.push(target)}
      aria-label={t("ux.resumeAria")}
      className="optimus-card optimus-interactive-card mt-3 flex w-full items-center gap-3 p-3 text-left"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary shadow-[var(--shadow-border)]">
        <History className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="optimus-kicker block text-[11px] font-medium uppercase tracking-[0.16em]">
          {t("ux.resumeKicker")}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {labelKey ? t(labelKey) : target}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-primary">{t("ux.resumeGo")}</span>
    </button>
  );
}
