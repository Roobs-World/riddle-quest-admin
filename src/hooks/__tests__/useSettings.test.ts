/**
 * Unit tests for useSettings hook.
 * Mocks AsyncStorage, SoundManager, safeDelay, and logger.
 */
import { renderHook, act, waitFor } from "@testing-library/react-native";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
// Use a simple object to hold mutable state that can be changed by tests
const setItemConfig = { shouldFail: false };
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
    pauseBackgroundMusic: (...args: unknown[]) =>
      mockPauseBackgroundMusic(...args),
  },
}));

jest.mock("../../utils/timing", () => ({
  safeDelay: () => Promise.resolve(),
}));

const mockLoggerError = jest.fn();
jest.mock("../../utils/logger", () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

const mockCaptureException = jest.fn();
jest.mock("../../utils/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { useSettings } from "../useSettings";

describe("useSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
  });

  it("should return API with isSoundEnabled, isHapticsEnabled, isHardMode, and toggles", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current).toHaveProperty("isSoundEnabled");
    expect(result.current).toHaveProperty("isHapticsEnabled");
    expect(result.current).toHaveProperty("isHardMode");
    expect(result.current).toHaveProperty("toggleSoundEnabled");
    expect(result.current).toHaveProperty("toggleHapticsEnabled");
    expect(result.current).toHaveProperty("toggleHardMode");
    expect(typeof result.current.toggleSoundEnabled).toBe("function");
    expect(typeof result.current.toggleHapticsEnabled).toBe("function");
    expect(typeof result.current.toggleHardMode).toBe("function");
  });

  it("should default to sound and haptics enabled and hard mode off when storage is empty", async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isSoundEnabled).toBe(true);
      expect(result.current.isHapticsEnabled).toBe(true);
      expect(result.current.isHardMode).toBe(false);
    });
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(true);
  });

  it("should load persisted sound setting from AsyncStorage", async () => {
    mockGetItem
      .mockResolvedValueOnce(JSON.stringify(false))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isSoundEnabled).toBe(false);
    });
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
  });

  it("should load persisted haptics setting from AsyncStorage", async () => {
    mockGetItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(false));
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isHapticsEnabled).toBe(false);
    });
  });

  it("should persist and apply sound when toggling sound off", async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

    act(() => {
      result.current.toggleSoundEnabled(false);
    });

    expect(result.current.isSoundEnabled).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith(
      "isSoundEnabled",
      JSON.stringify(false)
    );
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
    expect(mockPauseBackgroundMusic).toHaveBeenCalled();
  });

  it("should persist and apply sound when toggling sound on", async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

    act(() => {
      result.current.toggleSoundEnabled(false);
    });
    expect(result.current.isSoundEnabled).toBe(false);

    act(() => {
      result.current.toggleSoundEnabled(true);
    });
    expect(result.current.isSoundEnabled).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      "isSoundEnabled",
      JSON.stringify(true)
    );
    expect(mockSetSoundEnabled).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockPlayBackgroundMusic).toHaveBeenCalled();
    });
  });

  it("should persist haptics when toggling haptics off", async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isHapticsEnabled).toBe(true));

    act(() => {
      result.current.toggleHapticsEnabled(false);
    });

    expect(result.current.isHapticsEnabled).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith(
      "isHapticsEnabled",
      JSON.stringify(false)
    );
  });

  it("should call logger.error when loading settings fails", async () => {
    mockGetItem.mockRejectedValue(new Error("Storage error"));
    renderHook(() => useSettings());
    await waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Error loading settings from AsyncStorage:",
        expect.any(Error)
      );
    });
  });

  it("should load persisted hard mode setting from AsyncStorage", async () => {
    mockGetItem
      .mockResolvedValueOnce(null) // sound
      .mockResolvedValueOnce(null) // haptics
      .mockResolvedValueOnce(JSON.stringify(true)); // hard mode
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.isHardMode).toBe(true);
    });
  });

  it("should persist hard mode when toggling on", async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isHardMode).toBe(false));

    act(() => {
      result.current.toggleHardMode(true);
    });

    expect(result.current.isHardMode).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      "isHardMode",
      JSON.stringify(true)
    );
  });

  it("should persist hard mode when toggling off", async () => {
    mockGetItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(true));
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isHardMode).toBe(true));

    act(() => {
      result.current.toggleHardMode(false);
    });

    expect(result.current.isHardMode).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith(
      "isHardMode",
      JSON.stringify(false)
    );
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
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isSoundEnabled).toBe(true));

      act(() => {
        result.current.toggleSoundEnabled(false);
      });

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          "Error saving sound setting:",
          expect.any(Error)
        );
        expect(mockCaptureException).toHaveBeenCalled();
      });
    });

    it("should log error and capture exception when haptics setting fails to save", async () => {
      mockGetItem.mockResolvedValue(null);
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isHapticsEnabled).toBe(true));

      act(() => {
        result.current.toggleHapticsEnabled(false);
      });

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          "Error saving haptics setting:",
          expect.any(Error)
        );
        expect(mockCaptureException).toHaveBeenCalled();
      });
    });

    it("should log error and capture exception when hard mode setting fails to save", async () => {
      mockGetItem.mockResolvedValue(null);
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isHardMode).toBe(false));

      act(() => {
        result.current.toggleHardMode(true);
      });

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          "Error saving hard mode setting:",
          expect.any(Error)
        );
        expect(mockCaptureException).toHaveBeenCalled();
      });
    });
  });
});

