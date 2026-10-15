// Hooks i18n de la Phase 3 : catalogues fr/en, hook useI18n et synchronisation
// de <html lang>/<html dir> avec la locale persistée du store Optimus.
import { useEffect, useMemo } from "react";
import { useOptimus } from "@/state/store";
import { localeDir, translate, type Locale, type MessageCatalog, type MessageParams } from "./core";
import { fr } from "./messages/fr";
import { en } from "./messages/en";

export const CATALOGS: Record<Locale, MessageCatalog> = { fr, en };

export { DEFAULT_LOCALE, LOCALES, isLocale, localeDir } from "./core";
export type { Locale, MessageCatalog, MessageParams } from "./core";

const EMPTY_PARAMS: MessageParams = {};

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDir(locale);
}

export function useLocale(): Locale {
  return useOptimus((s) => s.locale);
}

export function useI18n(): {
  locale: Locale;
  t: (key: string, params?: MessageParams) => string;
  setLocale: (locale: Locale) => void;
} {
  const locale = useLocale();
  const setLocale = useOptimus((s) => s.setLocale);
  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);
  const t = useMemo(
    () => (key: string, params: MessageParams = EMPTY_PARAMS) =>
      translate(locale, key, params, CATALOGS),
    [locale],
  );
  return { locale, t, setLocale };
}
