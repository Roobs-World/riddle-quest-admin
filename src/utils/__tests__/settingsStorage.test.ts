const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

import {
  readBooleanSetting,
  writeBooleanSetting,
  SOUND_ENABLED_STORAGE_KEY,
} from "../settingsStorage";

type LocalStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe("settingsStorage", () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage"
  );

  afterEach(() => {
    jest.clearAllMocks();
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("prefers localStorage sound value when present", async () => {
    const localStorageMock: LocalStorageMock = {
      getItem: jest.fn().mockReturnValue(JSON.stringify(false)),
      setItem: jest.fn(),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    mockGetItem.mockResolvedValue(JSON.stringify(true));

    const result = await readBooleanSetting(SOUND_ENABLED_STORAGE_KEY, true);

    expect(result).toBe(false);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it("defaults to true when no stored value exists", async () => {
    const localStorageMock: LocalStorageMock = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    mockGetItem.mockResolvedValue(null);

    const result = await readBooleanSetting(SOUND_ENABLED_STORAGE_KEY, true);

    expect(result).toBe(true);
  });

  it("writes setting to localStorage and AsyncStorage", async () => {
    const localStorageMock: LocalStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    mockSetItem.mockResolvedValue(undefined);

    await writeBooleanSetting(SOUND_ENABLED_STORAGE_KEY, false);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(false)
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(false)
    );
  });
});
