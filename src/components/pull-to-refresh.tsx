import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";

const TRIGGER_PX = 72;

/*
 * Pull-to-refresh (Session 10 — vague UX navigation) : en PWA installée, aucun
 * geste natif de rafraîchissement. Tirez la page vers le bas quand la liste est
 * en haut : l’indicateur suit l’étirement (résistance 1:2) et, au seuil, renotifie
 * les flux en ligne — même événement « online » qu’AppResumeBridge (synchronisation,
 * achats, licences), donc throttlé par ce dernier. Écouteurs passifs : le scroll
 * natif et le pull-to-refresh du navigateur restent intacts.
 */
export function PullToRefreshBridge() {
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const atTop = () =>
      document.documentElement.scrollTop <= 0 && window.scrollY <= 0;

    const onTouchStart = (e: TouchEvent) => {
      startY.current = e.touches.length === 1 && atTop() ? e.touches[0].clientY : null;
      pullRef.current = 0;
      setPull(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || spinning) return;
      const dy = e.touches[0].clientY - startY.current;
      pullRef.current = dy > 0 ? Math.min(dy / 2, 120) : 0;
      setPull(pullRef.current);
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      const reached = pullRef.current >= TRIGGER_PX;
      pullRef.current = 0;
      setPull(0);
      if (reached && !spinning) {
        setSpinning(true);
        window.dispatchEvent(new Event("online"));
        window.setTimeout(() => setSpinning(false), 900);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [spinning]);

  if (pull <= 0 && !spinning) return null;

  return (
    <div
      role="status"
      aria-label={t("ux.refreshAria")}
      className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center md:top-4"
    >
      <span
        className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--shadow-md)]"
        style={{ transform: `translateY(${Math.min(pull, 48)}px)` }}
      >
        <RefreshCw className="size-4" aria-hidden />
      </span>
    </div>
  );
}
