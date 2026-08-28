import {LANGUAGE_OPTIONS, detectDeviceLanguage, setLocale, type Locale} from "./i18n";

/** Preferences that are safe for the client to read and update. */
export type PlayerPreferences = {
  /** Preferred supported application locale. */
  locale?: string;
  /** Whether game audio is muted. */
  muted?: boolean;
  /** Whether non-essential motion is reduced. */
  reducedMotion?: boolean;
  /** Whether the high-contrast theme override is enabled. */
  highContrast?: boolean;
  /** Whether the player has completed onboarding. */
  onboardingComplete?: boolean;
};

/** A user-initiated preference change that should be persisted by the active platform adapter. */
export type PlayerPreferenceChange = Partial<Required<PlayerPreferences>>;

/** App-owned browser keys for preferences shared by hosted and Jest play. */
export const PLAYER_PREFERENCE_STORAGE_KEYS = {
  locale: "appLanguage",
  soundEnabled: "riddleQuest:soundEnabled",
  reducedMotion: "riddleQuest:reducedMotion",
  highContrast: "riddleQuest:highContrast",
  activeRace: "riddleQuest:activeRaceRun",
} as const;

/** Local-storage prefixes containing app-owned onboarding and tooltip state. */
const GUIDANCE_STORAGE_PREFIXES = [
  "riddleQuest:onboarding:",
  "riddleQuest:tooltipSeen:",
  "riddleQuest:tooltipSequenceSeen:",
] as const;
/** Session-storage prefixes containing app-owned transient guidance state. */
const SESSION_GUIDANCE_STORAGE_PREFIXES = ["riddleQuest:welcomeSession:"] as const;
/** Supported locale identifiers accepted from low-integrity persisted preferences. */
const supportedLocales = new Set<Locale>(LANGUAGE_OPTIONS.map(({code}) => code));
/** Active platform listeners that persist user-initiated preference changes. */
const preferenceSubscribers = new Set<(change: PlayerPreferenceChange) => void>();
/** Platform onboarding value that takes precedence over browser fallback state. */
let onboardingCompleteOverride: boolean | undefined;
/** Jest installs this dynamically so stale tabs cannot recreate deleted browser state. */
let browserPlayerStateMutationGuard: (() => boolean) | undefined;

/** Browser storage areas used by app-owned player state. */
export type BrowserStorageArea = "local" | "session";

