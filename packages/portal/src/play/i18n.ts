import {useSyncExternalStore} from "react";
import enAboutLegal from "../../../../src/locales/en/aboutLegal.json";
import enAccessibility from "../../../../src/locales/en/accessibility.json";
import enAchievements from "../../../../src/locales/en/achievements.json";
import enAlerts from "../../../../src/locales/en/alerts.json";
import enCoinPurchase from "../../../../src/locales/en/coinPurchase.json";
import enCommon from "../../../../src/locales/en/common.json";
import enCredits from "../../../../src/locales/en/credits.json";
import enErrors from "../../../../src/locales/en/errors.json";
import enGame from "../../../../src/locales/en/game.json";
import enLeaderboard from "../../../../src/locales/en/leaderboard.json";
import enLevelUpFanfare from "../../../../src/locales/en/levelUpFanfare.json";
import enLoss from "../../../../src/locales/en/loss.json";
import enNavigation from "../../../../src/locales/en/navigation.json";
import enOnboarding from "../../../../src/locales/en/onboarding.json";
import enProfile from "../../../../src/locales/en/profile.json";
import enSettings from "../../../../src/locales/en/settings.json";
import enShop from "../../../../src/locales/en/shop.json";
import enStats from "../../../../src/locales/en/stats.json";
import enStreakFanfare from "../../../../src/locales/en/streakFanfare.json";
import enTooltips from "../../../../src/locales/en/tooltips.json";
import enVictory from "../../../../src/locales/en/victory.json";
import enRace from "../../../../src/locales/en/race.json";
import {loadNonEnglishNamespace} from "./localeModules";

export type Locale =
  "en" | "es" | "pt" | "fr" | "de" | "ja" | "ko" | "zh" | "hi" | "ru" | "tr" | "ar" | "id" | "it" | "nl" | "pl" | "vi";

export type Namespace =
  | "aboutLegal"
  | "accessibility"
  | "achievements"
  | "alerts"
  | "coinPurchase"
  | "common"
  | "credits"
  | "errors"
  | "game"
  | "leaderboard"
  | "levelUpFanfare"
  | "loss"
  | "navigation"
  | "onboarding"
  | "profile"
  | "settings"
  | "shop"
  | "stats"
  | "streakFanfare"
  | "tooltips"
  | "victory"
  | "race";

export type NamespaceCatalog = Record<string, unknown>;
type RootCatalog = Record<string, unknown>;

const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "zh",
  "hi",
  "ru",
  "tr",
  "ar",
  "id",
  "it",
  "nl",
  "pl",
  "vi",
] as const satisfies readonly Locale[];

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  zh: "简体中文",
  hi: "हिन्दी",
  ru: "Русский",
  tr: "Türkçe",
  ar: "العربية",
  id: "Bahasa Indonesia",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  vi: "Tiếng Việt",
};

const REQUIRED_NAMESPACES = [
  "aboutLegal",
  "accessibility",
  "achievements",
  "alerts",
  "coinPurchase",
  "common",
  "credits",
  "errors",
  "game",
  "leaderboard",
  "levelUpFanfare",
  "loss",
  "navigation",
  "onboarding",
  "profile",
  "settings",
  "shop",
  "stats",
  "streakFanfare",
  "tooltips",
  "victory",
  "race",
] as const satisfies readonly Namespace[];

const ENGLISH_NAMESPACES: NamespaceCatalog[] = [
  enAboutLegal,
  enAccessibility,
  enAchievements,
  enAlerts,
  enCoinPurchase,
  enCommon,
  enCredits,
  enErrors,
  enGame,
  enLeaderboard,
  enLevelUpFanfare,
  enLoss,
  enNavigation,
  enOnboarding,
  enProfile,
  enSettings,
  enShop,
  enStats,
  enStreakFanfare,
  enTooltips,
  enVictory,
  enRace,
];

