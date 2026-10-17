import { useRef, useState } from "react";
import { Hand, RotateCcw, Sparkles, ThumbsUp, TimerReset } from "lucide-react";
import type { FicheContent, Flashcard } from "@/core/demarche";
import { useI18n } from "@/i18n";
import { useOptimus } from "@/state/store";
import { viewPanelId } from "./view-tabs";

const XP_PER_CARD = 5;

/** Badge de criticité affiché en haut à droite de la carte (fix #7). */
function cardBadge(card: Flashcard | undefined): "urgence" | "prudence" | null {
  const tags = (card?.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.includes("urgence")) return "urgence";
  if (tags.includes("piège") || tags.includes("piege")) return "prudence";
  return null;
}

const BADGE_STYLE: Record<"urgence" | "prudence", React.CSSProperties> = {
  urgence: { background: "var(--app-danger)", color: "#ffffff" },
  prudence: { background: "var(--app-warn)", color: "#1b1408" },
};

export function FlashcardsView({
  content,
  trackId,
}: {
  content: FicheContent;
  /** Clé de progression (défaut : `slug`). Une démarche passe son `diagnosticId`
   *  pour conserver la progression déjà enregistrée sous cette clé. */
  trackId?: string;
}) {
  const { t } = useI18n();
  const recordAnswer = useOptimus((s) => s.recordAnswer);
  const cards = content.flashcards;

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  // Un tap tactile génère à la fois pointerup ET click ; sans ce verrou, la
  // révélation basculerait deux fois (annulation nette : la carte ne s'ouvre
  // jamais au doigt). Le geste pointeur est la source de vérité ; on avale le
  // click de compatibilité qui suit, sans jamais bloquer l'activation clavier
  // (Enter/Espace émettent un click sans pointerdown préalable).
  const pointerHandledRef = useRef(false);

  const done = index >= cards.length;
  const card = cards[index];
  const badge = cardBadge(card);
  const earnedXp = known * XP_PER_CARD;

  function reset() {
    setRevealed(false);
    setOffset(0);
    setDragging(false);
  }

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(cards.length, next)));
    reset();
  }

  function answer(ok: boolean) {
    if (!card) return;
    recordAnswer({
      deckId: trackId ?? content.slug,
      questionId: card.id,
      ok,
      xp: ok ? XP_PER_CARD : 0,
      mode: "flashcards",
    });
    if (ok) setKnown((count) => count + 1);
    goTo(index + 1);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (done) return;
    pointerHandledRef.current = false;
    setDragging(true);
    setStartX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setOffset(event.clientX - startX);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    pointerHandledRef.current = true;
    if (Math.abs(offset) > 70) {
      goTo(offset < 0 ? index + 1 : index - 1);
      return;
    }
    if (Math.abs(offset) < 8) setRevealed((value) => !value);
    setOffset(0);
  }

  /** Un seul basculement par geste : le click de compatibilité est avalé si le
   *  pointeur a déjà traité le tap (cf. pointerHandledRef). */
  function onCardActivate() {
    if (pointerHandledRef.current) {
      pointerHandledRef.current = false;
      return;
    }
    setRevealed((value) => !value);
  }

  const progress = (Math.min(index, cards.length) / cards.length) * 100;

  return (
    <div
      id={viewPanelId("flashcards")}
      role="tabpanel"
      aria-labelledby="vue-tab-flashcards"
      data-demarche-panel="flashcards"
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs tabular-nums text-subtle">
          {t("demarche.cards.progress", { current: Math.min(index + 1, cards.length), total: cards.length })}
        </p>
        <p
          className="flex items-center gap-1.5 text-xs font-medium text-accent"
          data-flashcard-xp={earnedXp}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {earnedXp > 0
            ? t("demarche.cards.xp", { xp: earnedXp })
            : t("demarche.cards.xpPerCard", { xp: XP_PER_CARD })}
        </p>
      </div>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={Math.min(index, cards.length)}
      >
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      {done ? (
        <div className="optimus-card p-6 text-center" data-flashcard-done="true">
          <TimerReset className="mx-auto size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-xl font-medium">{t("demarche.cards.doneTitle")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("demarche.cards.doneBody", { known, total: cards.length })}
          </p>
          <button
            type="button"
            onClick={() => {
              setKnown(0);
              goTo(0);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("demarche.cards.restart")}
          </button>
        </div>
      ) : card ? (
        <>
          <div
            data-flashcard-index={index}
            data-flashcard-revealed={revealed}
            className="relative transition-transform duration-150 hover:-translate-y-0.5"
          >
            {badge ? (
              <span
                data-flashcard-badge={badge}
                style={BADGE_STYLE[badge]}
                className="pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-[var(--shadow-soft)]"
              >
                {t(badge === "urgence" ? "demarche.cards.urgency" : "demarche.cards.caution")}
              </span>
            ) : null}

            <div
              className="touch-manipulation select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <button
                type="button"
                onClick={onCardActivate}
                style={{
                  transform: `translateX(${offset}px) rotate(${offset * 0.02}deg)`,
                  transition: dragging ? "none" : "transform 180ms var(--ease-out)",
                }}
                className="optimus-card group flex min-h-56 w-full flex-col justify-between p-5 text-left shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-md)]"
                aria-label={revealed ? t("demarche.cards.hide") : t("demarche.cards.reveal")}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  {revealed ? t("demarche.cards.answer") : t("demarche.cards.question")}
                </span>
                <span className="mt-3 block font-display text-lg font-medium leading-snug">
                  {revealed ? card.back : card.front}
                </span>
                {card.tags?.length ? (
                  <span className="mt-4 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
                {!revealed ? (
                  <span
                    data-flashcard-tap-hint
                    className="mt-4 inline-flex items-center gap-1.5 self-center rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted transition-colors group-hover:text-fg"
                  >
                    <Hand className="size-3.5" aria-hidden />
                    {t("demarche.cards.tapToReveal")}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {revealed ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => answer(false)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-card text-sm font-medium text-muted shadow-[var(--shadow-border)]"
              >
                <RotateCcw className="size-4" aria-hidden />
                {t("demarche.cards.again")}
              </button>
              <button
                type="button"
                onClick={() => answer(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary text-sm font-medium text-primary-fg"
              >
                <ThumbsUp className="size-4" aria-hidden />
                {t("demarche.cards.known")}
              </button>
            </div>
          ) : (
            <p className="flex min-h-11 items-center justify-center text-center text-xs text-subtle">
              {t("demarche.cards.hint")}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
