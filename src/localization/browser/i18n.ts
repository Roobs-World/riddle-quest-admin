import {useSyncExternalStore} from "react";
import type {SupportedLocale} from "../locales";
import enAboutLegal from "../../locales/en/aboutLegal.json";
import enAccessibility from "../../locales/en/accessibility.json";
import enAchievements from "../../locales/en/achievements.json";
import enAlerts from "../../locales/en/alerts.json";
import enCoinPurchase from "../../locales/en/coinPurchase.json";
import enCommon from "../../locales/en/common.json";
import enCredits from "../../locales/en/credits.json";
import enErrors from "../../locales/en/errors.json";
import enGame from "../../locales/en/game.json";
import enLeaderboard from "../../locales/en/leaderboard.json";
import enLevelUpFanfare from "../../locales/en/levelUpFanfare.json";
import enLoss from "../../locales/en/loss.json";
import enNavigation from "../../locales/en/navigation.json";
import enOnboarding from "../../locales/en/onboarding.json";
import enProfile from "../../locales/en/profile.json";
import enSettings from "../../locales/en/settings.json";
import enShop from "../../locales/en/shop.json";
import enStats from "../../locales/en/stats.json";
import enStreakFanfare from "../../locales/en/streakFanfare.json";
import enTooltips from "../../locales/en/tooltips.json";
import enVictory from "../../locales/en/victory.json";
import enRace from "../../locales/en/race.json";

/** Existing language inputs remain readable; the Jest client always renders English. */
export type Locale = SupportedLocale;

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

export type Namespace = SharedNamespace;
export type NamespaceCatalog = Record<string, unknown>;
type RootCatalog = Record<string, unknown>;

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


const catalog = ENGLISH_NAMESPACES.reduce<RootCatalog>((merged, namespace) => ({...merged, ...namespace}), {});
const localeSubscribers = new Set<() => void>();

/** Jest exposes only its approved English catalog. */
export const isSupportedLocale = (value: string): value is Locale => value === "en";
export const LANGUAGE_OPTIONS: readonly {code: Locale; label: string}[] = [{code: "en", label: "English"}];
export const getLanguageLabel = (_language: Locale): string => "English";
export const getCurrentLocale = (): Locale => "en";

/** Saved preferences cannot change the language approved for the Jest artifact. */
export const setLocaleAndWait = async (_requestedLocale: Locale): Promise<void> => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
  for (const listener of localeSubscribers) listener();
};

export const setLocale = (locale: Locale): void => {
  void setLocaleAndWait(locale);
};

export const detectDeviceLanguage = (_locale?: string): Locale => {
  setLocale("en");
  return "en";
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads one message from the bundled English namespace catalogs. */
const getMessage = (key: string): string => {
  const value = key.split(".").reduce<unknown>((current, segment) =>
    isPlainObject(current) ? current[segment] : undefined, catalog);
  if (typeof value !== "string") throw new Error(`Missing translation for key "${key}" in locale "en"`);
  return value;
};

/** Resolves English copy and replaces only its explicit interpolation tokens. */
export const tr = (key: string, params?: Record<string, string | number>): string =>
  Object.entries(params ?? {}).reduce((message, [name, value]) =>
    message.replace(new RegExp(`\\{${name}\\}`, "g"), String(value)), getMessage(key));

const subscribe = (listener: () => void): (() => void) => {
  localeSubscribers.add(listener);
  return () => {localeSubscribers.delete(listener);};
};

export const useLocale = (): Locale => useSyncExternalStore(subscribe, getCurrentLocale, getCurrentLocale);
export const useTranslator = (): typeof tr => tr;
