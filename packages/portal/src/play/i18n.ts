import {useCallback, useSyncExternalStore} from "react";
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

/** Describes locale. */
export type Locale =
  "en" | "es" | "pt" | "fr" | "de" | "ja" | "ko" | "hi" | "ru" | "tr" | "ar" | "id" | "it" | "nl" | "pl" | "vi";

/** Describes namespace. */
export type SharedNamespace =
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
/** Describes every namespace known to the translation contract. */
export type Namespace = SharedNamespace | "redditPlatform";

/** Describes namespace catalog. */
export type NamespaceCatalog = Record<string, unknown>;
/** Describes root catalog. */
type RootCatalog = Record<string, unknown>;

/** Defines the supported locales value. */
const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
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

/** Defines the language labels value. */
const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
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

/** Defines the required namespaces value. */
const SHARED_NAMESPACES = [
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
] as const satisfies readonly SharedNamespace[];

/** Defines the english namespaces value. */
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

/** Defines the english namespace by name value. */
const ENGLISH_NAMESPACE_BY_NAME: Record<SharedNamespace, NamespaceCatalog> = {
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

/** Describes a locale namespace installed by one explicit target composition root. */
type TargetLocaleNamespaceRegistration = Readonly<{
  /** Stores namespace. */
  namespace: Exclude<Namespace, SharedNamespace>;
  /** Stores english. */
  english: NamespaceCatalog;
  /** Provides load behavior. */
  load(locale: Exclude<Locale, "en">): Promise<NamespaceCatalog>;
}>;

/** Provides locale subscribers behavior. */
const localeSubscribers = new Set<() => void>();
/** Provides catalog cache behavior. */
const catalogCache = new Map<Locale, RootCatalog>();
/** Loads ing locales. */
const loadingLocales = new Map<Locale, Promise<RootCatalog>>();
/** Target-owned namespaces installed by an explicit target composition root. */
const targetLocaleNamespaces = new Map<Namespace, TargetLocaleNamespaceRegistration>();
/** Provides supported language set behavior. */
const supportedLanguageSet = new Set<string>(SUPPORTED_LOCALES);

/** Narrows untrusted language values without importing schema libraries into startup. */
export const isSupportedLocale = (value: string): value is Locale => supportedLanguageSet.has(value);
/** Defines the locale aliases value. */
const LOCALE_ALIASES: Record<string, Locale> = {
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  ja: "ja",
  ko: "ko",
  hi: "hi",
  ru: "ru",
  tr: "tr",
  ar: "ar",
  it: "it",
  nl: "nl",
  pl: "pl",
  vi: "vi",
};

/** Provides current locale behavior. */
let currentLocale: Locale = "en";
/** Identifies the newest locale request so stale asynchronous loads cannot commit. */
let localeRequestVersion = 0;

/** Indicates whether is plain object. */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** Provides merge namespaces behavior. */
const mergeNamespaces = (namespaces: readonly NamespaceCatalog[]): RootCatalog => {
  return namespaces.reduce<RootCatalog>((acc, namespaceValue) => {
    if (!isPlainObject(namespaceValue)) {
      throw new Error("Invalid namespace catalog.");
    }
    return {...acc, ...namespaceValue};
  }, {});
};

/** Rebuilds the cached English catalog after target namespace registration. */
const rebuildEnglishCatalog = (): void => {
  catalogCache.set(
    "en",
    mergeNamespaces([...ENGLISH_NAMESPACES, ...[...targetLocaleNamespaces.values()].map(({english}) => english)]),
  );
};

rebuildEnglishCatalog();

/** Installs copy owned by the active target before locale loading begins. */
export function registerTargetLocaleNamespace(registration: TargetLocaleNamespaceRegistration): void {
  if (loadingLocales.size > 0 || [...catalogCache.keys()].some((locale) => locale !== "en")) {
    throw new Error("target-locale-namespace-registration-late");
  }
  if (!isPlainObject(registration.english)) {
    throw new Error("target-locale-namespace-invalid");
  }
  targetLocaleNamespaces.set(registration.namespace, registration);
  rebuildEnglishCatalog();
}

/** Provides import namespace behavior. */
const importSharedNamespace = async (locale: Locale, namespace: SharedNamespace): Promise<NamespaceCatalog> => {
  if (locale === "en") {
    return ENGLISH_NAMESPACE_BY_NAME[namespace];
  }

  /** Provides {load non english namespace} behavior. */
  const {loadNonEnglishNamespace} = await import("./localeModules");
  return loadNonEnglishNamespace(locale, namespace);
};

/** Provides emit locale change behavior. */
const emitLocaleChange = (): void => {
  localeSubscribers.forEach((listener) => listener());
};

/** Loads locale catalog. */
const loadLocaleCatalog = async (locale: Locale): Promise<RootCatalog> => {
  /** Provides cached behavior. */
  const cached = catalogCache.get(locale);
  if (cached) {
    return cached;
  }

  /** Provides in flight behavior. */
  const inFlight = loadingLocales.get(locale);
  if (inFlight) {
    return inFlight;
  }

  /** Provides next load behavior. */
  const nextLoad = Promise.all([
    ...SHARED_NAMESPACES.map((namespace) => importSharedNamespace(locale, namespace)),
    ...[...targetLocaleNamespaces.values()].map((registration) =>
      locale === "en" ? registration.english : registration.load(locale),
    ),
  ])
    .then((namespaces) => {
      /** Provides catalog behavior. */
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

/** Gets catalog for render. */
const getCatalogForRender = (locale: Locale): RootCatalog => {
  return catalogCache.get(locale) ?? catalogCache.get("en")!;
};

/** Gets value at path. */
const getValueAtPath = (catalog: RootCatalog, key: string): string | undefined => {
  /** Resolves d. */
  const resolved = key.split(".").reduce<unknown>((current, segment) => {
    if (!isPlainObject(current)) {
      return undefined;
    }
    return current[segment];
  }, catalog);

  return typeof resolved === "string" ? resolved : undefined;
};

/** Formats message. */
const formatMessage = (message: string, params?: Record<string, string | number>): string => {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, message);
};

/** Normalizes locale. */
const normalizeLocale = (input?: string): Locale => {
  /** Provides value behavior. */
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

/** Defines the language options value. */
export const LANGUAGE_OPTIONS: readonly {
  /** Stores code. */
  code: Locale; /** Stores label. */
  /** Stores label. */
  label: string;
}[] = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LANGUAGE_LABELS[code],
}));

/** Gets language label. */
export const getLanguageLabel = (language: Locale): string => {
  return LANGUAGE_LABELS[language] ?? LANGUAGE_LABELS.en;
};

/** Gets locale. */
const getLocale = (): Locale => currentLocale;

/** Returns the active locale for non-React platform capability coordinators. */
export const getCurrentLocale = (): Locale => getLocale();

/** Commits a locale whose catalog is ready to render. */
const commitLocale = (locale: Locale): void => {
  currentLocale = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }
  emitLocaleChange();
};

