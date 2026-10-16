import { BookOpen, Layers, ListChecks, Network, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Les quatre vues d'une démarche. La première reste le QCM historique. */
export type DemarcheView = "demarche" | "fiche" | "flashcards" | "mindmap";

const VIEWS: { id: DemarcheView; labelKey: string; icon: LucideIcon }[] = [
  { id: "demarche", labelKey: "demarche.tab.qcm", icon: ListChecks },
  { id: "fiche", labelKey: "demarche.tab.fiche", icon: BookOpen },
  { id: "flashcards", labelKey: "demarche.tab.cards", icon: Layers },
  { id: "mindmap", labelKey: "demarche.tab.map", icon: Network },
];

export function viewPanelId(view: DemarcheView) {
  return `vue-panel-${view}`;
}

const VIEW_IDS: DemarcheView[] = ["demarche", "fiche", "flashcards", "mindmap"];

/** Garde de type pour `validateSearch` : une valeur inconnue retombe sur `undefined`. */
export function isDemarcheView(value: unknown): value is DemarcheView {
  return typeof value === "string" && (VIEW_IDS as string[]).includes(value);
}

/**
 * Barre d'onglets (segmented control) partagée par les quatre vues.
 * `role="tablist"` + `aria-controls` pointent vers les panneaux correspondants.
 */
export function ViewTabs({
  value,
  onChange,
  views = VIEWS.map((view) => view.id),
}: {
  value: DemarcheView;
  onChange: (view: DemarcheView) => void;
  views?: DemarcheView[];
}) {
  const { t } = useI18n();
  const items = VIEWS.filter((view) => views.includes(view.id));

  return (
    <div
      role="tablist"
      aria-label={t("demarche.tabsAria")}
      className="flex w-full gap-1 rounded-[var(--radius-lg)] bg-secondary p-1 shadow-[var(--shadow-border)]"
    >
      {items.map(({ id, labelKey, icon: Icon }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`vue-tab-${id}`}
            aria-selected={active}
            aria-controls={viewPanelId(id)}
            data-demarche-tab={id}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-1.5 pb-2 pt-1.5 text-[12px] font-medium leading-none transition-colors sm:text-sm",
              active
                ? "bg-card text-fg shadow-[var(--shadow-border)]"
                : "text-muted hover:text-fg",
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", active && "text-accent")} aria-hidden />
            <span>{t(labelKey)}</span>
            {active ? (
              <span
                aria-hidden
                data-demarche-tab-indicator
                className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-accent"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