const ENGLISH_NAMESPACE_BY_NAME: Record<Namespace, NamespaceCatalog> = {
  aboutLegal: enAboutLegal,
  accessibility: enAccessibility,
  achievements: enAchievements,
  alerts: enAlerts,
  coinPurchase: enCoinPurchase,
  common: enCommon,
  credits: enCredits,
  errors: enErrors,
  game: enGame,
  leaderboard: enLeaderboard,
  levelUpFanfare: enLevelUpFanfare,
  loss: enLoss,
  navigation: enNavigation,
  onboarding: enOnboarding,
  profile: enProfile,
  settings: enSettings,
  shop: enShop,
  stats: enStats,
  streakFanfare: enStreakFanfare,
  tooltips: enTooltips,
  victory: enVictory,
  race: enRace,
};

const localeSubscribers = new Set<() => void>();
const catalogCache = new Map<Locale, RootCatalog>();
const loadingLocales = new Map<Locale, Promise<RootCatalog>>();
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

const mergeNamespaces = (namespaces: readonly NamespaceCatalog[]): RootCatalog => {
  return namespaces.reduce<RootCatalog>((acc, namespaceValue) => {
    if (!isPlainObject(namespaceValue)) {
      throw new Error("Invalid namespace catalog.");
    }
    return {...acc, ...namespaceValue};
  }, {});
};

catalogCache.set("en", mergeNamespaces(ENGLISH_NAMESPACES));

const importNamespace = async (locale: Locale, namespace: Namespace): Promise<NamespaceCatalog> => {
  if (locale === "en") {
    return ENGLISH_NAMESPACE_BY_NAME[namespace];
  }

  return loadNonEnglishNamespace(locale, namespace);
};

const emitLocaleChange = (): void => {
  localeSubscribers.forEach((listener) => listener());
};

const loadLocaleCatalog = async (locale: Locale): Promise<RootCatalog> => {
  const cached = catalogCache.get(locale);
  if (cached) {
    return cached;
  }

  const inFlight = loadingLocales.get(locale);
  if (inFlight) {
    return inFlight;
  }

  const nextLoad = Promise.all(REQUIRED_NAMESPACES.map((namespace) => importNamespace(locale, namespace)))
    .then((namespaces) => {
      const catalog = mergeNamespaces(namespaces);
      catalogCache.set(locale, catalog);
      loadingLocales.delete(locale);
      return catalog;
    })
    .catch((error) => {
      loadingLocales.delete(locale);
      throw error;
    });

  loadingLocales.set(locale, nextLoad);
  return nextLoad;
};

const getCatalogForRender = (locale: Locale): RootCatalog => {
  return catalogCache.get(locale) ?? catalogCache.get("en")!;
};

const getValueAtPath = (catalog: RootCatalog, key: string): string | undefined => {
  const resolved = key.split(".").reduce<unknown>((current, segment) => {
    if (!isPlainObject(current)) {
      return undefined;
    }
    return current[segment];
  }, catalog);

  return typeof resolved === "string" ? resolved : undefined;
};

const formatMessage = (message: string, params?: Record<string, string | number>): string => {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, message);
};

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

export const LANGUAGE_OPTIONS: readonly {code: Locale; label: string}[] = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LANGUAGE_LABELS[code],
}));

export const getLanguageLabel = (language: Locale): string => {
  return LANGUAGE_LABELS[language] ?? LANGUAGE_LABELS.en;
};

const getLocale = (): Locale => currentLocale;

export const setLocale = (locale: Locale): void => {
  currentLocale = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }
  emitLocaleChange();
  void loadLocaleCatalog(locale)
    .then(() => emitLocaleChange())
    .catch((error) => {
      console.warn("[riddle-quest-web] Failed to load locale", locale, error);
    });
};

export const detectDeviceLanguage = (locale?: string): Locale => {
  const resolved = normalizeLocale(locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "en");
  setLocale(resolved);
  return resolved;
};

export const tr = (key: string, params?: Record<string, string | number>): string => {
  const activeMessage = getValueAtPath(getCatalogForRender(currentLocale), key);
  const fallbackMessage = getValueAtPath(getCatalogForRender("en"), key);
  if (!activeMessage && !fallbackMessage) {
    throw new Error(`Missing translation for key "${key}" in locale "${currentLocale}"`);
  }
  return formatMessage(activeMessage ?? fallbackMessage!, params);
};

const subscribe = (listener: () => void): (() => void) => {
  localeSubscribers.add(listener);
  return () => {
    localeSubscribers.delete(listener);
  };
};

export const useLocale = (): Locale => {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
};
