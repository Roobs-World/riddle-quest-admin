"use strict";

const fs = require("fs");

const LOCALES = [
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
];

const LANGUAGE_LABELS = {
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

const SECTION_TO_NAMESPACE = {
  AuthStrings: "auth",
  Navigation: "navigation",
  NavigationMessages: "navigation",
  Settings: "settings",
  AboutLegal: "aboutLegal",
  Credits: "credits",
  WelcomeModal: "onboarding",
  WelcomeBackModal: "onboarding",
  Instructions: "onboarding",
  Profile: "profile",
  Ranks: "profile",
  TestStrings: "test",
  RewardedAdPrompts: "ads",
  ErrorMessages: "errors",
  CommonButtons: "common",
  DevTools: "devtools",
  GameMessages: "game",
  LogMessages: "logs",
  GameScreenAlerts: "alerts",
  Tooltips: "tooltips",
  VictoryModal: "victory",
  LossModal: "loss",
  Achievements: "achievements",
  CoinPurchase: "coinPurchase",
  StreakFanfare: "streakFanfare",
  LevelUpFanfare: "levelUpFanfare",
  Leaderboard: "leaderboard",
  StatsModal: "stats",
  CoinShop: "shop",
  CommonAlerts: "common",
  Accessibility: "accessibility",
};

const NAMESPACE_TO_SECTIONS = Object.entries(SECTION_TO_NAMESPACE).reduce((acc, [section, namespace]) => {
  if (!acc[namespace]) {
    acc[namespace] = [];
  }
  acc[namespace].push(section);
  return acc;
}, {});

const NON_TRANSLATABLE_KEY_ALLOWLIST = new Set([
  "accessibility.Accessibility.LANDING_ATTRIBUTION_LINK",
  "auth.AuthStrings.Landing.MADE_BY_ROOBS_WORLD",
  "stats.StatsModal.XP",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true});
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenLeafPaths(value, prefix = "") {
  if (!isPlainObject(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLeafPaths(child, nextPrefix);
  });
}

function getValueAtPath(value, pathExpression) {
  return pathExpression.split(".").reduce((current, segment) => {
    if (!isPlainObject(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

function toTsObjectLiteral(value, indent = 0) {
  const padding = "  ".repeat(indent);
  const childPadding = "  ".repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const items = value.map((entry) => `${childPadding}${toTsObjectLiteral(entry, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${padding}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }

    const items = entries.map(([key, entry]) => `${childPadding}${JSON.stringify(key)}: ${toTsObjectLiteral(entry, indent + 1)}`);
    return `{\n${items.join(",\n")}\n${padding}}`;
  }

  return JSON.stringify(value);
}

module.exports = {
  NON_TRANSLATABLE_KEY_ALLOWLIST,
  LOCALES,
  LANGUAGE_LABELS,
  NAMESPACE_TO_SECTIONS,
  ensureDir,
  flattenLeafPaths,
  getValueAtPath,
  isPlainObject,
  toTsObjectLiteral,
};
