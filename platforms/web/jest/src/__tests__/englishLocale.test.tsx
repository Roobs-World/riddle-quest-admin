import {afterAll, beforeEach, expect, it, jest} from "@jest/globals";
import {renderToString} from "react-dom/server";

jest.mock("../../platform/webTargetEnvironment", () => ({isJestWebTarget: true}));

import {detectDeviceLanguage, getCurrentLocale, setLocaleAndWait} from "../../../../../src/localization/browser/i18n";
import {applyPlayerPreferences, PLAYER_PREFERENCE_STORAGE_KEYS, setPlayerLocale, subscribeToPlayerPreferenceChanges} from "../../../../../src/settings/browser/playerPreferences";
import {SettingsModalPage} from "../../../../../src/settings/components/SettingsModalPage";

/** Browser storage keeps restoration and later persistence observable. */
class MemoryStorage implements Storage {
  /** Stored preference values for this isolated browser lifetime. */
  private readonly values = new Map<string, string>();
  /** Number of stored preferences. */
  get length() {return this.values.size;}
  /** Removes all preferences. */
  clear() {this.values.clear();}
  /** Reads an existing preference or reports its absence. */
  getItem(key: string) {return this.values.get(key) ?? null;}
  /** Resolves a preference key by its storage position. */
  key(index: number) {return [...this.values.keys()][index] ?? null;}
  /** Removes one preference. */
  removeItem(key: string) {this.values.delete(key);}
  /** Stores one preference. */
  setItem(key: string, value: string) {this.values.set(key, value);}
}

/** Restore the surrounding test process after checking browser preferences. */
const originalGlobals = new Map(["document", "localStorage", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
beforeEach(() => {
  Object.defineProperty(globalThis, "document", {configurable: true, value: {documentElement: {dataset: {}, lang: "en", dir: "ltr"}}});
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: new MemoryStorage()});
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {language: "ar-SA"}});
});
afterAll(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

it("ignores device, browser and platform languages while retaining unrelated restored preferences", async () => {
  localStorage.setItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale, "ar");
  expect(detectDeviceLanguage("ar-SA")).toBe("en");
  expect(applyPlayerPreferences({locale: "fr", muted: true, reducedMotion: true})).toMatchObject({locale: "en", muted: true, reducedMotion: true});
  expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBe("en");
  await setLocaleAndWait("tr");
  expect(getCurrentLocale()).toBe("en");
  expect(document.documentElement).toMatchObject({lang: "en", dir: "ltr"});
});

it("persists English when a later locale request reaches the preference API", () => {
  /** Captures the exact patch delivered to platform persistence. */
  const changes = jest.fn();
  /** Releases the persistence observer after this assertion. */
  const unsubscribe = subscribeToPlayerPreferenceChanges(changes);
  try {
    setPlayerLocale("de");
    expect(changes).toHaveBeenCalledWith({locale: "en"});
    expect(localStorage.getItem(PLAYER_PREFERENCE_STORAGE_KEYS.locale)).toBe("en");
    expect(getCurrentLocale()).toBe("en");
  } finally {
    unsubscribe();
  }
});

it("hides Jest's language selector while keeping accessibility settings available", () => {
  /** Rendered controls expose the target's language policy. */
  const html = renderToString(<SettingsModalPage locale="en" muted={false} onOpenModal={() => undefined} onToggleMute={() => undefined} />);
  expect(html).not.toContain("<select");
  expect(html).not.toContain("Español");
  expect(html).toContain("Reduced motion");
  expect(html).not.toContain("High contrast");
});
