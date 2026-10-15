// Format des dates locale-aware (C26) : une table locale → étiquette Intl
// partagée par tous les composants, plus de "fr-FR" codé en dur.
import { DEFAULT_LOCALE, type Locale } from "./core.ts";

export const LOCALE_TAGS: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
  pt: "pt-PT",
};

export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS[DEFAULT_LOCALE];
}

const SHORT_DATE = { day: "2-digit", month: "short" } as const;
const FULL_DATE = { day: "2-digit", month: "short", year: "numeric" } as const;
const DATE_TIME = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export function formatShortDate(ts: number, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), SHORT_DATE).format(new Date(ts));
}

export function formatFullDate(ts: number, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), FULL_DATE).format(new Date(ts));
}

export function formatDateTime(ts: number, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), DATE_TIME).format(new Date(ts));
}
