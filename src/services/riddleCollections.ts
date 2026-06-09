import type {SupportedLanguage} from "../i18n";

export const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
export const CURRENT_DAILY_RIDDLE_DOC_ID = "current";

export const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";

export const getLocalizedRiddleCollection = (locale: SupportedLanguage): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;
