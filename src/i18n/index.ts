import {useSyncExternalStore} from "react";
import {LANGUAGE_LABELS, SUPPORTED_LOCALES, localeCatalogs} from "./generated/catalogs";
import {TRANSLATION_KEYS} from "./generated/keys";
import type {LanguageOption, Locale, TranslationKey, TranslationSchema} from "./generated/types";

export const LOCALE_STORAGE_KEY = "appLanguage";
export const APP_LANGUAGE_STORAGE_KEY = LOCALE_STORAGE_KEY;
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;
export type SupportedLanguage = Locale;

const localeSubscribers = new Set<() => void>();
const rootCatalogCache = new Map<Locale, TranslationSchema>();
const supportedLanguageSet = new Set<string>(SUPPORTED_LOCALES);
const LOCALE_ALIASES: Record<string, Locale> = {
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  ja: "ja",
  ko: "ko",
  zh: "zh",
  hi: "hi",
  ru: "ru",
  tr: "tr",
  ar: "ar",
  it: "it",
  nl: "nl",
  pl: "pl",
  vi: "vi",
};

let currentLocale: Locale = "en";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const buildRootCatalog = (locale: Locale): TranslationSchema => {
  const cached = rootCatalogCache.get(locale);
  if (cached) {
    return cached;
  }

  const namespaces = localeCatalogs[locale];
  const rootCatalog = Object.values(namespaces).reduce<Record<string, unknown>>((acc, namespaceValue) => {
    if (!isPlainObject(namespaceValue)) {
      throw new Error(`Invalid namespace catalog for locale ${locale}`);
    }

    return {...acc, ...namespaceValue};
  }, {}) as TranslationSchema;

  rootCatalogCache.set(locale, rootCatalog);
  return rootCatalog;
};

const getValueAtPath = (catalog: TranslationSchema, key: TranslationKey): string => {
  const resolved = key.split(".").reduce<unknown>((current, segment) => {
    if (!isPlainObject(current)) {
      return undefined;
    }

    return current[segment];
  }, catalog);

  if (typeof resolved !== "string") {
    throw new Error(`Missing translation for key "${key}" in locale "${currentLocale}"`);
  }

  return resolved;
};

const formatMessage = (message: string, params?: Record<string, string | number>): string => {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, message);
};

const emitLocaleChange = (): void => {
  localeSubscribers.forEach((listener) => listener());
};

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LANGUAGE_LABELS[code],
}));

const normalizeLocale = (input?: string): Locale => {
  const value = (input ?? "en").toLowerCase();

  if (value.startsWith("id") || value.startsWith("in")) {
    return "id";
  }

  for (const [prefix, locale] of Object.entries(LOCALE_ALIASES)) {
    if (value.startsWith(prefix)) {
      return locale;
    }
  }

  return "en";
};

export const isSupportedLanguage = (language: string): language is Locale => {
  return supportedLanguageSet.has(language);
};

export const getLanguageLabel = (language: Locale): string => {
  const option = LANGUAGE_OPTIONS.find((entry) => entry.code === language);
  return option?.label ?? "English";
};

export const getLocale = (): Locale => currentLocale;

export const getRootCatalog = (locale: Locale = currentLocale): TranslationSchema => buildRootCatalog(locale);

export const loadLocale = async (locale: Locale): Promise<TranslationSchema> => {
  return buildRootCatalog(locale);
};

export const setLocale = (locale: Locale): void => {
  buildRootCatalog(locale);
  currentLocale = locale;
  emitLocaleChange();
};

export const detectDeviceLanguage = (locale?: string): Locale => {
  const resolved = normalizeLocale(locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "en");
  setLocale(resolved);
  return resolved;
};

export const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
  return formatMessage(getValueAtPath(buildRootCatalog(currentLocale), key), params);
};

const subscribe = (listener: () => void): (() => void) => {
  localeSubscribers.add(listener);
  return () => {
    localeSubscribers.delete(listener);
  };
};

export const useT = (): typeof t => {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);

  return (key, params) => {
    return formatMessage(getValueAtPath(buildRootCatalog(locale), key), params);
  };
};

export const useLocale = (): Locale => {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
};

export const translationKeys = TRANSLATION_KEYS;

export type {LanguageOption, Locale, TranslationKey, TranslationSchema};
