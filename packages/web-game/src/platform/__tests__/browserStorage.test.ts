import {afterEach, describe, expect, it} from "@jest/globals";
import {observeBrowserStorage, readBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../browserStorage";

/** Stores the environment descriptor restored after each storage scenario. */
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
/** Stores the session descriptor restored after each storage scenario. */
const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  if (originalSessionStorage) Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  else Reflect.deleteProperty(globalThis, "sessionStorage");
});

describe("browser storage", () => {
  it("keeps callers operational when local storage access is blocked", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    });

    expect(readBrowserStorage("local", "player-state")).toBeNull();
    expect(observeBrowserStorage("local", "player-state")).toBeUndefined();
    expect(writeBrowserStorage("local", "player-state", "saved")).toBe(false);
    expect(removeBrowserStorage("local", "player-state")).toBe(false);
  });

  it("reads, writes, and removes values through the selected storage area", () => {
    /** Provides values behavior. */
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    expect(observeBrowserStorage("local", "player-state")).toBeNull();
    expect(writeBrowserStorage("local", "player-state", "saved")).toBe(true);
    expect(readBrowserStorage("local", "player-state")).toBe("saved");
    expect(observeBrowserStorage("local", "player-state")).toBe("saved");
    expect(removeBrowserStorage("local", "player-state")).toBe(true);
    expect(readBrowserStorage("local", "player-state")).toBeNull();
  });

  it("reports rejected storage mutations without throwing", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new DOMException("Read rejected", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
        removeItem: () => {
          throw new DOMException("Removal rejected", "SecurityError");
        },
      },
    });

    expect(readBrowserStorage("session", "scenario")).toBeNull();
    expect(observeBrowserStorage("session", "scenario")).toBeUndefined();
    expect(writeBrowserStorage("session", "scenario", "failed-once")).toBe(false);
    expect(removeBrowserStorage("session", "scenario")).toBe(false);
  });
});
