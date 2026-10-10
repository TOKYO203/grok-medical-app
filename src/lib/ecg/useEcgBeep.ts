import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════
   useEcgBeep — bip de moniteur ECG (Web Audio API, zéro asset)
   ───────────────────────────────────────────────────────────────────
   Joue un bip court (880 Hz, 60 ms) à chaque pic R.
   Le contexte audio est créé au premier geste utilisateur (règle navigateur).
   ═══════════════════════════════════════════════════════════════════ */

export function useEcgBeep({
  enabled,
  bpm,
}: {
  enabled: boolean;
  bpm: number;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Créer le contexte au premier tick (après geste utilisateur)
    if (!ctxRef.current) {
      type W = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }

    const ctx = ctxRef.current;
    const playBeep = () => {
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.15, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.07);
    };

    // Bip initial + intervalle selon BPM
    playBeep();
    const intervalMs = (60 / Math.max(30, Math.min(200, bpm))) * 1000;
    timerRef.current = window.setInterval(playBeep, intervalMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [enabled, bpm]);

  // Nettoyage du contexte à la destruction
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        void ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, []);
}