/** Obtains browser storage without allowing a restrictive iframe getter to crash the app. */
const getBrowserStorage = (area: BrowserStorageArea, rethrow = false): Storage | undefined => {
  try {
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch (error) {
    if (rethrow) throw error;
    return undefined;
  }
};

/** Reads browser storage defensively for restrictive embedded environments. */
export const safeBrowserStorageGet = (area: BrowserStorageArea, key: string): string | null => {
  try {
    return getBrowserStorage(area)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

/** Writes browser storage defensively for restrictive embedded environments. */
export const safeBrowserStorageSet = (area: BrowserStorageArea, key: string, value: string): void => {
  try {
    if (browserPlayerStateMutationGuard && !browserPlayerStateMutationGuard()) return;
    getBrowserStorage(area)?.setItem(key, value);
  } catch {
    // The applied in-memory/document state still works for this session.
  }
};

/** Removes browser storage defensively for restrictive embedded environments. */
export const safeBrowserStorageRemove = (area: BrowserStorageArea, key: string): void => {
  try {
    if (browserPlayerStateMutationGuard && !browserPlayerStateMutationGuard()) return;
    getBrowserStorage(area)?.removeItem(key);
  } catch {
    // Cleanup that is not part of account deletion remains best effort.
  }
};

/** Installs a Jest-runtime-only guard around app-owned browser-state mutations. */
export function installBrowserPlayerStateMutationGuard(guard: () => boolean): () => void {
  /** Provides previous guard behavior. */
  const previousGuard = browserPlayerStateMutationGuard;
  browserPlayerStateMutationGuard = guard;
  return () => {
    if (browserPlayerStateMutationGuard === guard) browserPlayerStateMutationGuard = previousGuard;
  };
}

/** Resolves a supported locale without accepting arbitrary SDK data. */
const parseLocale = (value: unknown): Locale | undefined => {
  return typeof value === "string" && supportedLocales.has(value as Locale) ? (value as Locale) : undefined;
};

/** Reads a boolean serialized by this module. */
const readStoredBoolean = (key: string): boolean | undefined => {
  /** Provides value behavior. */
  const value = safeBrowserStorageGet("local", key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

/** Returns whether the browser or OS asks for the given accessibility media feature. */
const matchesMedia = (query: string): boolean => {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
};

/** Applies accessibility flags to the document before the game surface mounts. */
const applyAccessibilityPreferences = (reducedMotion: boolean, highContrast: boolean): void => {
  /** Provides root behavior. */
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (!root) return;
  root.dataset.riddleQuestReducedMotion = String(reducedMotion);
  root.dataset.riddleQuestHighContrast = String(highContrast);
};

/** Notifies the active platform integration of a user-initiated preference change. */
const emitPreferenceChange = (change: PlayerPreferenceChange): void => {
  preferenceSubscribers.forEach((subscriber) => subscriber(change));
};

/** Applies persisted platform preferences before hosted play initializes. */
export function applyPlayerPreferences(preferences: PlayerPreferences): Required<PlayerPreferences> {
  /** Stores d locale. */
  const storedLocale = parseLocale(safeBrowserStorageGet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale));
  /** Provides locale behavior. */
  const locale =
    parseLocale(preferences.locale) ?? storedLocale ?? detectDeviceLanguage(globalThis.navigator?.language);
  /** Stores d sound enabled. */
  const storedSoundEnabled = readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled);
  /** Provides muted behavior. */
  const muted = preferences.muted ?? (storedSoundEnabled === undefined ? false : !storedSoundEnabled);
  /** Provides reduced motion behavior. */
  const reducedMotion =
    preferences.reducedMotion ??
    readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion) ??
    matchesMedia("(prefers-reduced-motion: reduce)");
  /** Provides high contrast behavior. */
  const highContrast =
    preferences.highContrast ??
    readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.highContrast) ??
    (matchesMedia("(prefers-contrast: more)") || matchesMedia("(forced-colors: active)"));
  /** Provides onboarding complete behavior. */
  const onboardingComplete = preferences.onboardingComplete ?? false;

  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, locale);
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled, String(!muted));
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion, String(reducedMotion));
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.highContrast, String(highContrast));
  onboardingCompleteOverride =
    typeof preferences.onboardingComplete === "boolean" ? preferences.onboardingComplete : undefined;
  setLocale(locale);
  applyAccessibilityPreferences(reducedMotion, highContrast);
  return {locale, muted, reducedMotion, highContrast, onboardingComplete};
}

/** Persists and applies a locale selected by the player. */
export function setPlayerLocale(locale: Locale): void {
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, locale);
  setLocale(locale);
  emitPreferenceChange({locale});
}

/** Persists a sound preference when game state changes it. */
export function setPlayerMuted(muted: boolean): void {
  /** Provides next sound enabled behavior. */
  const nextSoundEnabled = String(!muted);
  if (safeBrowserStorageGet("local", PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled) === nextSoundEnabled) return;
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled, nextSoundEnabled);
  emitPreferenceChange({muted});
}

/** Persists and applies a reduced-motion preference for existing or future controls. */
export function setPlayerReducedMotion(reducedMotion: boolean): void {
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion, String(reducedMotion));
  applyAccessibilityPreferences(reducedMotion, isPlayerHighContrastEnabled());
  emitPreferenceChange({reducedMotion});
}

/** Persists and applies a high-contrast preference for existing or future controls. */
export function setPlayerHighContrast(highContrast: boolean): void {
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.highContrast, String(highContrast));
  applyAccessibilityPreferences(isPlayerReducedMotionEnabled(), highContrast);
  emitPreferenceChange({highContrast});
}

