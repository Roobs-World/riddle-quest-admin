import {LANGUAGE_OPTIONS, detectDeviceLanguage, setLocale, type Locale} from "../../localization/browser/i18n";
import {isJestWebTarget} from "../../platform/browser/webTargetEnvironment";
import {trackEvent} from "../../observability/analytics/events";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
  type BrowserStorageArea,
} from "../../platform/browser/storage/browserStorage";

/** Preferences that are safe for the client to read and update. */
export type PlayerPreferences = {
  /** Preferred supported application locale. */
  locale?: string;
  /** Whether game audio is muted. */
  muted?: boolean;
  /** Whether non-essential motion is reduced. */
  reducedMotion?: boolean;
  /** Master preference for game reminders and challenge notifications. */
  notificationsEnabled?: boolean;
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
  notificationsEnabled: "riddleQuest:notificationsEnabled",
  activeRace: "riddleQuest:activeRaceRun",
  raceRecovery: "riddleQuest:raceRecovery",
  raceDraft: "riddleQuest:raceDraft",
  liveRaceLobby: "riddleQuest:liveRaceLobby",
} as const;

/** Local-storage prefixes containing app-owned tooltip state. */
const GUIDANCE_STORAGE_PREFIXES = [
  "riddleQuest:tooltipSeen:",
  "riddleQuest:tooltipSequenceSeen:",
  "riddleQuest:notificationEnrollment:",
] as const;
/** Session-storage prefixes containing app-owned transient guidance state. */
const SESSION_GUIDANCE_STORAGE_PREFIXES = ["riddleQuest:welcomeSession:"] as const;
/** Supported locale identifiers accepted from low-integrity persisted preferences. */
const supportedLocales = new Set<Locale>(LANGUAGE_OPTIONS.map(({code}) => code));
/** Active platform listeners that persist user-initiated preference changes. */
const preferenceSubscribers = new Set<(change: PlayerPreferenceChange) => void>();
/** Read-only subscribers observe applied motion preferences without creating provider writes. */
const motionSubscribers = new Set<() => void>();
/** All notification paths observe the same applied preference. */
const notificationSubscribers = new Set<() => void>();
/** Retains the preference when embedded browser storage is unavailable. */
let notificationsEnabledOverride: boolean | undefined;
/** Platform onboarding value that takes precedence over browser fallback state. */
let onboardingCompleteOverride: boolean | undefined;
/** Jest installs this dynamically so stale tabs cannot recreate deleted browser state. */
let browserPlayerStateMutationGuard: (() => boolean) | undefined;

/** Browser storage areas used by app-owned player state. */
export type {BrowserStorageArea} from "../../platform/browser/storage/browserStorage";

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
  return readBrowserStorage(area, key);
};

/** Writes browser storage defensively for restrictive embedded environments. */
export const safeBrowserStorageSet = (area: BrowserStorageArea, key: string, value: string): void => {
  if (browserPlayerStateMutationGuard && !browserPlayerStateMutationGuard()) return;
  writeBrowserStorage(area, key, value);
};

/** Removes browser storage defensively for restrictive embedded environments. */
export const safeBrowserStorageRemove = (area: BrowserStorageArea, key: string): void => {
  if (browserPlayerStateMutationGuard && !browserPlayerStateMutationGuard()) return;
  removeBrowserStorage(area, key);
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

/** Applies the motion preference before the game surface mounts. */
const applyReducedMotionPreference = (reducedMotion: boolean): void => {
  /** Provides root behavior. */
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (!root) return;
  root.dataset.riddleQuestReducedMotion = String(reducedMotion);
  motionSubscribers.forEach((subscriber) => subscriber());
};

/** Notifies the active platform integration of a user-initiated preference change. */
const emitPreferenceChange = (change: PlayerPreferenceChange): void => {
  for (const [setting, value] of Object.entries(change)) {
    if (setting !== "onboardingComplete") trackEvent("setting_changed", {setting, value});
  }
  preferenceSubscribers.forEach((subscriber) => subscriber(change));
};

/** Applies persisted platform preferences before hosted play initializes. */
export function applyPlayerPreferences(preferences: PlayerPreferences): Required<PlayerPreferences> {
  /** Stores d locale. */
  const storedLocale = parseLocale(safeBrowserStorageGet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale));
  /** Provides locale behavior. */
  const locale =
    isJestWebTarget ? "en" : parseLocale(preferences.locale) ?? storedLocale ?? detectDeviceLanguage(globalThis.navigator?.language);
  /** Stores d sound enabled. */
  const storedSoundEnabled = readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled);
  /** Provides muted behavior. */
  const muted = preferences.muted ?? (storedSoundEnabled === undefined ? false : !storedSoundEnabled);
  /** Provides reduced motion behavior. */
  const reducedMotion =
    preferences.reducedMotion ??
    readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion) ??
    matchesMedia("(prefers-reduced-motion: reduce)");
  /** Provides onboarding complete behavior. */
  const onboardingComplete = preferences.onboardingComplete ?? false;
  const notificationsEnabled = preferences.notificationsEnabled ?? true;

  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, locale);
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled, String(!muted));
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion, String(reducedMotion));
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.notificationsEnabled, String(notificationsEnabled));
  notificationsEnabledOverride = notificationsEnabled;
  notificationSubscribers.forEach(subscriber => subscriber());
  onboardingCompleteOverride =
    typeof preferences.onboardingComplete === "boolean" ? preferences.onboardingComplete : undefined;
  setLocale(locale);
  applyReducedMotionPreference(reducedMotion);
  return {locale, muted, reducedMotion, notificationsEnabled, onboardingComplete};
}

