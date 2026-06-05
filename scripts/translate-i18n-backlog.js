"use strict";

const fs = require("fs");
const path = require("path");

const {LOCALES, isPlainObject} = require("./i18n-shared");

const rootDir = path.resolve(__dirname, "..");
const localesDir = path.join(rootDir, "src", "locales");

const TARGET_NAMESPACES = [
  "devtools",
  "errors",
  "alerts",
  "victory",
  "auth",
  "accessibility",
  "profile",
  "aboutLegal",
  "common",
  "leaderboard",
  "test",
  "settings",
  "achievements",
  "navigation",
  "stats",
  "credits",
  "logs",
  "levelUpFanfare",
];

const LOCALE_CODES = LOCALES.filter((locale) => locale !== "en");
const GOOGLE_TL = {
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  ja: "ja",
  ko: "ko",
  zh: "zh-CN",
  hi: "hi",
  ru: "ru",
  tr: "tr",
  ar: "ar",
  id: "id",
  it: "it",
  nl: "nl",
  pl: "pl",
  vi: "vi",
};

const EXACT_OVERRIDES = {
  es: {
    XP: "experiencia",
    "Lv.": "Niv.",
  },
  pt: {
    XP: "experiência",
    "Lv.": "Nív.",
  },
  fr: {
    XP: "expérience",
    "Lv.": "Niv.",
  },
  de: {
    XP: "Erfahrung",
    "Lv.": "Lvl.",
  },
  ja: {
    XP: "経験値",
    "Lv.": "レベル",
  },
  ko: {
    XP: "경험치",
    "Lv.": "레벨",
  },
  zh: {
    XP: "经验",
    "Lv.": "等级",
  },
  hi: {
    XP: "अनुभव",
    "Lv.": "स्तर",
  },
  ru: {
    XP: "опыт",
    "Lv.": "ур.",
  },
  tr: {
    XP: "deneyim",
    "Lv.": "Sev.",
  },
  ar: {
    XP: "خبرة",
    "Lv.": "المستوى",
  },
  id: {
    XP: "pengalaman",
    "Lv.": "Lv.",
  },
  it: {
    XP: "esperienza",
    "Lv.": "Liv.",
  },
  nl: {
    XP: "ervaring",
    "Lv.": "Niv.",
  },
  pl: {
    XP: "doświadczenie",
    "Lv.": "Poziom",
  },
  vi: {
    XP: "kinh nghiệm",
    "Lv.": "Cấp",
  },
};

const PROTECTED_PATTERNS = [
  /#Riddle Quest #WordPuzzle #BrainGame/g,
  /dailyRiddles\/current/g,
  /Roobs World/g,
  /Riddle Quest/g,
  /\bX\b/g,
];

const BATCH_SIZE = 20;
const translationCache = new Map();

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

function protectSource(text) {
  const protectedValues = [];
  let working = text;

  for (const pattern of PROTECTED_PATTERNS) {
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

async function translateBatch(texts, locale) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", GOOGLE_TL[locale] ?? locale);
  url.searchParams.set("dt", "t");

  const separatorPattern = /__QW\d+__/gu;
  const combined = texts.reduce((acc, text, index) => {
    if (index === 0) {
      return text;
    }

    return `${acc}__QW${index}__${text}`;
  }, "");

  url.searchParams.append("q", combined);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation request failed for ${locale}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const translated = Array.isArray(payload?.[0]) ? payload[0].map((chunk) => chunk[0]).join("") : "";
  const parts = translated.split(separatorPattern);
  return parts;
}

async function translateInputs(texts, locale) {
  if (texts.length === 0) {
    return [];
  }

  const parts = await translateBatch(texts, locale);
  if (parts.length === texts.length) {
    return parts;
  }

  if (texts.length === 1) {
    return [parts.join("")];
  }

  const midpoint = Math.ceil(texts.length / 2);
  const left = await translateInputs(texts.slice(0, midpoint), locale);
  const right = await translateInputs(texts.slice(midpoint), locale);
  return [...left, ...right];
}

async function translateFile(locale, namespace, sourceData) {
  const translated = JSON.parse(JSON.stringify(sourceData));
  const leaves = flattenLeaves(sourceData).filter(([, value]) => typeof value === "string");

  for (let index = 0; index < leaves.length; index += BATCH_SIZE) {
    const batch = leaves.slice(index, index + BATCH_SIZE);
    const localeOverrides = EXACT_OVERRIDES[locale] ?? {};
    const batchInputs = [];
    const batchMeta = [];

    for (const [leafPath, sourceText] of batch) {
      const cacheKey = `${locale}\u0000${sourceText}`;
      if (translationCache.has(cacheKey)) {
        setValueAtPath(translated, leafPath, translationCache.get(cacheKey));
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(localeOverrides, sourceText)) {
        translationCache.set(cacheKey, localeOverrides[sourceText]);
        setValueAtPath(translated, leafPath, localeOverrides[sourceText]);
        continue;
      }

      const {leading, core, trailing} = stripWhitespace(sourceText);
      if (!core) {
        translationCache.set(cacheKey, sourceText);
        setValueAtPath(translated, leafPath, sourceText);
        continue;
      }

      const protectedSource = protectSource(core);
      batchInputs.push(protectedSource.text);
      batchMeta.push({cacheKey, leafPath, core, leading, trailing, protectedSource});
    }

    if (batchInputs.length === 0) {
      continue;
    }

    const translatedValues = await translateInputs(batchInputs, locale);

    batchMeta.forEach(({cacheKey, leafPath, core, leading, trailing, protectedSource}, batchIndex) => {
      const restored = protectedSource.restore(translatedValues[batchIndex] || core);
      const maybeUppercased = shouldUppercaseSource(core) ? restored.toLocaleUpperCase(locale) : restored;
      const finalValue = `${leading}${maybeUppercased}${trailing}`;
      translationCache.set(cacheKey, finalValue);
      setValueAtPath(translated, leafPath, finalValue);
    });
  }

  const filePath = path.join(localesDir, locale, `${namespace}.json`);
  writeJson(filePath, translated);
}

async function main() {
  for (const locale of LOCALE_CODES) {
    for (const namespace of TARGET_NAMESPACES) {
      const filePath = path.join(localesDir, "en", `${namespace}.json`);
      const sourceData = readJson(filePath);
      await translateFile(locale, namespace, sourceData);
      console.log(`Translated ${locale}/${namespace}`);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
