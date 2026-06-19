import AsyncStorage from "@react-native-async-storage/async-storage";
import {LOCALE_STORAGE_KEY, isSupportedLanguage, setLocale, type SupportedLanguage} from "../i18n";
import {logger} from "./logger";
import {captureException} from "./sentry";

const normalizeStoredLanguage = (value: string | null): SupportedLanguage | null => {
  if (!value) {
    return null;
  }

  return isSupportedLanguage(value) ? (value as SupportedLanguage) : null;
};

export const readStoredLocale = async (): Promise<SupportedLanguage | null> => {
  try {
    const storedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeStoredLanguage(storedLocale);
  } catch (error) {
    logger.error("Error reading stored locale:", error);
    captureException(error);
    return null;
  }
};

export const persistLocale = async (language: SupportedLanguage): Promise<void> => {
  setLocale(language);

  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, language);
  } catch (error) {
    logger.error("Error persisting locale selection:", error);
    captureException(error);
  }
};
