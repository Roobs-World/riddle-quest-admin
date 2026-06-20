/**
 * Unit tests for useSettings hook.
 * Mocks AsyncStorage, SoundManager, safeDelay, and logger.
 */
import {renderHook, act, waitFor} from "@testing-library/react-native";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] ?? null),
  removeItem: jest.fn((key: string) => {
    delete localStorageStore[key];
  }),
  setItem: jest.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
};
// Use a simple object to hold mutable state that can be changed by tests
const setItemConfig = {shouldFail: false};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => {
    mockSetItem(...args);
    if (setItemConfig.shouldFail) {
      return Promise.reject(new Error("Storage write error"));
    }
    return Promise.resolve();
  },
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockSetSoundEnabled = jest.fn();
const mockPlayBackgroundMusic = jest.fn();
const mockPauseBackgroundMusic = jest.fn();
jest.mock("../../services/SoundManager", () => ({
  SoundManager: {
    setSoundEnabled: (...args: unknown[]) => mockSetSoundEnabled(...args),
    playBackgroundMusic: (...args: unknown[]) => mockPlayBackgroundMusic(...args),
    pauseBackgroundMusic: (...args: unknown[]) => mockPauseBackgroundMusic(...args),
  },
}));

jest.mock("../../utils/timing", () => ({
  safeDelay: () => Promise.resolve(),
}));

const mockLoggerError = jest.fn();
jest.mock("../../utils/logger", () => ({
  logger: {error: (...args: unknown[]) => mockLoggerError(...args)},
}));

const mockCaptureException = jest.fn();
jest.mock("../../utils/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import {useSettings} from "../useSettings";

describe("useSettings", () => {
  const devGlobal = globalThis as typeof globalThis & {__DEV__?: boolean};
  const originalDev = devGlobal.__DEV__;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const setDevMode = (enabled: boolean) => {
    Object.defineProperty(devGlobal, "__DEV__", {
      configurable: true,
      value: enabled,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReset();
    mockSetItem.mockClear();
    mockGetItem.mockResolvedValue(null);
    Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
    setDevMode(false);
  });

  afterEach(() => {
    Object.defineProperty(devGlobal, "__DEV__", {
      configurable: true,
      value: originalDev,
    });
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as {localStorage?: unknown}).localStorage;
    }
  });

  it("should return API with isSoundEnabled, isHapticsEnabled and toggles", async () => {
    const {result} = renderHook(() => useSettings());
    expect(result.current).toHaveProperty("isSoundEnabled");
    expect(result.current).toHaveProperty("isHapticsEnabled");
    expect(result.current).toHaveProperty("toggleSoundEnabled");
    expect(result.current).toHaveProperty("toggleHapticsEnabled");
    expect(typeof result.current.toggleSoundEnabled).toBe("function");
    expect(typeof result.current.toggleHapticsEnabled).toBe("function");
    await waitFor(() => {
      expect(mockSetSoundEnabled).toHaveBeenCalled();
    });
  });

  it("should default to sound and haptics enabled when storage is empty", async () => {
    mockGetItem.mockResolvedValue(null);
    const {result} = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isHapticsEnabled).toBe(true);
      expect(mockSetSoundEnabled).toHaveBeenCalledWith(true);
    });
    expect(result.current.isSoundEnabled).toBe(true);
  });

  it("should always load muted in development when storage is empty", async () => {
    setDevMode(true);
    mockGetItem.mockResolvedValue(null);

    const {result} = renderHook(() => useSettings());

    expect(result.current.isSoundEnabled).toBe(false);
    await waitFor(() => {
      expect(result.current.isHapticsEnabled).toBe(true);
      expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
    });
    expect(mockGetItem).not.toHaveBeenCalledWith("isSoundEnabled");
  });

  it("should ignore persisted sound-on setting in development", async () => {
    setDevMode(true);
    mockGetItem.mockResolvedValueOnce(JSON.stringify(true)).mockResolvedValueOnce(null);

    const {result} = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isSoundEnabled).toBe(false);
    });
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith("isSoundEnabled", JSON.stringify(false));
    });
  });

  it("should load persisted sound setting from AsyncStorage", async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify(false)).mockResolvedValueOnce(null);
    const {result} = renderHook(() => useSettings());
    await waitFor(() => expect(mockSetSoundEnabled).toHaveBeenCalledWith(false));
    expect(result.current.isSoundEnabled).toBe(false);
  });

  it("does not overwrite persisted muted state during initial load", async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify(false)).mockResolvedValueOnce(null);

    const {result} = renderHook(() => useSettings());

    await waitFor(() => expect(mockSetSoundEnabled).toHaveBeenCalledWith(false));
    expect(result.current.isSoundEnabled).toBe(false);

    expect(mockSetItem).not.toHaveBeenCalledWith("isSoundEnabled", JSON.stringify(true));
  });

  it("should load persisted haptics setting from AsyncStorage", async () => {
    mockGetItem.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(false));
    const {result} = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isHapticsEnabled).toBe(false);
    });
  });

  it("should persist and apply sound when toggling sound off", async () => {
    mockGetItem.mockResolvedValue(null);
    const {result} = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

    act(() => {
      result.current.toggleSoundEnabled(false);
    });

    expect(result.current.isSoundEnabled).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith("isSoundEnabled", JSON.stringify(false));
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
    expect(mockPauseBackgroundMusic).toHaveBeenCalled();
  });

  it("should persist and apply sound when toggling sound on", async () => {
    mockGetItem.mockResolvedValue(null);
    const {result} = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

    act(() => {
      result.current.toggleSoundEnabled(false);
    });
    expect(result.current.isSoundEnabled).toBe(false);

    act(() => {
      result.current.toggleSoundEnabled(true);
    });
    expect(result.current.isSoundEnabled).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith("isSoundEnabled", JSON.stringify(true));
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockPlayBackgroundMusic).toHaveBeenCalled();
    });
  });

  it("should persist haptics when toggling haptics off", async () => {
    mockGetItem.mockResolvedValue(null);
    const {result} = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isHapticsEnabled).toBe(true));

    act(() => {
      result.current.toggleHapticsEnabled(false);
    });

    expect(result.current.isHapticsEnabled).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith("isHapticsEnabled", JSON.stringify(false));
  });

  it("should call logger.error when loading settings fails", async () => {
    mockGetItem.mockRejectedValue(new Error("Storage error"));
    renderHook(() => useSettings());
    await waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith("Error loading settings from AsyncStorage:", expect.any(Error));
    });
  });

  describe("setItem error handling", () => {
    beforeEach(() => {
      setItemConfig.shouldFail = true;
    });

    afterEach(() => {
      setItemConfig.shouldFail = false;
    });

    it("should log error and capture exception when sound setting fails to save", async () => {
      mockGetItem.mockResolvedValue(null);
      const {result} = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

      act(() => {
        result.current.toggleSoundEnabled(false);
      });

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith("Error saving sound setting:", expect.any(Error));
        expect(mockCaptureException).toHaveBeenCalled();
      });
    });

    it("should log error and capture exception when haptics setting fails to save", async () => {
      mockGetItem.mockResolvedValue(null);
      const {result} = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isHapticsEnabled).toBe(true));

      act(() => {
        result.current.toggleHapticsEnabled(false);
      });

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith("Error saving haptics setting:", expect.any(Error));
        expect(mockCaptureException).toHaveBeenCalled();
      });
    });
  });
});
