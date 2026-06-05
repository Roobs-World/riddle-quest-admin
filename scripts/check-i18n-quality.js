"use strict";

const fs = require("fs");
const path = require("path");

const {LOCALES, NON_TRANSLATABLE_KEY_ALLOWLIST, isPlainObject} = require("./i18n-shared");

const rootDir = path.resolve(__dirname, "..");
const localesDir = path.join(rootDir, "src", "locales");
const strictMode = process.argv.includes("--strict");
const jsonMode = process.argv.includes("--json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenLeafEntries(value, prefix = "") {
  if (!isPlainObject(value)) {
    return [[prefix, value]];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLeafEntries(child, nextPrefix);
  });
}

function getNamespaceFiles(locale) {
  return fs
    .readdirSync(path.join(localesDir, locale))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
}

function buildEnglishValueMap() {
  const englishValues = new Map();

  for (const fileName of getNamespaceFiles("en")) {
    const namespace = path.basename(fileName, ".json");
    const namespaceData = readJson(path.join(localesDir, "en", fileName));

    for (const [leafPath, value] of flattenLeafEntries(namespaceData)) {
      englishValues.set(`${namespace}.${leafPath}`, value);
    }
  }

  return englishValues;
}

function collectLocaleQualityIssues() {
  const englishValues = buildEnglishValueMap();
  const issues = {};

  for (const locale of LOCALES) {
    if (locale === "en") {
      continue;
    }

    const localeIssues = [];

    for (const fileName of getNamespaceFiles(locale)) {
      const namespace = path.basename(fileName, ".json");
      const namespaceData = readJson(path.join(localesDir, locale, fileName));

      for (const [leafPath, localeValue] of flattenLeafEntries(namespaceData)) {
        const fullKey = `${namespace}.${leafPath}`;
        const englishValue = englishValues.get(fullKey);

        if (
          typeof localeValue === "string" &&
          localeValue === englishValue &&
          !NON_TRANSLATABLE_KEY_ALLOWLIST.has(fullKey)
        ) {
          localeIssues.push(fullKey);
        }
      }
    }

    if (localeIssues.length > 0) {
      issues[locale] = localeIssues.sort();
    }
  }

  return issues;
}

function main() {
  const issues = collectLocaleQualityIssues();
  const totalIssues = Object.values(issues).reduce((count, localeIssues) => count + localeIssues.length, 0);

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          totalIssues,
          issues,
          allowlist: Array.from(NON_TRANSLATABLE_KEY_ALLOWLIST).sort(),
        },
        null,
        2,
      ),
    );
    if (strictMode && totalIssues > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (totalIssues === 0) {
    console.log("i18n quality check passed: no untranslated English-identical values found.");
    return;
  }

  const summary = Object.entries(issues)
    .map(([locale, localeIssues]) => `${locale}: ${localeIssues.length}`)
    .join(", ");

  const message = `i18n quality audit found ${totalIssues} English-identical leaf values outside the allowlist. ${summary}`;

  if (strictMode) {
    throw new Error(message);
  }

  console.warn(message);
}

if (require.main === module) {
  main();
}
