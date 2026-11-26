import {
  PLAYER_PREFERENCE_STORAGE_KEYS,
  applyPlayerPreferences,
  clearBrowserPlayerState,
  completePlayerOnboarding,
  hasCompletedPlayerOnboarding,
  installBrowserPlayerStateMutationGuard,
  isPlayerReducedMotionEnabled,
  setPlayerLocale,
  setPlayerMuted,
  setPlayerReducedMotion,
  safeBrowserStorageGet,
  safeBrowserStorageRemove,
  safeBrowserStorageSet,
  subscribeToPlayerPreferenceChanges,
  subscribeToPlayerReducedMotion,
} from "../playerPreferences";

/** Provides memory storage behavior. */
class MemoryStorage implements Storage {
  /** Stores values. */
  private readonly values = new Map<string, string>();
  /** Gets length. */
  get length() {
    return this.values.size;
  }
  /** Provides clear behavior. */
  clear() {
    this.values.clear();
  }
  /** Gets item. */
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  /** Provides key behavior. */
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  /** Removes item. */
  removeItem(key: string) {
    this.values.delete(key);
  }
  /** Sets item. */
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

/** Provides original descriptors behavior. */
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

/** Provides install global behavior. */
const installGlobal = (key: string, value: unknown) => {
  if (!originalDescriptors.has(key)) originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
};

/** Provides install throwing global behavior. */
const installThrowingGlobal = (key: string) => {
  if (!originalDescriptors.has(key)) originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {
    configurable: true,
    get: () => {
      throw new DOMException("Storage access denied", "SecurityError");
    },
  });
};

beforeEach(() => {
  /** Provides local storage behavior. */
  const localStorage = new MemoryStorage();
  /** Provides session storage behavior. */
  const sessionStorage = new MemoryStorage();
  /** Provides document element behavior. */
  const documentElement = {dataset: {} as Record<string, string>, lang: "en", dir: "ltr"};
  installGlobal("localStorage", localStorage);
  installGlobal("sessionStorage", sessionStorage);
  installGlobal("navigator", {language: "en-GB"});
  installGlobal("document", {documentElement});
  installGlobal("window", {
    matchMedia: (query: string) => ({matches: query === "(forced-colors: active)"}),
  });
});

afterEach(() => {
  clearBrowserPlayerState();
  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
  originalDescriptors.clear();
});

it("observes applied motion preferences without echoing SDK reads to platform persistence", () => {
  /** Effective snapshots delivered to the read-only consumer. */
  const snapshots: boolean[] = [];
  /** Platform writes must remain limited to player-initiated changes. */
  const persist = jest.fn();
  /** Releases the test platform adapter. */
  const stopPersisting = subscribeToPlayerPreferenceChanges(persist);
  /** Releases the read-only consumer. */
  const stopObserving = subscribeToPlayerReducedMotion(() => snapshots.push(isPlayerReducedMotionEnabled()));
  try {
    applyPlayerPreferences({reducedMotion: true});
    expect(snapshots).toEqual([true]);
    expect(persist).not.toHaveBeenCalled();
    setPlayerReducedMotion(false);
    expect(snapshots).toEqual([true, false]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({reducedMotion: false});
    clearBrowserPlayerState();
    expect(snapshots).toEqual([true, false, false]);
    expect(persist).toHaveBeenCalledTimes(1);
    stopObserving();
    applyPlayerPreferences({reducedMotion: true});
    expect(snapshots).toEqual([true, false, false]);
  } finally {
    stopObserving();
    stopPersisting();
  }
});

it("defaults reduced motion to off even when the OS requests it and preserves player choices", () => {
  installGlobal("window", {matchMedia: () => ({matches: true})});

  expect(isPlayerReducedMotionEnabled()).toBe(false);
  expect(applyPlayerPreferences({}).reducedMotion).toBe(false);
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion)).toBe("false");

  setPlayerReducedMotion(true);
  expect(isPlayerReducedMotionEnabled()).toBe(true);
  expect(applyPlayerPreferences({}).reducedMotion).toBe(true);

  setPlayerReducedMotion(false);
  expect(isPlayerReducedMotionEnabled()).toBe(false);
  expect(applyPlayerPreferences({}).reducedMotion).toBe(false);
});

it("applies validated platform preferences before play and overrides browser fallback", async () => {
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale, "es");
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled, "true");
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion, "false");

  expect(
    applyPlayerPreferences({
      locale: "fr",
      muted: true,
      reducedMotion: true,
      onboardingComplete: true,
    }),
  ).toEqual({
    locale: "fr",
    muted: true,
    reducedMotion: true,
    notificationsEnabled: true,
    onboardingComplete: true,
  });

  expect(document.documentElement.lang).toBe("en");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(document.documentElement.lang).toBe("fr");
  expect(document.documentElement.dataset).toMatchObject({
    riddleQuestReducedMotion: "true",
  });
  expect(document.documentElement.dataset).not.toHaveProperty("riddleQuestHighContrast");
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled)).toBe("false");
  expect(hasCompletedPlayerOnboarding("riddleQuest:onboarding:user-1")).toBe(true);
});

it("uses existing stored preferences when platform values are absent", () => {
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale, "es");
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.soundEnabled, "false");
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.reducedMotion, "true");
  localStorage.setItem("riddleQuest:onboarding:user-1", "seen");

  expect(applyPlayerPreferences({})).toEqual({
    locale: "es",
    muted: true,
    reducedMotion: true,
    notificationsEnabled: true,
    onboardingComplete: false,
  });
  expect(isPlayerReducedMotionEnabled()).toBe(true);
  expect(hasCompletedPlayerOnboarding("riddleQuest:onboarding:user-1")).toBe(false);
});

