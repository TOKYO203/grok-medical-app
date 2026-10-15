import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Teaser Premium « Optimus en 30 secondes » — Mission International, A05.
 *
 * Séquence animée en CSS pur (4 scènes × 7,5 s = 30 s), sans fichier vidéo :
 * la PWA reste légère et consultable hors ligne. Respecte
 * prefers-reduced-motion (lecture automatique désactivée, bouton pause
 * toujours disponible).
 */

const SCENES = [
  {
    icon: "🫀",
    title: "23 cas ECG interactifs",
    detail: "Lisez le tracé, prenez la décision, corrigez-vous immédiatement.",
  },
  {
    icon: "🩺",
    title: "Des cas cliniques qui vous notent",
    detail: "Chaque décision reçoit un feedback sourcé, pas seulement un score.",
  },
  {
    icon: "🏅",
    title: "Vos badges, jour après jour",
    detail: "Séries, ligues et prochain objectif suivis sur votre profil.",
  },
  {
    icon: "📶",
    title: "Hors ligne, partout",
    detail: "Vos decks vous suivent en garde, même sans réseau.",
  },
] as const;

const SCENE_MS = 7_500;
const TICK_MS = 100;
const TOTAL_MS = SCENES.length * SCENE_MS; // 30 secondes

export function PremiumTeaser() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => (value + TICK_MS) % TOTAL_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const sceneIndex = Math.floor(elapsed / SCENE_MS) % SCENES.length;
  const scene = SCENES[sceneIndex];
  const sceneProgress = playing ? ((elapsed % SCENE_MS) / SCENE_MS) * 100 : 100;

  return (
    <section
      aria-label="Optimus en 30 secondes"
      className="overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]"
    >
      <div className="premium-hero relative p-5 text-primary-fg">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
            Aperçu · Optimus en 30 secondes
          </p>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Mettre le teaser en pause" : "Lire le teaser"}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/18 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)] transition-opacity hover:opacity-90"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
        <div className="mt-4 flex min-h-28 items-start gap-4">
          <span aria-hidden="true" className={cn("text-4xl", playing && "animate-pulse")}>
            {scene.icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              {scene.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed opacity-85">{scene.detail}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {SCENES.map((item, index) => (
            <span
              key={item.title}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
            >
              {index < sceneIndex ? (
                <span className="block h-full w-full bg-primary" />
              ) : null}
              {index === sceneIndex ? (
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: sceneProgress + "%" }}
                />
              ) : null}
            </span>
          ))}
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-subtle">
          30 s
        </span>
      </div>
    </section>
  );
}
