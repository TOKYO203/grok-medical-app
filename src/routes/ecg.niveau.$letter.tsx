import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { getParcours, listLevelLessons, isLevel } from "@/lib/ecg/parcours/catalog";
import { isLessonComplete } from "@/lib/ecg/parcours/progression";
import type { Level } from "@/lib/ecg/parcours/types";

export const Route = createFileRoute("/ecg/niveau/$letter")({
  component: LevelPage,
});

function LevelPage() {
  const { letter } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/ecg/niveau/${letter}`;

  if (pathname !== base && pathname !== base + "/") {
    return <Outlet />;
  }

  if (!isLevel(letter)) {
    return (
      <Shell title="ECG">
        <Page className="mx-auto max-w-2xl">
          <p>Niveau introuvable.</p>
          <Link to="/ecg" className="text-sm text-subtle hover:underline">← Retour au parcours</Link>
        </Page>
      </Shell>
    );
  }

  return <LevelPageContent letter={letter} />;
}

function LevelPageContent({ letter }: { letter: Level }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = listLevelLessons(letter).filter((l) => isLessonComplete(l.id)).map((l) => l.id);
    setCompleted(new Set(ids));
  }, [letter]);

  const meta = getParcours().levels.find((l) => l.id === letter);
  const lessons = listLevelLessons(letter);
  if (!meta) return null;

  return (
    <Shell title={`ECG · Niveau ${letter}`}>
      <Page className="mx-auto max-w-2xl" header={
        <PageHeader kicker={`Niveau ${letter}`} title={meta.title} description={meta.description} />
      }>
        <Link to="/ecg" className="mb-4 inline-flex items-center gap-1 text-sm text-subtle hover:underline">
          <ChevronLeft size={14} /> Retour au parcours
        </Link>

        <p className="mb-4 text-sm text-subtle">🎯 {meta.objective}</p>

        <div className="space-y-2">
          {lessons.map((lesson, idx) => {
            const done = completed.has(lesson.id);
            return (
              <Link
                key={lesson.id}
                to="/ecg/niveau/$letter/$leconId"
                params={{ letter, leconId: lesson.id }}
                className="flex items-center gap-3 rounded-lg border border-default p-3 transition hover:border-strong"
              >
                {done
                  ? <CheckCircle2 size={20} className="text-emerald-600" />
                  : <Circle size={20} className="text-subtle" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-subtle">Leçon {idx + 1} · {lesson.durationMin} min</p>
                  <p className="text-sm font-medium">{lesson.title}</p>
                </div>
                <ChevronRight size={16} className="text-subtle" />
              </Link>
            );
          })}
        </div>
      </Page>
    </Shell>
  );
}
