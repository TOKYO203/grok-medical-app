// Socle i18n de la Phase 3 (design international) : types, locale par défaut
// et résolution de messages avec repli sur le français.
export type Locale = "fr" | "en";

export const LOCALES: readonly Locale[] = ["fr", "en"];

export const DEFAULT_LOCALE: Locale = "fr";

export const RTL_LOCALES: readonly Locale[] = [];

export type MessageParams = Record<string, string | number>;

export type MessageValue = string | ((params: MessageParams) => string);

export type MessageCatalog = Record<string, MessageValue>;

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

const warnedKeys = new Set<string>();

function interpolate(text: string, params: MessageParams): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translate(
  locale: Locale,
  key: string,
  params: MessageParams,
  catalogs: Record<Locale, MessageCatalog>,
): string {
  const fallback = catalogs[DEFAULT_LOCALE] ?? {};
  const entry = (catalogs[locale] ?? fallback)[key] ?? fallback[key];
  if (entry === undefined) {
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn("[i18n] message manquant pour la clé : " + key);
    }
    return key;
  }
  const raw = typeof entry === "function" ? entry(params) : entry;
  return interpolate(raw, params);
}
