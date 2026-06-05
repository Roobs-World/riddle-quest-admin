"use strict";

const fs = require("fs");
const path = require("path");

const {LOCALES, NON_TRANSLATABLE_KEY_ALLOWLIST, isPlainObject} = require("./i18n-shared");

const rootDir = path.resolve(__dirname, "..");
const localesDir = path.join(rootDir, "src", "locales");

const EXACT_REPAIRS = {
  es: {
    Error: "¡Error!",
    POPULAR: "MÁS POPULAR",
  },
  pt: {
    OK: "Certo",
    POPULAR: "MAIS POPULAR",
  },
  fr: {
    Logo: "Logo de l'application",
    Instructions: "Consignes",
    Gameplay: "Jouabilité",
    Performance: "Performances",
    "qa-surface": "surface-qa",
  },
  de: {
    "Riddle Quest Website": "Riddle-Quest-Webseite",
    Logo: "Logo-Schaltfläche",
    OK: "Bestätigen",
    Credits: "Mitwirkende",
    Info: "Informationen",
    Login: "Anmelden",
    Gameplay: "Spielverlauf",
  },
  ru: {
    Backspace: "Удалить",
    "isLoading:": "Загрузка:",
  },
  tr: {
    Logo: "Logo düğmesi",
  },
  id: {
    STARTER: "PEMULA",
    Login: "Masuk",
    "Lv.": "Tingkat",
  },
  it: {
    Logo: "Logo dell'app",
    OK: "Va bene",
    Password: "Parola d'accesso",
    Login: "Accedi",
  },
  nl: {
    Backspace: "Backspatie",
    Logo: "Logo van de app",
    OK: "Bevestigen",
    Info: "Informatie",
    STARTER: "STARTERPAKKET",
    Crash: "Crashtest",
    Gameplay: "Spelverloop",
  },
  pl: {
    Backspace: "Kasuj",
    Logo: "Logo aplikacji",
    OK: "Potwierdź",
    Login: "Zaloguj się",
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function flattenLeaves(value, prefix = "") {
  if (!isPlainObject(value)) {
    return [[prefix, value]];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLeaves(child, nextPrefix);
  });
}

function setValueAtPath(target, pathExpression, nextValue) {
  const segments = pathExpression.split(".");
  let current = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    current = current[segments[index]];
  }

  current[segments.at(-1)] = nextValue;
}

function stripWhitespace(text) {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/u);
  return {
    leading: match?.[1] ?? "",
    core: match?.[2] ?? text,
    trailing: match?.[3] ?? "",
  };
}

function shouldUppercaseSource(text) {
  const core = text.trim();
  return core.length > 0 && core === core.toUpperCase() && /[A-Z]/u.test(core);
}

function protectSource(text) {
  const protectedValues = [];
  let working = text;

  const patterns = [
    /#Riddle Quest #WordPuzzle #BrainGame/g,
    /dailyRiddles\/current/g,
    /Roobs World/g,
    /Riddle Quest/g,
    /\bX\b/g,
  ];

  for (const pattern of patterns) {
    working = working.replace(pattern, (match) => {
      const token = `__PROTECTED_${protectedValues.length}__`;
      protectedValues.push([token, match]);
      return token;
    });
  }

  return {
    text: working,
    restore(value) {
      return protectedValues.reduce((acc, [token, original]) => acc.replaceAll(token, original), value);
    },
  };
}

async function translateSingle(text, locale) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", locale);
  url.searchParams.set("dt", "t");
  url.searchParams.append("q", text);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation request failed for ${locale}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.[0]) ? payload[0].map((chunk) => chunk[0]).join("") : text;
}

async function translateValue(value, locale) {
  const localeRepairs = EXACT_REPAIRS[locale] ?? {};
  if (Object.prototype.hasOwnProperty.call(localeRepairs, value)) {
    return localeRepairs[value];
  }

  const {leading, core, trailing} = stripWhitespace(value);
  if (!core) {
    return value;
  }

  const protectedSource = protectSource(core);
  const translated = await translateSingle(protectedSource.text, locale);
  const restored = protectedSource.restore(translated || core);
  const maybeUppercased = shouldUppercaseSource(core) ? restored.toLocaleUpperCase(locale) : restored;
  return `${leading}${maybeUppercased}${trailing}`;
}

async function main() {
  const englishFiles = fs.readdirSync(path.join(localesDir, "en")).filter((file) => file.endsWith(".json"));
  const englishValues = new Map();

  for (const fileName of englishFiles) {
    const namespace = path.basename(fileName, ".json");
    const namespaceData = readJson(path.join(localesDir, "en", fileName));
    for (const [leafPath, value] of flattenLeaves(namespaceData)) {
      englishValues.set(`${namespace}.${leafPath}`, value);
    }
  }

  for (const locale of LOCALES) {
    if (locale === "en") {
      continue;
    }

    const localeDir = path.join(localesDir, locale);
    const fileNames = fs.readdirSync(localeDir).filter((file) => file.endsWith(".json"));

    for (const fileName of fileNames) {
      const namespace = path.basename(fileName, ".json");
      const filePath = path.join(localeDir, fileName);
      const localeData = readJson(filePath);
      let changed = false;

      for (const [leafPath, localeValue] of flattenLeaves(localeData)) {
        if (typeof localeValue !== "string") {
          continue;
        }

        const fullKey = `${namespace}.${leafPath}`;
        const englishValue = englishValues.get(fullKey);
        if (localeValue !== englishValue || NON_TRANSLATABLE_KEY_ALLOWLIST.has(fullKey)) {
          continue;
        }

        const translated = await translateValue(localeValue, locale);
        if (translated !== localeValue) {
          setValueAtPath(localeData, leafPath, translated);
          changed = true;
        }
      }

      if (changed) {
        writeJson(filePath, localeData);
      }
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
