import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useI18n } from "@/i18n";

const SHOW_AFTER_PX = 600;

/*
 * « Remonter en haut » (Session 10 — vague UX navigation) : bouton flottant
 * réservé aux pages à listes longues. Il n’apparaît qu’après un vrai défilement
 * et reste dégagé de la barre de navigation mobile (bottom-20) comme du bord
 * desktop (md:bottom-6). Le retour est doux sauf prefers-reduced-motion.
 */
export function ScrollToTopButton() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      aria-label={t("ux.backToTop")}
      className="fixed bottom-20 right-4 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted shadow-[var(--shadow-md)] transition-colors hover:text-fg active:scale-95 md:bottom-6"
    >
      <ArrowUp className="size-5" aria-hidden />
    </button>
  );
}
