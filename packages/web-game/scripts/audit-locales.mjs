import {readdir, readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  hasQuestionMarkReplacementText,
  isUnsupportedJestLocaleKey,
} from "./locale-audit-rules.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeRoot = path.resolve(packageRoot, "../../src/locales");
const expectedLocales = [
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",

];
const expectedNamespaces = [
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
  "race",
  "redditPlatform",
  "settings",
  "shop",
  "stats",
  "streakFanfare",
  "tooltips",
  "victory",
];

const flatten = (value, prefix = "", output = new Map()) => {
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, nextKey, output);
    } else {
      output.set(nextKey, child);
    }
  }
  return output;
};

const placeholders = (value) =>
  typeof value === "string" ? [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort() : [];

/** Detects unreplaced protected tokens left behind by translation tooling. */
const hasProtectedTranslationToken = (value) =>
  typeof value === "string" && /__[^\r\n]{1,80}?__/u.test(value);

const actualLocales = (
  await Promise.all(
    (await readdir(localeRoot)).map(async (entry) => ({
      entry,
      directory: (await stat(path.join(localeRoot, entry))).isDirectory(),
    })),
  )
)
  .filter(({directory}) => directory)
  .map(({entry}) => entry)
  .sort();

const errors = [];
if (JSON.stringify(actualLocales) !== JSON.stringify(expectedLocales)) {
  errors.push(`Locales differ: expected ${expectedLocales.join(", ")}, found ${actualLocales.join(", ")}`);
}

const englishCatalogs = new Map();
for (const namespace of expectedNamespaces) {
  const value = JSON.parse(await readFile(path.join(localeRoot, "en", `${namespace}.json`), "utf8"));
  englishCatalogs.set(namespace, flatten(value));
}

for (const locale of expectedLocales) {
  const actualNamespaces = (await readdir(path.join(localeRoot, locale)))
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -5))
    .sort();
  const sortedExpected = [...expectedNamespaces].sort();
  if (JSON.stringify(actualNamespaces) !== JSON.stringify(sortedExpected)) {
    errors.push(`${locale}: namespaces differ`);
    continue;
  }
  for (const namespace of expectedNamespaces) {
    const translated = flatten(JSON.parse(await readFile(path.join(localeRoot, locale, `${namespace}.json`), "utf8")));
    const english = englishCatalogs.get(namespace);
    for (const key of translated.keys()) {
      if (isUnsupportedJestLocaleKey(key)) {
        errors.push(`${locale}/${namespace}.${key}: removed Jest-incompatible feature key must not ship`);
      }
    }
    for (const [key, englishValue] of english) {
      if (!translated.has(key)) {
        errors.push(`${locale}/${namespace}: missing ${key}`);
        continue;
      }
      const expectedPlaceholders = placeholders(englishValue);
      const translatedValue = translated.get(key);
      if (typeof translatedValue !== "string" || translatedValue.trim().length === 0) {
        errors.push(`${locale}/${namespace}.${key}: translation must be a non-empty string`);
        continue;
      }
      if (hasProtectedTranslationToken(translatedValue)) {
        errors.push(`${locale}/${namespace}.${key}: contains an unreplaced protected translation token`);
      }
      if (hasQuestionMarkReplacementText(translatedValue)) {
        errors.push(`${locale}/${namespace}.${key}: contains question-mark replacement text`);
      }
      const translatedPlaceholders = placeholders(translatedValue);
      if (JSON.stringify(expectedPlaceholders) !== JSON.stringify(translatedPlaceholders)) {
        errors.push(`${locale}/${namespace}.${key}: interpolation placeholders differ`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Locale audit passed: ${expectedLocales.length} locales × ${expectedNamespaces.length} namespaces, complete keys/placeholders, no translation-token debris, and no removed Jest-incompatible feature keys`,
  );
}
