import { ArrowRight, Stethoscope } from "lucide-react";

type Props = {
  title: string;
  specialty: string;
  summary?: string;
};

export function ClinicalCaseCard({
  title,
  specialty,
  summary,
}: Props) {
  return (
    <div className="optimus-interactive-card rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">

      <div className="flex gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Stethoscope className="size-5" />
        </span>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            {specialty}
          </p>

          <h3 className="font-medium">
            {title}
          </h3>

          {summary ? (
            <p className="mt-1 text-sm text-muted">
              {summary}
            </p>
          ) : null}

        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-primary">
        Ouvrir le dossier
        <ArrowRight className="size-4" />
      </div>

    </div>
  );
}
