import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const EDGE_PX = 24;
const MIN_DRAG_PX = 64;
const MAX_DRIFT_PX = 48;

/*
 * Swipe-back (Session 10 — vague UX navigation) : en PWA installée, iOS et
 * Android n’offrent pas le geste natif de retour. On restaure un retour par
 * swipe depuis le bord gauche — écouteurs passifs, jamais de preventDefault :
 * le scroll natif reste intact, et le retour ne part que si l’historique le
 * permet (idx > 0, posé par TanStack Router sur l’état d’historique).
 */
export function SwipeBackBridge() {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let armed = false;

    const canGoBack = () => {
      const state = window.history.state as { idx?: number } | null;
      return typeof state?.idx === "number" && state.idx > 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      armed = touch.clientX <= EDGE_PX;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const driftY = Math.abs(touch.clientY - startY);
      if (dx >= MIN_DRAG_PX && driftY <= MAX_DRIFT_PX && canGoBack()) {
        router.history.back();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  return null;
}
