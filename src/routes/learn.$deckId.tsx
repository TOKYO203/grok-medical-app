import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { QuizPlayer, type QuizItem } from "@/components/quiz-player";
import { Page, Shell } from "@/components/shell";
import { pickLessonQuestions, questionXp, type SessionMode } from "@/core/quiz-engine";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

type Search = { lesson?: number; preview?: boolean; mode?: SessionMode };

export const Route = createFileRoute("/learn/$deckId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    lesson: typeof s.lesson === "number" ? s.lesson : Number(s.lesson ?? 0) || 0,
    preview: s.preview === true || s.preview === "true",
    mode: s.mode === "revue" || s.mode === "preview" || s.mode === "lesson" ? s.mode : "lesson",
  }),
  component: LearnPage,
});

function LearnPage() {
  const { deckId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const decks = useAllDecks();
  const deck = decks.find((d) => d.id === deckId);
  const progress = useOptimus((s) => s.progress[deckId]);
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const recordAnswer = useOptimus((s) => s.recordAnswer);
  const completeLesson = useOptimus((s) => s.completeLesson);

  if (!deck) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Deck introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const open = hasAccess(deck, entitlements, tier);
  const mode: SessionMode = !open || search.preview ? "preview" : search.mode === "revue" ? "revue" : "lesson";
  const items: QuizItem[] = pickLessonQuestions(deck, search.lesson ?? 0, progress, mode).map((question) => ({
    question,
    deckTitle: deck.title,
  }));

  return (
    <Shell title={deck.title}>
      <Page>
        <Link
          to="/parcours/$deckId"
          params={{ deckId: deck.id }}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          {deck.title}
        </Link>
        <QuizPlayer
          items={items}
          onAnswer={(item, ok, combo) => {
            recordAnswer({
              deckId: deck.id,
              questionId: item.question.id,
              ok,
              xp: questionXp(item.question.difficulty, combo, ok),
              mode,
            });
          }}
          onFinish={() => {
            if (mode === "lesson") completeLesson(deck.id, search.lesson ?? 0);
            void navigate({ to: "/parcours/$deckId", params: { deckId: deck.id } });
          }}
        />
      </Page>
    </Shell>
  );
}
