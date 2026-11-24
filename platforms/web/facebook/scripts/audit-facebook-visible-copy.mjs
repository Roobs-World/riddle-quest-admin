import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const localeRoot = path.resolve("src/locales");
const expectedLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja",
  "ko", "nl", "pl", "pt", "ru", "tr", "vi",
];

// This is the release contract for app-rendered Facebook copy. Meta-owned dialogs
// (ads, purchases, notification permission) deliberately remain platform-owned.
const requiredKeys = {
  loss: ["LossModal.VIDEO_EXTRA_GO_BUTTON"],
  race: [
    "RaceTo10.HUB_PLAY",
    "RaceTo10.HUB_ACTIVITY",
    "RaceTo10.HUB_TOURNAMENTS",
    "RaceTo10.SHARE_TOURNAMENT",
    "RaceTo10.MATCH_PLAYER",
    "RaceTo10.CHOOSE_CONTEXT",
    "RaceTo10.SAFETY_ACTIONS",
    "RaceTo10.BLOCK_RIVAL",
    "RaceTo10.REPORT_REASON",
    "RaceTo10.REPORT_HARASSMENT",
    "RaceTo10.REPORT_CHEATING",
    "RaceTo10.REPORT_IDENTITY",
    "RaceTo10.REPORT_SPAM",
    "RaceTo10.REPORT_OTHER",
    "RaceTo10.REPORT_RIVAL",
    "RaceTo10.BLOCK_SUCCESS",
    "RaceTo10.REPORT_SUCCESS",
    "RaceTo10.ERROR_LOCALE_MISMATCH",
  ],
  settings: [
    "Settings.ACCOUNT_DELETION_BUTTON",
    "Settings.TOGGLE_OFF",
    "Settings.TOGGLE_ON",
  ],
  profile: [
    "Profile.DELETE_ACCOUNT_BUTTON",
    "Profile.DELETE_ACCOUNT_CANCEL_BUTTON",
    "Profile.DELETE_ACCOUNT_CONFIRM_BUTTON",
    "Profile.DELETE_ACCOUNT_CONFIRM_MESSAGE",
    "Profile.DELETE_ACCOUNT_CONFIRM_TITLE",
    "Profile.DELETE_ACCOUNT_ERROR_MESSAGE",
    "Profile.DELETE_ACCOUNT_ERROR_TITLE",
    "Profile.DELETE_ACCOUNT_LOADING",
    "Profile.DELETE_ACCOUNT_SUCCESS_MESSAGE",
    "Profile.DELETE_ACCOUNT_SUCCESS_TITLE",
  ],
  shop: [
    "CoinShop.COINS_SUFFIX",
    "CoinShop.LOADING_TEXT",
    "CoinShop.NO_PACKS_AVAILABLE",
    "CoinShop.PURCHASE_BUTTON",
    "CoinShop.TITLE",
    "CoinShop.YOUR_BALANCE",
  ],
  alerts: [
    "GameScreenAlerts.NO_PRODUCTS_AVAILABLE_TITLE",
    "GameScreenAlerts.PURCHASE_FAILED_MESSAGE",
    "GameScreenAlerts.PURCHASE_FAILED_TITLE",
  ],
  errors: [
    "ErrorMessages.FAILED_TO_LOAD_PRODUCTS",
    "ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS",
    "ErrorMessages.GENERIC_UNEXPECTED_ERROR",
    "ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION",
  ],
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const getPath = (value, dottedPath) => dottedPath.split(".").reduce(
  (current, segment) => current?.[segment],
  value,
);

const actualLocales = fs.readdirSync(localeRoot, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(actualLocales) !== JSON.stringify(expectedLocales)) {
  throw new Error(`Facebook copy locale set mismatch: ${actualLocales.join(",")}`);
}

let checked = 0;
for (const locale of expectedLocales) {
  for (const [namespace, keys] of Object.entries(requiredKeys)) {
    const catalog = readJson(path.join(localeRoot, locale, `${namespace}.json`));
    for (const key of keys) {
      const translated = getPath(catalog, key);
      if (typeof translated !== "string" || translated.trim() === "") {
        throw new Error(`Missing Facebook-visible copy: ${locale}/${namespace}.json#${key}`);
      }
      if (/\b(?:TODO|TBD)\b/i.test(translated)) {
        throw new Error(`Placeholder Facebook-visible copy: ${locale}/${namespace}.json#${key}`);
      }
      checked += 1;
    }
  }
}

console.log(
  `Facebook visible-copy audit passed: ${expectedLocales.length} locales, ${checked} required translations`,
);
