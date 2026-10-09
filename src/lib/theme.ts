import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "optimus-theme-v1";
const CHANGE_EVENT = "optimus:theme";
const DEFAULT_MODE: ThemeMode = "light";

/**
 * Script inline injecté dans <head> : applique le thème avant le premier paint
 * pour éviter tout flash clair/sombre. Doit rester en phase avec `theme.ts`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'${DEFAULT_MODE}';var d=m==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;var r=d==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r;}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

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

/** Applique le thème au document (attribut `data-theme` + couleur de barre navigateur). */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0c1110" : "#f3f6f4");
  }
  return resolved;
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

/** Hook React : mode de thème courant + setter persistant. */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);

  useEffect(() => {
    const current = readThemeMode();
    setMode(current);
    applyTheme(current);
    return subscribeTheme(setMode);
  }, []);

  const setTheme = (next: ThemeMode) => {
    writeThemeMode(next);
    setMode(next);
  };

  return { mode, resolved: resolveTheme(mode), setTheme };
}
