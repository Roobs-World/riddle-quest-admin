import type {SupportedLanguage} from "../i18n";

export const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
export const LEGACY_DAILY_RIDDLE_DOC_ID = "current";

export const getLocalizedRiddleCollection = (locale: SupportedLanguage, category: "classic" | "daily"): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${category}`;