/** Waits for translated copy before committing the requested locale. */
export const setLocaleAndWait = async (locale: Locale): Promise<void> => {
  /** Requests version. */
  const requestVersion = ++localeRequestVersion;
  /** Provides previous locale behavior. */
  const previousLocale = currentLocale;
  if (catalogCache.has(locale)) {
    commitLocale(locale);
    return;
  }

  try {
    await loadLocaleCatalog(locale);
    if (requestVersion !== localeRequestVersion) return;
    commitLocale(locale);
  } catch (error) {
    if (requestVersion === localeRequestVersion) commitLocale(previousLocale);
    throw error;
  }
};

/** Applies a preference without blocking an already mounted game. */
export const setLocale = (locale: Locale): void => {
  void setLocaleAndWait(locale).catch((error) => {
    console.warn("[riddle-quest-web] Failed to load locale", locale, error);
  });
};

/** Provides detect device language behavior. */
export const detectDeviceLanguage = (locale?: string): Locale => {
  /** Resolves d. */
  const resolved = normalizeLocale(locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "en");
  setLocale(resolved);
  return resolved;
};

/** Resolves copy from an explicit, fully loaded locale. */
const translate = (locale: Locale, key: string, params?: Record<string, string | number>): string => {
  /** Provides active message behavior. */
  const activeMessage = getValueAtPath(getCatalogForRender(locale), key);
  /** Provides fallback message behavior. */
  const fallbackMessage = getValueAtPath(getCatalogForRender("en"), key);
  if (!activeMessage && !fallbackMessage) {
    throw new Error(`Missing translation for key "${key}" in locale "${locale}"`);
  }
  return formatMessage(activeMessage ?? fallbackMessage!, params);
};

/** Resolves current copy for non-React platform coordinators and event handlers. */
export const tr = (key: string, params?: Record<string, string | number>): string => translate(currentLocale, key, params);

/** Provides subscribe behavior. */
const subscribe = (listener: () => void): (() => void) => {
  localeSubscribers.add(listener);
  return () => {
    localeSubscribers.delete(listener);
  };
};

/** Provides locale. */
export const useLocale = (): Locale => {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
};

/** Gives compiled React renders an explicit locale dependency without remounting their state. */
export const useTranslator = (): typeof tr => {
  /** Current locale keeps the compiled translation callback synchronized. */
  const locale = useLocale();
  return useCallback((key: string, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
};
