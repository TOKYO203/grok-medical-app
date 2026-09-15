import { useEffect, useState } from "react";
import { Sparkles, Volume2, VolumeX, Zap, ZapOff } from "lucide-react";
import {
  DEFAULT_EXPERIENCE_PREFERENCES,
  readExperiencePreferences,
  subscribeExperiencePreferences,
  writeExperiencePreferences,
  type ExperiencePreferences,
} from "@/lib/experience-feedback";
import { cn } from "@/lib/utils";

export function useExperiencePreferences() {
  const [preferences, setPreferences] = useState<ExperiencePreferences>(
    DEFAULT_EXPERIENCE_PREFERENCES,
  );

  useEffect(() => {
    setPreferences(readExperiencePreferences());
    return subscribeExperiencePreferences(setPreferences);
  }, []);

  const update = (patch: Partial<ExperiencePreferences>) => {
    const next = { ...readExperiencePreferences(), ...patch };
    writeExperiencePreferences(next);
    setPreferences(next);
  };

  return { preferences, update };
}

export function ExperienceControls({ compact = false }: { compact?: boolean }) {
  const { preferences, update } = useExperiencePreferences();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[var(--radius-md)] bg-secondary p-1 shadow-[var(--shadow-border)]",
        compact ? "w-fit" : "w-full",
      )}
      aria-label="Préférences sensorielles"
    >
      <button
        type="button"
        aria-pressed={preferences.sounds}
        title={preferences.sounds ? "Désactiver les sons" : "Activer les sons"}
        onClick={() => update({ sounds: !preferences.sounds })}
        className={cn(
          "flex size-9 items-center justify-center rounded-[10px] text-muted transition-colors",
          preferences.sounds && "bg-primary-soft text-primary",
        )}
      >
        {preferences.sounds ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <button
        type="button"
        aria-pressed={preferences.haptics}
        title={preferences.haptics ? "Désactiver les vibrations" : "Activer les vibrations"}
        onClick={() => update({ haptics: !preferences.haptics })}
        className={cn(
          "flex size-9 items-center justify-center rounded-[10px] text-muted transition-colors",
          preferences.haptics && "bg-primary-soft text-primary",
        )}
      >
        {preferences.haptics ? <Zap className="size-4" /> : <ZapOff className="size-4" />}
      </button>
      <button
        type="button"
        aria-pressed={preferences.enhancedMotion}
        title={
          preferences.enhancedMotion ? "Réduire les animations" : "Activer les animations enrichies"
        }
        onClick={() => update({ enhancedMotion: !preferences.enhancedMotion })}
        className={cn(
          "flex size-9 items-center justify-center rounded-[10px] text-muted transition-colors",
          preferences.enhancedMotion && "bg-primary-soft text-primary",
        )}
      >
        <Sparkles className="size-4" />
      </button>
      {!compact ? (
        <span className="ml-1 mr-2 text-[11px] leading-tight text-muted">Sons · vibrations · motion</span>
      ) : null}
    </div>
  );
}
