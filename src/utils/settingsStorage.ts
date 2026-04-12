import AsyncStorage from "@react-native-async-storage/async-storage";

type LocalStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
export const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";

const getLocalStorage = (): LocalStorageLike | null => {
  const candidate = (globalThis as { localStorage?: LocalStorageLike })
    .localStorage;
  if (!candidate) {
    return null;
  }
  return candidate;
};

const parseBooleanSetting = (
  rawValue: string | null,
  defaultValue: boolean
): boolean => {
  if (rawValue === null) return defaultValue;
  try {
    const parsed = JSON.parse(rawValue);
    return typeof parsed === "boolean" ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const readBooleanSetting = async (
  key: string,
  defaultValue: boolean
): Promise<boolean> => {
  const localStorageApi = getLocalStorage();

  if (localStorageApi) {
    const localValue = localStorageApi.getItem(key);
    if (localValue !== null) {
      return parseBooleanSetting(localValue, defaultValue);
    }
  }

  const asyncValue = await AsyncStorage.getItem(key);
  if (asyncValue !== null && localStorageApi) {
    localStorageApi.setItem(key, asyncValue);
  }

  return parseBooleanSetting(asyncValue, defaultValue);
};

export const writeBooleanSetting = async (
  key: string,
  value: boolean
): Promise<void> => {
  const serialized = JSON.stringify(value);
  const localStorageApi = getLocalStorage();

  if (localStorageApi) {
    localStorageApi.setItem(key, serialized);
  }

  await AsyncStorage.setItem(key, serialized);
};