/** Returns the effective reduced-motion choice currently applied to play. */
export function isPlayerReducedMotionEnabled(): boolean {
  /** Provides root behavior. */
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (root) {
    /** Provides applied behavior. */
    const applied = root.dataset.riddleQuestReducedMotion;
    if (applied === "true" || applied === "false") return applied === "true";
  }
  return (
    readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion) ?? matchesMedia("(prefers-reduced-motion: reduce)")
  );
}

/** Returns the effective high-contrast choice currently applied to play. */
export function isPlayerHighContrastEnabled(): boolean {
  /** Provides root behavior. */
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (root) {
    /** Provides applied behavior. */
    const applied = root.dataset.riddleQuestHighContrast;
    if (applied === "true" || applied === "false") return applied === "true";
  }
  return (
    readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.highContrast) ??
    (matchesMedia("(prefers-contrast: more)") || matchesMedia("(forced-colors: active)"))
  );
}

/** Returns onboarding completion with the platform value taking precedence over browser fallback. */
export function hasCompletedPlayerOnboarding(storageKey: string): boolean {
  return onboardingCompleteOverride ?? safeBrowserStorageGet("local", storageKey) === "seen";
}

/** Persists completion of the current player's onboarding flow. */
export function completePlayerOnboarding(storageKey: string): void {
  /** Provides changed behavior. */
  const changed = onboardingCompleteOverride !== true || safeBrowserStorageGet("local", storageKey) !== "seen";
  onboardingCompleteOverride = true;
  safeBrowserStorageSet("local", storageKey, "seen");
  if (changed) emitPreferenceChange({onboardingComplete: true});
}

/** Subscribes the active platform adapter to user-initiated preference changes. */
export function subscribeToPlayerPreferenceChanges(subscriber: (change: PlayerPreferenceChange) => void): () => void {
  preferenceSubscribers.add(subscriber);
  return () => preferenceSubscribers.delete(subscriber);
}

/** Removes exact app-owned browser state after authoritative account deletion. */
export function clearBrowserPlayerState(): void {
  /** Removes keys. */
  const removeKeys = (storage: Storage | undefined, exactKeys: readonly string[], prefixes: readonly string[]) => {
    if (!storage) return;
    /** Provides keys behavior. */
    const keys = Array.from({length: storage.length}, (_, index) => storage.key(index)).filter(
      (key): key is string => key !== null,
    );
    /** Provides player keys behavior. */
    const playerKeys = keys.filter(
      (key) => exactKeys.includes(key) || prefixes.some((prefix) => key.startsWith(prefix)),
    );
    playerKeys.forEach((key) => storage.removeItem(key));
    /** Provides remaining keys behavior. */
    const remainingKeys = Array.from({length: storage.length}, (_, index) => storage.key(index)).filter(
      (key): key is string => key !== null,
    );
    if (remainingKeys.some((key) => exactKeys.includes(key) || prefixes.some((prefix) => key.startsWith(prefix)))) {
      throw new Error("browser-player-state-clear-incomplete");
    }
  };

  /** Provides failures behavior. */
  const failures: unknown[] = [];
  try {
    removeKeys(
      getBrowserStorage("local", true),
      Object.values(PLAYER_PREFERENCE_STORAGE_KEYS),
      GUIDANCE_STORAGE_PREFIXES,
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    removeKeys(getBrowserStorage("session", true), [], SESSION_GUIDANCE_STORAGE_PREFIXES);
  } catch (error) {
    failures.push(error);
  } finally {
    onboardingCompleteOverride = undefined;
    /** Provides root behavior. */
    const root = typeof document === "undefined" ? undefined : document.documentElement;
    if (root) {
      delete root.dataset.riddleQuestReducedMotion;
      delete root.dataset.riddleQuestHighContrast;
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "browser-player-state-clear-failed");
}