/** An absent preference keeps game notifications on by default. */
export function isPlayerNotificationsEnabled(): boolean {
  return notificationsEnabledOverride ?? readStoredBoolean(PLAYER_PREFERENCE_STORAGE_KEYS.notificationsEnabled) ?? true;
}

/** Settings updates every notification path before provider cleanup begins. */
export function setPlayerNotificationsEnabled(enabled: boolean): void {
  if (browserPlayerStateMutationGuard && !browserPlayerStateMutationGuard()) return;
  notificationsEnabledOverride = enabled;
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.notificationsEnabled, String(enabled));
  notificationSubscribers.forEach(subscriber => subscriber());
  emitPreferenceChange({notificationsEnabled: enabled});
}

/** Observes local changes and preference changes from another game tab. */
export function subscribeToPlayerNotifications(subscriber: () => void): () => void {
  notificationSubscribers.add(subscriber);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== PLAYER_PREFERENCE_STORAGE_KEYS.notificationsEnabled) return;
    notificationsEnabledOverride = undefined;
    subscriber();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    notificationSubscribers.delete(subscriber);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Persists and applies a locale selected by the player. */
export function setPlayerLocale(locale: Locale): void {
  /** Platform persistence and the rendered locale must use the same target policy. */
  const nextLocale = isJestWebTarget ? "en" : locale;
  safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.locale, nextLocale);
  setLocale(nextLocale);
  emitPreferenceChange({locale: nextLocale});
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
  applyReducedMotionPreference(reducedMotion);
  emitPreferenceChange({reducedMotion});
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

/** Returns onboarding completion from the authoritative platform preference only. */
export function hasCompletedPlayerOnboarding(_storageKey: string): boolean {
  return onboardingCompleteOverride === true;
}

/** Reports completion of the current player's onboarding flow to the platform adapter. */
export function completePlayerOnboarding(_storageKey: string): void {
  /** Provides changed behavior. */
  const changed = onboardingCompleteOverride !== true;
  onboardingCompleteOverride = true;
  if (changed) emitPreferenceChange({onboardingComplete: true});
}

/** Subscribes the active platform adapter to user-initiated preference changes. */
export function subscribeToPlayerPreferenceChanges(subscriber: (change: PlayerPreferenceChange) => void): () => void {
  preferenceSubscribers.add(subscriber);
  return () => preferenceSubscribers.delete(subscriber);
}

/** Observes SDK-applied and player-selected motion changes independently of persistence listeners. */
export function subscribeToPlayerReducedMotion(subscriber: () => void): () => void {
  motionSubscribers.add(subscriber);
  /** OS changes affect the snapshot only when no applied or stored player choice overrides them. */
  const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  if (media?.addEventListener) media.addEventListener("change", subscriber);
  else media?.addListener?.(subscriber);
  return () => {
    motionSubscribers.delete(subscriber);
    if (media?.removeEventListener) media.removeEventListener("change", subscriber);
    else media?.removeListener?.(subscriber);
  };
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
      [...Object.values(PLAYER_PREFERENCE_STORAGE_KEYS), "riddleQuest:highContrast"],
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
    notificationsEnabledOverride = undefined;
    notificationSubscribers.forEach(subscriber => subscriber());
    /** Provides root behavior. */
    const root = typeof document === "undefined" ? undefined : document.documentElement;
    if (root) {
      delete root.dataset.riddleQuestReducedMotion;
    }
    motionSubscribers.forEach((subscriber) => subscriber());
  }
  if (failures.length > 0) throw new AggregateError(failures, "browser-player-state-clear-failed");
}
