import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, OctagonAlert } from "lucide-react";
import { findIndicationBySlug, urgencyRank } from "@/content/examens-complementaires";
import type { Exam } from "@/content/examens-complementaires";

export const Route = createFileRoute("/examens-complementaires/$id")({
  component: IndicationPage,
});

const URGENCY_LABEL: Record<Exam["urgency"], string> = {
  immediate: "Immédiat",
  rapide: "Rapide",
  programmable: "Programmable",
};

function ExamCard({ exam }: { exam: Exam }) {
  return (
    <li className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{exam.name}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">
          {URGENCY_LABEL[exam.urgency]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{exam.rationale}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">À chercher :</span> {exam.findingToLook}
      </p>
      <p className="mt-1 text-sm text-success">
        <span className="font-medium">Positif :</span> {exam.result.positive}
      </p>
      <p className="mt-1 text-sm text-muted">
        <span className="font-medium">Négatif :</span> {exam.result.negative}
      </p>
    </li>
  );
}

function IndicationPage() {
  const { id } = Route.useParams();
  const i = findIndicationBySlug(id);

  if (!i) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted">Indication introuvable.</p>
        <Link to="/examens-complementaires" className="mt-4 inline-block text-primary underline">
          Retour à la liste
        </Link>
      </main>
    );
  }

  const firstLine = [...i.firstLine].sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link to="/examens-complementaires" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> Toutes les indications
        </Link>
        <span>·</span>
        <span>{i.symptom}</span>
      </div>

      <h1 className="font-display text-3xl font-medium">{i.symptom}</h1>
      <p className="mt-1 text-sm text-muted">{i.context}</p>
      <p className="mt-4 text-sm leading-relaxed text-muted">{i.definition}</p>

      {/* Red flags EN PREMIER */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-medium text-danger">
          <OctagonAlert className="size-5" aria-hidden /> Signes d'alerte
        </h2>
        <ul className="mt-2 space-y-2">
          {i.redFlags.map((rf) => (
            <li
              key={rf.sign}
              className="rounded-[var(--radius-lg)] border-l-4 border-danger bg-danger/10 p-3 text-sm"
            >
              <p className="font-medium text-danger">{rf.sign}</p>
              <p className="mt-1 text-muted">{rf.action}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium">1ʳᵉ intention</h2>
        <ul className="mt-2 space-y-3">
          {firstLine.map((e) => (
            <ExamCard key={e.name} exam={e} />
          ))}
        </ul>
      </section>

      {i.secondLine.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-medium">2ᵉ intention</h2>
          <ul className="mt-2 space-y-3">
            {[...i.secondLine]
              .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency))
              .map((e) => (
                <ExamCard key={e.name} exam={e} />
              ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="font-medium">Ce qu'on ne fait PAS</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {i.notRecommended.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {i.linkedPathologies.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-medium">Fiches liées</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {i.linkedPathologies.map((slug) => (
              <li key={slug}>
                <Link
                  to="/pathologie/$slug"
                  params={{ slug }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-secondary px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/80"
                >
                  <BookOpen className="size-4" aria-hidden />
                  {slug.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8">
        <Link
          to="/examens-complementaires"
          className="inline-flex items-center rounded-[var(--radius-md)] bg-secondary px-4 py-2 text-sm font-medium"
        >
          Retour à la liste
        </Link>
      </div>
    </main>
  );
}
