import {
  AlertOctagon,
  BookMarked,
  Lightbulb,
  Link2,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CalloutTone, DemarcheContent, FicheBlock } from "@/core/demarche";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { viewPanelId } from "./view-tabs";

const TONE_META: Record<
  CalloutTone,
  { labelKey: string; icon: LucideIcon; frame: string; iconClass: string }
> = {
  urgence: {
    labelKey: "demarche.tone.urgence",
    icon: AlertOctagon,
    frame: "bg-danger/10 ring-1 ring-danger/30",
    iconClass: "text-danger",
  },
  prudence: {
    labelKey: "demarche.tone.prudence",
    icon: ShieldAlert,
    frame: "bg-warn/10 ring-1 ring-warn/35",
    iconClass: "text-warn",
  },
  reflexe: {
    labelKey: "demarche.tone.reflexe",
    icon: Zap,
    frame: "bg-primary-soft ring-1 ring-primary/25",
    iconClass: "text-primary",
  },
  retenir: {
    labelKey: "demarche.tone.retenir",
    icon: BookMarked,
    frame: "bg-accent/10 ring-1 ring-accent/30",
    iconClass: "text-accent",
  },
  memo: {
    labelKey: "demarche.tone.memo",
    icon: Lightbulb,
    frame: "bg-surface ring-1 ring-border",
    iconClass: "text-muted",
  },
};

function Block({ block }: { block: FicheBlock }) {
  const { t } = useI18n();

  if (block.type === "paragraph") {
    return <p className="text-[13px] leading-relaxed text-muted sm:text-sm">{block.text}</p>;
  }

  if (block.type === "list") {
    return (
      <ul className="space-y-1.5">
        {block.items.map((item, index) => (
          <li key={index} className="flex gap-2 text-[13px] leading-relaxed sm:text-sm">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "table") {
    return (
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-[12px] sm:text-[13px]">
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-border pb-2 pr-3 align-bottom font-semibold uppercase tracking-wider text-subtle"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "border-b border-border/60 py-2 pr-3 leading-relaxed",
                      cellIndex === 0 ? "font-medium text-fg" : "text-muted",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const meta = TONE_META[block.tone];
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-[var(--radius-lg)] p-3.5", meta.frame)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", meta.iconClass)} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {t(meta.labelKey)}
        </p>
      </div>
      <p className="mt-1.5 text-[13px] font-medium leading-snug text-fg">{block.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted sm:text-[13px]">{block.text}</p>
    </div>
  );
}

export function FicheView({ content }: { content: DemarcheContent }) {
  const { t } = useI18n();

  return (
    <div
      id={viewPanelId("fiche")}
      role="tabpanel"
      aria-labelledby="vue-tab-fiche"
      data-demarche-panel="fiche"
      className="space-y-3"
    >
      <div className="rounded-[var(--radius-lg)] bg-accent/10 p-4 ring-1 ring-accent/25">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {t("demarche.fiche.objective")}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg">{content.objective}</p>
      </div>

      {content.sections.map((section, index) => (
        <details
          key={section.id}
          open={index === 0}
          className="optimus-card group overflow-hidden p-0"
          data-demarche-section={section.id}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <span className="block font-display text-base font-medium leading-snug text-fg">
                {section.title}
              </span>
              {section.summary ? (
                <span className="mt-0.5 block text-xs text-subtle">{section.summary}</span>
              ) : null}
            </span>
            <span
              aria-hidden
              className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-4">
            {section.blocks.map((block, blockIndex) => (
              <Block key={blockIndex} block={block} />
            ))}
          </div>
        </details>
      ))}

      {content.mnemonics.length > 0 ? (
        <section
          className="optimus-card p-4"
          data-demarche-mnemonics
          aria-label={t("demarche.fiche.mnemonics")}
        >
          <h2 className="font-display text-base font-medium">{t("demarche.fiche.mnemonics")}</h2>
          <div className="mt-3 space-y-3">
            {content.mnemonics.map((mnemonic) => (
              <div key={mnemonic.id} className="rounded-[var(--radius-md)] bg-secondary p-3">
                <p className="font-mono text-sm font-semibold tracking-[0.14em] text-accent">
                  {mnemonic.label}
                </p>
                {mnemonic.intro ? (
                  <p className="mt-0.5 text-xs text-subtle">{mnemonic.intro}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {mnemonic.entries.map((entry, entryIndex) => (
                    <li key={entryIndex} className="flex gap-2 text-[12px] leading-snug sm:text-[13px]">
                      <span className="font-mono font-semibold text-accent">{entry.key}</span>
                      <span className="text-muted">{entry.term}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {content.sources.length > 0 ? (
        <section className="optimus-card p-4" aria-label={t("demarche.fiche.sources")}>
          <h2 className="flex items-center gap-2 font-display text-base font-medium">
            <Link2 className="size-4 text-subtle" aria-hidden />
            {t("demarche.fiche.sources")}
          </h2>
          <ul className="mt-3 space-y-2">
            {content.sources.map((source) => (
              <li key={source.title} className="text-[12px] leading-relaxed text-muted">
                <span className="font-medium text-fg">{source.title}</span>
                {source.url ? (
                  <>
                    {" · "}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t("demarche.fiche.sourceLink")}
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
