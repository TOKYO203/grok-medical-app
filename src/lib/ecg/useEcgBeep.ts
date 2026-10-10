import { useEffect, useRef } from "react";
import { SOUNDS, type SoundType } from "./sounds";

/* ═══════════════════════════════════════════════════════════════════
   useEcgBeep — joue un son type selon le diagnostic/rythme
   ───────────────────────────────────────────────────────────────────
   Supporte les 10 sons du spec (bip normal, BAV, FV, torsades, etc.)
   Priorité : critique > urgent > alerte > info.
   ═══════════════════════════════════════════════════════════════════ */

export function useEcgBeep({
  enabled,
  bpm = 75,
  soundType = "bip_normal",
}: {
  enabled: boolean;
  bpm?: number;
  soundType?: SoundType;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!ctxRef.current) {
      type W = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current;
    const spec = SOUNDS[soundType];
    if (spec.beeps === 0) return;

    const play = () => {
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      for (let i = 0; i < spec.beeps; i++) {
        const start = t0 + (i * (spec.duration + (spec.gapMs ?? 0))) / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = spec.wave;
        osc.frequency.setValueAtTime(spec.freq, start);
        if (spec.mod === "up") {
          osc.frequency.linearRampToValueAtTime(spec.freq * 1.5, start + spec.duration / 1000);
        } else if (spec.mod === "osc") {
          osc.frequency.linearRampToValueAtTime(spec.freq * 0.6, start + spec.duration / 2000);
          osc.frequency.linearRampToValueAtTime(spec.freq, start + spec.duration / 1000);
        }
        const dur = Math.min(spec.duration, 200) / 1000;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      }
    };

    play();
    const intervalMs = (60 / Math.max(30, Math.min(200, bpm))) * 1000;
    timerRef.current = window.setInterval(play, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [enabled, bpm, soundType]);

  useEffect(() => () => {
    if (ctxRef.current) { void ctxRef.current.close(); ctxRef.current = null; }
  }, []);
}