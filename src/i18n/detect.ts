// Détection de la langue au premier lancement (C22) : on devine la locale
// depuis les langues du navigateur, sans jamais écraser un choix explicite.
// PWA hors-ligne : aucune géolocalisation réseau, uniquement le client.
import { useOptimus } from "@/state/store";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./core";

export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (primary === "fr" || primary === "en" || primary === "es" || primary === "pt") {
      return primary;
    }
  }
  return DEFAULT_LOCALE;
}

// Clé de persistance du store Optimus (cf. src/state/store.ts).
const OPTIMUS_PERSIST_KEY = "optimus-v2";
// Marqueur posé quand l'utilisateur choisit lui-même une langue dans le profil.
const LOCALE_CHOSEN_KEY = "optimus.locale.chosen.v1";

export function markLocaleChosen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_CHOSEN_KEY, "1");
  } catch {
    /* stockage indisponible (navigation privée) : la détection restera inoffensive */
  }
}

function readPersistedLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(OPTIMUS_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { locale?: unknown } };
    const value = parsed?.state?.locale;
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function navigatorLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  if (navigator.languages && navigator.languages.length > 0) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

/**
 * Applique la langue détectée, une seule fois par appareil :
 * - jamais si l'utilisateur a choisi une langue dans le profil (marqueur) ;
 * - jamais si la locale persistée n'est pas le français par défaut
 *   (un choix explicite antérieur doit être respecté) ;
 * - jamais côté serveur, et sans effet si la détection retombe sur le français.
 */
export function applyDetectedLocale(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    if (window.localStorage.getItem(LOCALE_CHOSEN_KEY) !== null) return false;
  } catch {
    return false;
  }
  const persisted = readPersistedLocale();
  if (persisted !== null && persisted !== DEFAULT_LOCALE) return false;
  const detected = detectLocale(navigatorLanguages());
  if (detected === DEFAULT_LOCALE) return false;
  useOptimus.getState().setLocale(detected);
  return true;
}
