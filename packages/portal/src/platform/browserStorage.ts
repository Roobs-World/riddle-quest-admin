/** Browser persistence areas available to platform adapters. */
export type BrowserStorageArea = "local" | "session";

/** Resolves a browser persistence area without leaking access errors to callers. */
const getBrowserStorage = (area: BrowserStorageArea): Storage | undefined => {
  try {
    if (typeof window !== "undefined") {
      /** Provides the requested storage area exposed by the browser window. */
      const windowStorage = area === "local" ? window.localStorage : window.sessionStorage;
      if (windowStorage) return windowStorage;
    }
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

/** Reads a value, treating unavailable browser persistence as empty. */
export const readBrowserStorage = (area: BrowserStorageArea, key: string): string | null => {
  try {
    return getBrowserStorage(area)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

/** Writes a value and reports whether browser persistence accepted it. */
export const writeBrowserStorage = (area: BrowserStorageArea, key: string, value: string): boolean => {
  try {
    /** Provides the requested storage area when it is available. */
    const storage = getBrowserStorage(area);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

/** Removes a value and reports whether browser persistence accepted the operation. */
export const removeBrowserStorage = (area: BrowserStorageArea, key: string): boolean => {
  try {
    /** Provides the requested storage area when it is available. */
    const storage = getBrowserStorage(area);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
