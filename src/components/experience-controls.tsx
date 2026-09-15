import { useEffect, useState, type ReactNode } from "react";
import {
  Headphones,
  Music2,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
} from "lucide-react";
import {
  DEFAULT_EXPERIENCE_PREFERENCES,
  isFocusAmbienceActive,
  readExperiencePreferences,
  startFocusAmbience,
  stopFocusAmbience,
  subscribeExperiencePreferences,
  subscribeFocusAmbience,
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

function useFocusAmbience() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isFocusAmbienceActive());
    return subscribeFocusAmbience(setActive);
  }, []);

  const toggle = async () => {
    if (isFocusAmbienceActive()) {
      stopFocusAmbience();
      return;
    }
    await startFocusAmbience();
    setActive(isFocusAmbienceActive());
  };

  return { active, toggle };
}

export function ExperienceControls({ compact = false }: { compact?: boolean }) {
  const { preferences, update } = useExperiencePreferences();
  const focus = useFocusAmbience();

  if (compact) {
    return (
      <div
        className="flex w-fit items-center gap-0.5 rounded-[var(--radius-md)] bg-secondary p-1 shadow-[var(--shadow-border)]"
        aria-label="Préférences sensorielles"
      >
        <CompactToggle
          pressed={preferences.sounds}
          title={preferences.sounds ? "Désactiver les sons" : "Activer les sons"}
          onClick={() => update({ sounds: !preferences.sounds })}
        >
          {preferences.sounds ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </CompactToggle>
        <CompactToggle
          pressed={preferences.haptics}
          title={preferences.haptics ? "Désactiver les vibrations" : "Activer les vibrations"}
          onClick={() => update({ haptics: !preferences.haptics })}
        >
          {preferences.haptics ? <Zap className="size-4" /> : <ZapOff className="size-4" />}
        </CompactToggle>
        <CompactToggle
          pressed={preferences.enhancedMotion}
          title={
            preferences.enhancedMotion ? "Réduire les animations" : "Activer les animations enrichies"
          }
          onClick={() => update({ enhancedMotion: !preferences.enhancedMotion })}
        >
          <Sparkles className="size-4" />
        </CompactToggle>
        <CompactToggle
          pressed={focus.active}
          title={focus.active ? "Arrêter l’ambiance focus" : "Démarrer l’ambiance focus"}
          onClick={() => void focus.toggle()}
        >
          {focus.active ? <Music2 className="size-4" /> : <Headphones className="size-4" />}
        </CompactToggle>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Préférences sensorielles">
      <SettingToggle
        icon={preferences.sounds ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        label="Sons pédagogiques"
        detail="Réponses, badges et activation Premium"
        pressed={preferences.sounds}
        onClick={() => update({ sounds: !preferences.sounds })}
      />
      <SettingToggle
        icon={preferences.haptics ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
        label="Vibrations"
        detail="Retours tactiles courts sur mobile"
        pressed={preferences.haptics}
        onClick={() => update({ haptics: !preferences.haptics })}
      />
      <SettingToggle
        icon={<Sparkles className="size-5" />}
        label="Animations enrichies"
        detail="Transitions, glow et célébrations discrètes"
        pressed={preferences.enhancedMotion}
        onClick={() => update({ enhancedMotion: !preferences.enhancedMotion })}
      />
      <SettingToggle
        icon={focus.active ? <Music2 className="size-5" /> : <Headphones className="size-5" />}
        label="Ambiance focus"
        detail="Nappe calme, uniquement pour cette session"
        pressed={focus.active}
        onClick={() => void focus.toggle()}
      />
    </div>
  );
}

function CompactToggle({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={title}
      title={title}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-[9px] text-muted transition-[background-color,color,transform] active:scale-95",
        pressed && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );
}

function SettingToggle({
  icon,
  label,
  detail,
  pressed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-20 items-center gap-3 rounded-[var(--radius-lg)] p-3 text-left shadow-[var(--shadow-border)] transition-[background-color,transform,box-shadow] active:scale-[0.99]",
        pressed ? "bg-primary-soft" : "bg-secondary",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          pressed ? "bg-primary text-primary-fg" : "bg-card text-muted",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>
      </span>
      <span
        className={cn(
          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
          pressed ? "bg-primary" : "bg-border-strong",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "block size-4 rounded-full bg-white transition-transform",
            pressed && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
