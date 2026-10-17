import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import {
  APP_CHANGELOG,
  CHANGELOG_KIND_LABEL,
  type ChangelogEntryKind,
} from "@/content/changelog";
import { MEDICAL_CONTENT_VERSION } from "@/content/medical-version";

export const Route = createFileRoute("/changelog")({ component: ChangelogPage });

const KIND_CLASS: Record<ChangelogEntryKind, string> = {
  new: "bg-primary-soft text-primary",
  improved: "bg-secondary text-fg",
  fixed: "border border-border text-muted",
};

function ChangelogPage() {
  return (
    <Shell title="Journal des versions">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Transparence"
            title="Journal des versions"
            description={
              "Ce qui change dans Optimus, en clair. Le contenu médical versionne " +
              "séparément (" + MEDICAL_CONTENT_VERSION + ")."
            }
          />
        }
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>

        <ol className="mt-6 space-y-4">
          {APP_CHANGELOG.map((release) => (
            <li
              key={release.version}
              className="rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-medium text-fg">
                  Version {release.version}
                </h2>
                <time dateTime={release.date} className="text-xs text-subtle">
                  {release.dateLabel}
                </time>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{release.summary}</p>
              <ul className="mt-4 space-y-2.5">
                {release.entries.map((entry) => (
                  <li key={entry.text} className="flex items-start gap-2.5">
                    <span
                      className={
                        "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                        KIND_CLASS[entry.kind]
                      }
                    >
                      {CHANGELOG_KIND_LABEL[entry.kind]}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-fg">
                      {entry.text}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Contenu médical</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Les fiches, decks et cas suivent leur propre versionnement
            ({MEDICAL_CONTENT_VERSION}) : les corrections de fond sont retracées par le
            conseil éditorial, chaque fiche cite ses sources.
          </p>
          <Link
            to="/conseil-editorial"
            className="mt-3 inline-flex h-10 items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/70"
          >
            Conseil éditorial
          </Link>
        </section>
      </Page>
    </Shell>
  );
}
