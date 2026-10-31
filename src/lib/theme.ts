import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Palette d'accent — réglage ORTHOGONAL au thème : elle colore la signature
 * dorée (kickers, filets, focus, badges) ET teinte les surfaces de fond
 * (immersion — voir les blocs de palette de styles.css) dans les trois modes
 * clair / sombre / système. « defaut » garde l'or Oxford d'origine.
 */
export type AccentPalette = "defaut" | "rose" | "marron" | "marine" | "vert" | "violet" | "royal";

export const THEME_STORAGE_KEY = "optimus-theme-v1";
export const ACCENT_STORAGE_KEY = "optimus-accent-v1";
const CHANGE_EVENT = "optimus:theme";
const ACCENT_CHANGE_EVENT = "optimus:accent";
const DEFAULT_MODE: ThemeMode = "light";
const DEFAULT_ACCENT: AccentPalette = "defaut";

/** Catalogue des palettes proposées par le profil (source du sélecteur). */
export const ACCENT_PALETTES: AccentPalette[] = [
  "defaut", "rose", "marron", "marine", "vert", "violet", "royal",
];

function isAccentPalette(value: string | null): value is AccentPalette {
  return ACCENT_PALETTES.includes(value as AccentPalette);
}

/**
 * Script inline injecté dans <head> : applique le thème ET la palette d'accent
 * avant le premier paint pour éviter tout flash clair/sombre ou or/rose.
 * Doit rester en phase avec `theme.ts`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'${DEFAULT_MODE}';var d=m==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;var r=d==='dark'?'dark':'light';var a=localStorage.getItem('${ACCENT_STORAGE_KEY}')||'${DEFAULT_ACCENT}';document.documentElement.setAttribute('data-theme',r);document.documentElement.setAttribute('data-accent',a);document.documentElement.style.colorScheme=r;}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode === "dark" ? "dark" : "light";
}

export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" || stored === "system" ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function readAccentPalette(): AccentPalette {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentPalette(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/**
 * Barre du navigateur (meta theme-color) : suit le fond RÉEL de l'écran — le
 * parchemin de base ou le fond teinté par la palette d'accent (immersion).
 */
function syncThemeColorMeta(resolved: ResolvedTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  let tinted = "";
  try {
    tinted = getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim();
  } catch {
    /* style indisponible — repli sur les fonds de base ci-dessous */
  }
  meta.setAttribute("content", tinted || (resolved === "dark" ? "#130F23" : "#F4F1FA"));
}

/** Applique le thème au document (attribut `data-theme` + couleur de barre navigateur). */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
    syncThemeColorMeta(resolved);
  }
  return resolved;
}

/** Applique la palette d'accent au document (attribut `data-accent` sur <html>). */
export function applyAccentPalette(palette: AccentPalette) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-accent", palette);
    // Le fond teinté change avec la palette : la barre du navigateur suit.
    syncThemeColorMeta(resolveTheme(readThemeMode()));
  }
}

export function writeThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* stockage indisponible — le thème reste appliqué pour la session */
  }
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: mode }));
}

export function writeAccentPalette(palette: AccentPalette) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, palette);
  } catch {
    /* stockage indisponible — l'accent reste appliqué pour la session */
  }
  applyAccentPalette(palette);
  window.dispatchEvent(new CustomEvent(ACCENT_CHANGE_EVENT, { detail: palette }));
}

export function subscribeTheme(listener: (mode: ThemeMode) => void) {
  if (typeof window === "undefined") return () => undefined;
  const refresh = () => listener(readThemeMode());
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<ThemeMode>).detail;
    listener(detail ?? readThemeMode());
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (readThemeMode() === "system") {
      applyTheme("system");
      listener("system");
    }
  };

  window.addEventListener("storage", refresh);
  window.addEventListener(CHANGE_EVENT, onCustom);
  media.addEventListener?.("change", onMedia);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener(CHANGE_EVENT, onCustom);
    media.removeEventListener?.("change", onMedia);
  };
}

export function subscribeAccent(listener: (palette: AccentPalette) => void) {
  if (typeof window === "undefined") return () => undefined;
  const refresh = () => listener(readAccentPalette());
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<AccentPalette>).detail;
    listener(detail ?? readAccentPalette());
  };

  window.addEventListener("storage", refresh);
  window.addEventListener(ACCENT_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener(ACCENT_CHANGE_EVENT, onCustom);
  };
}

/** Hook React : mode de thème + palette d'accent, avec setters persistants. */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);
  const [accent, setAccentState] = useState<AccentPalette>(DEFAULT_ACCENT);

  useEffect(() => {
    const currentMode = readThemeMode();
    setMode(currentMode);
    applyTheme(currentMode);
    const currentAccent = readAccentPalette();
    setAccentState(currentAccent);
    applyAccentPalette(currentAccent);

    const unsubscribeTheme = subscribeTheme(setMode);
    const unsubscribeAccent = subscribeAccent(setAccentState);
    return () => {
      unsubscribeTheme();
      unsubscribeAccent();
    };
  }, []);

  const setTheme = (next: ThemeMode) => {
    writeThemeMode(next);
    setMode(next);
  };

  const setAccent = (next: AccentPalette) => {
    writeAccentPalette(next);
    setAccentState(next);
  };

  return { mode, resolved: resolveTheme(mode), setTheme, accent, setAccent };
}