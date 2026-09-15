export type ExperiencePreferences = {
  sounds: boolean;
  haptics: boolean;
  enhancedMotion: boolean;
};

export type ExperienceCue = "correct" | "incorrect" | "complete" | "badge" | "premium";

const STORAGE_KEY = "optimus-experience-v1";
const CHANGE_EVENT = "optimus:experience-preferences";

export const DEFAULT_EXPERIENCE_PREFERENCES: ExperiencePreferences = {
  sounds: true,
  haptics: true,
  enhancedMotion: true,
};

let audioContext: AudioContext | null = null;

export function readExperiencePreferences(): ExperiencePreferences {
  if (typeof window === "undefined") return DEFAULT_EXPERIENCE_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_EXPERIENCE_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<ExperiencePreferences>;
    return {
      sounds: typeof parsed.sounds === "boolean" ? parsed.sounds : true,
      haptics: typeof parsed.haptics === "boolean" ? parsed.haptics : true,
      enhancedMotion:
        typeof parsed.enhancedMotion === "boolean" ? parsed.enhancedMotion : true,
    };
  } catch {
    return DEFAULT_EXPERIENCE_PREFERENCES;
  }
}

export function writeExperiencePreferences(next: ExperiencePreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
}

export function subscribeExperiencePreferences(
  listener: (preferences: ExperiencePreferences) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const refresh = () => listener(readExperiencePreferences());
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<ExperiencePreferences>).detail;
    listener(detail ?? readExperiencePreferences());
  };

  window.addEventListener("storage", refresh);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  return audioContext;
}

function playNote(
  context: AudioContext,
  frequency: number,
  offsetSeconds: number,
  durationSeconds: number,
  peakGain: number,
  type: OscillatorType = "sine",
) {
  const now = context.currentTime + offsetSeconds;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds + 0.02);
}

function playCueSound(cue: ExperienceCue) {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  switch (cue) {
    case "correct":
      playNote(context, 523.25, 0, 0.11, 0.045, "sine");
      playNote(context, 659.25, 0.07, 0.13, 0.04, "sine");
      break;
    case "incorrect":
      playNote(context, 246.94, 0, 0.16, 0.035, "triangle");
      playNote(context, 196, 0.07, 0.16, 0.025, "triangle");
      break;
    case "complete":
      playNote(context, 392, 0, 0.16, 0.035, "sine");
      playNote(context, 523.25, 0.08, 0.18, 0.04, "sine");
      playNote(context, 659.25, 0.17, 0.22, 0.045, "sine");
      break;
    case "badge":
      playNote(context, 659.25, 0, 0.14, 0.035, "sine");
      playNote(context, 783.99, 0.09, 0.18, 0.04, "sine");
      break;
    case "premium":
      playNote(context, 440, 0, 0.15, 0.03, "sine");
      playNote(context, 554.37, 0.08, 0.18, 0.035, "sine");
      playNote(context, 659.25, 0.16, 0.22, 0.04, "sine");
      break;
  }
}

function playCueHaptic(cue: ExperienceCue) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  switch (cue) {
    case "correct":
      navigator.vibrate(12);
      break;
    case "incorrect":
      navigator.vibrate([18, 32, 18]);
      break;
    case "complete":
    case "badge":
      navigator.vibrate([14, 38, 22]);
      break;
    case "premium":
      navigator.vibrate([16, 28, 16, 28, 24]);
      break;
  }
}

export function emitExperienceFeedback(
  cue: ExperienceCue,
  preferences = readExperiencePreferences(),
) {
  if (preferences.sounds) playCueSound(cue);
  if (preferences.haptics) playCueHaptic(cue);
}