it("keeps onboarding completion out of browser storage", () => {
  applyPlayerPreferences({onboardingComplete: false});
  localStorage.setItem("riddleQuest:onboarding:user-1", "seen");

  expect(hasCompletedPlayerOnboarding("riddleQuest:onboarding:user-1")).toBe(false);
  localStorage.removeItem("riddleQuest:onboarding:user-1");
  completePlayerOnboarding("riddleQuest:onboarding:user-1");
  expect(hasCompletedPlayerOnboarding("riddleQuest:onboarding:user-1")).toBe(true);
  expect(localStorage.getItem("riddleQuest:onboarding:user-1")).toBeNull();
});

it("emits only user-initiated changes for the platform persistence adapter", () => {
  applyPlayerPreferences({locale: "en", muted: false, reducedMotion: false});
  /** Provides changes behavior. */
  const changes: unknown[] = [];
  /** Provides unsubscribe behavior. */
  const unsubscribe = subscribeToPlayerPreferenceChanges((change) => changes.push(change));

  setPlayerLocale("de");
  setPlayerMuted(true);
  setPlayerMuted(true);
  setPlayerReducedMotion(true);
  completePlayerOnboarding("riddleQuest:onboarding:user-1");
  completePlayerOnboarding("riddleQuest:onboarding:user-1");
  unsubscribe();

  expect(changes).toEqual([
    {locale: "de"},
    {muted: true},
    {reducedMotion: true},
    {onboardingComplete: true},
  ]);
});

it("clears only app-owned user state after authoritative deletion", () => {
  /** Removes d local keys. */
  const removedLocalKeys = [
    ...Object.values(PLAYER_PREFERENCE_STORAGE_KEYS),
    "riddleQuest:highContrast",
    "riddleQuest:tooltipSeen:gameHint:user-1",
    "riddleQuest:tooltipSequenceSeen:gameTour:1:user-1",
  ];
  removedLocalKeys.forEach((key) => localStorage.setItem(key, "value"));
  sessionStorage.setItem("riddleQuest:welcomeSession:user-1", "seen");
  localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
  localStorage.setItem("unrelated", "keep");
  sessionStorage.setItem("riddleQuest:jestAuthHarness:initFailed", "1");
  applyPlayerPreferences({reducedMotion: true});

  clearBrowserPlayerState();

  removedLocalKeys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
  expect(sessionStorage.getItem("riddleQuest:welcomeSession:user-1")).toBeNull();
  expect(localStorage.getItem("riddleQuest:jestAuthHarness:registered")).toBe("1");
  expect(localStorage.getItem("unrelated")).toBe("keep");
  expect(sessionStorage.getItem("riddleQuest:jestAuthHarness:initFailed")).toBe("1");
  expect(document.documentElement.dataset).toEqual({});
});

it("blocks stale Jest callbacks from recreating browser state after deletion", () => {
  /** Provides mutation allowed behavior. */
  let mutationAllowed = true;
  /** Removes guard. */
  const removeGuard = installBrowserPlayerStateMutationGuard(() => mutationAllowed);
  try {
    safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.activeRace, "race-before");
    safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.raceRecovery, "recovery-before");
    safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.raceDraft, "draft-before");
    clearBrowserPlayerState();
    mutationAllowed = false;

    setPlayerLocale("fr");
    safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.activeRace, "race-after");
    safeBrowserStorageSet("local", PLAYER_PREFERENCE_STORAGE_KEYS.raceDraft, "draft-after");
    safeBrowserStorageSet("local", "riddleQuest:tooltipSeen:hint:user-1", "seen");
    safeBrowserStorageSet("session", "riddleQuest:welcomeSession:user-1", "seen");

    expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBeNull();
    expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.activeRace)).toBeNull();
    expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.raceRecovery)).toBeNull();
    expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.raceDraft)).toBeNull();
    expect(localStorage.getItem("riddleQuest:tooltipSeen:hint:user-1")).toBeNull();
    expect(sessionStorage.getItem("riddleQuest:welcomeSession:user-1")).toBeNull();
  } finally {
    removeGuard();
  }
});

it("fails closed while still attempting session cleanup when browser persistence cannot be removed", () => {
  /** Provides failing local storage behavior. */
  const failingLocalStorage = new MemoryStorage();
  failingLocalStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale, "fr");
  jest.spyOn(failingLocalStorage, "removeItem").mockImplementation(() => undefined);
  installGlobal("localStorage", failingLocalStorage);
  sessionStorage.setItem("riddleQuest:welcomeSession:user-1", "seen");

  expect(() => clearBrowserPlayerState()).toThrow("browser-player-state-clear-failed");
  expect(failingLocalStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBe("fr");
  expect(sessionStorage.getItem("riddleQuest:welcomeSession:user-1")).toBeNull();

  installGlobal("localStorage", new MemoryStorage());
});

it("survives throwing storage getters but reports deletion cleanup as incomplete", () => {
  installThrowingGlobal("localStorage");
  installThrowingGlobal("sessionStorage");

  expect(safeBrowserStorageGet("local", "key")).toBeNull();
  expect(() => safeBrowserStorageSet("local", "key", "value")).not.toThrow();
  expect(() => safeBrowserStorageRemove("session", "key")).not.toThrow();
  expect(() => applyPlayerPreferences({locale: "en", muted: true})).not.toThrow();
  expect(() => setPlayerLocale("fr")).not.toThrow();
  expect(() => setPlayerMuted(false)).not.toThrow();
  expect(() => completePlayerOnboarding("riddleQuest:onboarding:user-1")).not.toThrow();
  expect(() => clearBrowserPlayerState()).toThrow("browser-player-state-clear-failed");

  installGlobal("localStorage", new MemoryStorage());
  installGlobal("sessionStorage", new MemoryStorage());
});
