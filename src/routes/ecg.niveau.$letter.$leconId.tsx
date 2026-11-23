import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { getLesson, listLevelLessons, isLevel } from "@/lib/ecg/parcours/catalog";
import { LessonContent } from "@/components/ecg/parcours/LessonContent";
import { CheckQuiz } from "@/components/ecg/parcours/CheckQuiz";
import { markLessonComplete } from "@/lib/ecg/parcours/progression";

export const Route = createFileRoute("/ecg/niveau/$letter/$leconId")({
  component: LessonPage,
});

function LessonPage() {
  const { letter, leconId } = Route.useParams();
  const lesson = getLesson(leconId);

  if (!lesson || !isLevel(letter)) {
    return (
      <Shell title="ECG">
        <Page className="mx-auto max-w-2xl">
          <p>Leçon introuvable : {leconId}</p>
          <Link to="/ecg" className="text-sm text-subtle hover:underline">← Retour au parcours</Link>
        </Page>
      </Shell>
    );
  }

  function handleQuizComplete(score: number) {
    if (score >= 70) markLessonComplete(lesson!.id, score);
  }

  const siblings = listLevelLessons(letter);
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const nextLesson = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <Shell title={`ECG · ${lesson.title}`}>
      <Page className="mx-auto max-w-2xl" header={
        <PageHeader kicker={`Niveau ${letter} · Leçon ${lesson.order}`} title={lesson.title} description={`${lesson.durationMin} min`} />
      }>
        <Link to="/ecg/niveau/$letter" params={{ letter }} className="mb-4 inline-flex items-center gap-1 text-sm text-subtle hover:underline">
          <ChevronLeft size={14} /> Niveau {letter}
        </Link>

        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold">Objectifs</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-subtle">
            {lesson.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
          </ul>
        </div>

        <LessonContent blocks={lesson.content} />

        <div className="mt-8 rounded-xl bg-muted p-4">
          <h3 className="mb-2 font-semibold">Ce qu'il faut retenir</h3>
          <ul className="space-y-1 text-sm">
            {lesson.keyPoints.map((kp, i) => <li key={i}>✅ {kp}</li>)}
          </ul>
        </div>

        <div className="mt-6">
          <CheckQuiz questions={lesson.checkQuiz} onComplete={handleQuizComplete} />
        </div>

        {lesson.caseStudy && (
          <div className="mt-6 rounded-xl border border-default p-4">
            <h3 className="mb-2 font-semibold">Cas d'application</h3>
            <p className="mb-3 text-sm text-subtle">Mettez en pratique avec un cas guidé.</p>
            <Link
              to="/ecg/$id"
              params={{ id: lesson.caseStudy }}
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Étudier le cas →
            </Link>
          </div>
        )}

        {nextLesson && (
          <div className="mt-6">
            <Link
              to="/ecg/niveau/$letter/$leconId"
              params={{ letter, leconId: nextLesson.id }}
              className="inline-flex items-center gap-1 rounded-lg border border-default px-4 py-2 text-sm font-medium hover:border-strong"
            >
              Leçon suivante : {nextLesson.title} →
            </Link>
          </div>
        )}
      </Page>
    </Shell>
  );
}
