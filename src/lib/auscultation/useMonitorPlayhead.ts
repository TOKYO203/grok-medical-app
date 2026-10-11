import { useEffect, useRef, useState } from "react";

/**
 * Renvoie la position du playhead en secondes (0 → cycleDuration).
 * Boucle indéfiniment quand `playing` est vrai.
 * `rate` ralentit l'animation (0.25 = 4× plus lent).
 */
export function useMonitorPlayhead(
  cycleDuration: number,
  playing: boolean,
  rate: number,
): number {
  const [playhead, setPlayhead] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      setPlayhead(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = ((performance.now() - startRef.current) / 1000) * rate;
      setPlayhead(elapsed % cycleDuration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, rate, cycleDuration]);

  return playhead;
}
