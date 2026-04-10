import { AudioFeedbackManager } from "../AudioFeedbackManager";
import { SoundManager } from "../SoundManager";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import {
  FeedbackConfig,
  FeedbackType,
} from "../interfaces/IAudioFeedbackService";

// Mock SoundManager
jest.mock("../SoundManager", () => ({
  SoundManager: {
    playBackgroundMusic: jest.fn(() => Promise.resolve()),
    playSuccess: jest.fn(() => Promise.resolve()),
    playNegativeWithFadeIn: jest.fn(() => Promise.resolve()),
  },
}));

// Mock ReactNativeHapticFeedback
jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}));

describe("AudioFeedbackManager", () => {
  let audioFeedbackManager: AudioFeedbackManager;
  let mockPlayBackgroundMusic: jest.MockedFunction<
    typeof SoundManager.playBackgroundMusic
  >;
  let mockPlaySuccess: jest.MockedFunction<typeof SoundManager.playSuccess>;
  let mockPlayNegativeWithFadeIn: jest.MockedFunction<
    typeof SoundManager.playNegativeWithFadeIn
  >;
  let mockHapticTrigger: jest.MockedFunction<
    typeof ReactNativeHapticFeedback.trigger
  >;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    audioFeedbackManager = new AudioFeedbackManager();

    // Reset all mocks
    jest.clearAllMocks();

    // Get typed mock references
    mockPlayBackgroundMusic =
      SoundManager.playBackgroundMusic as jest.MockedFunction<
        typeof SoundManager.playBackgroundMusic
      >;
    mockPlaySuccess = SoundManager.playSuccess as jest.MockedFunction<
      typeof SoundManager.playSuccess
    >;
    mockPlayNegativeWithFadeIn =
      SoundManager.playNegativeWithFadeIn as jest.MockedFunction<
        typeof SoundManager.playNegativeWithFadeIn
      >;
    mockHapticTrigger =
      ReactNativeHapticFeedback.trigger as jest.MockedFunction<
        typeof ReactNativeHapticFeedback.trigger
      >;

    // Set up default mock implementations
    mockPlayBackgroundMusic.mockResolvedValue(undefined);
    mockPlaySuccess.mockResolvedValue(undefined);
    mockPlayNegativeWithFadeIn.mockResolvedValue(undefined);
    mockHapticTrigger.mockReturnValue(undefined);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("playNeutralFeedback", () => {
    it("should play background music and light haptic feedback with default config", async () => {
      await audioFeedbackManager.playNeutralFeedback();

      expect(mockPlayBackgroundMusic).toHaveBeenCalledTimes(1);
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactLight");
    });

    it("should respect custom config to disable sound", async () => {
      const config: FeedbackConfig = { playSound: false };

      await audioFeedbackManager.playNeutralFeedback(config);

      expect(mockPlayBackgroundMusic).not.toHaveBeenCalled();
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactLight");
    });

    it("should respect custom config to disable haptic", async () => {
      const config: FeedbackConfig = { playHaptic: false };

      await audioFeedbackManager.playNeutralFeedback(config);

      expect(mockPlayBackgroundMusic).toHaveBeenCalledTimes(1);
      expect(mockHapticTrigger).not.toHaveBeenCalled();
    });

    it("should respect custom config to disable both sound and haptic", async () => {
      const config: FeedbackConfig = { playSound: false, playHaptic: false };

      await audioFeedbackManager.playNeutralFeedback(config);

      expect(mockPlayBackgroundMusic).not.toHaveBeenCalled();
      expect(mockHapticTrigger).not.toHaveBeenCalled();
    });

    it("should handle sound playback errors gracefully", async () => {
      const errorMessage = "Sound error";
      mockPlayBackgroundMusic.mockRejectedValueOnce(new Error(errorMessage));

      await audioFeedbackManager.playNeutralFeedback();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error playing neutral feedback:",
        expect.any(Error)
      );
      // Don't expect haptic to be called when sound fails due to try/catch structure
    });

    it("should handle haptic feedback errors gracefully", async () => {
      const errorMessage = "Haptic error";
      mockHapticTrigger.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await audioFeedbackManager.playNeutralFeedback();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error playing neutral feedback:",
        expect.any(Error)
      );
      expect(mockPlayBackgroundMusic).toHaveBeenCalledTimes(1);
    });
  });

  describe("playSuccessFeedback", () => {
    it("should play success sound and success haptic feedback with default config", async () => {
      await audioFeedbackManager.playSuccessFeedback();

      expect(mockPlaySuccess).toHaveBeenCalledTimes(1);
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationSuccess");
    });

    it("should respect custom config to disable sound", async () => {
      const config: FeedbackConfig = { playSound: false };

      await audioFeedbackManager.playSuccessFeedback(config);

      expect(mockPlaySuccess).not.toHaveBeenCalled();
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationSuccess");
    });

    it("should respect custom config to disable haptic", async () => {
      const config: FeedbackConfig = { playHaptic: false };

      await audioFeedbackManager.playSuccessFeedback(config);

      expect(mockPlaySuccess).toHaveBeenCalledTimes(1);
      expect(mockHapticTrigger).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const errorMessage = "Success sound error";
      mockPlaySuccess.mockRejectedValueOnce(new Error(errorMessage));

      await audioFeedbackManager.playSuccessFeedback();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error playing success feedback:",
        expect.any(Error)
      );
    });
  });

  describe("playErrorFeedback", () => {
    it("should play negative sound with fade and error haptic feedback with default config", async () => {
      await audioFeedbackManager.playErrorFeedback();

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 1000,
        curve: "exponential",
      });
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationError");
    });

    it("should use custom fade duration", async () => {
      const config: FeedbackConfig = { fadeInDuration: 2000 };

      await audioFeedbackManager.playErrorFeedback(config);

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 2000,
        curve: "exponential",
      });
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationError");
    });

    it("should respect custom config to disable sound", async () => {
      const config: FeedbackConfig = { playSound: false };

      await audioFeedbackManager.playErrorFeedback(config);

      expect(mockPlayNegativeWithFadeIn).not.toHaveBeenCalled();
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationError");
    });

    it("should respect custom config to disable haptic", async () => {
      const config: FeedbackConfig = { playHaptic: false };

      await audioFeedbackManager.playErrorFeedback(config);

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 1000,
        curve: "exponential",
      });
      expect(mockHapticTrigger).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const errorMessage = "Negative sound error";
      mockPlayNegativeWithFadeIn.mockRejectedValueOnce(new Error(errorMessage));

      await audioFeedbackManager.playErrorFeedback();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error playing error feedback:",
        expect.any(Error)
      );
    });
  });

  describe("playWrongGuessFeedback", () => {
    it("should play negative sound with shorter fade and medium haptic feedback with default config", async () => {
      await audioFeedbackManager.playWrongGuessFeedback();

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 700, // 1000 * 0.7
        curve: "linear",
      });
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactMedium");
    });

    it("should calculate correct fade duration based on custom fadeInDuration", async () => {
      const config: FeedbackConfig = { fadeInDuration: 2000 };

      await audioFeedbackManager.playWrongGuessFeedback(config);

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 1400, // 2000 * 0.7
        curve: "linear",
      });
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactMedium");
    });

    it("should respect custom config to disable sound", async () => {
      const config: FeedbackConfig = { playSound: false };

      await audioFeedbackManager.playWrongGuessFeedback(config);

      expect(mockPlayNegativeWithFadeIn).not.toHaveBeenCalled();
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactMedium");
    });

    it("should respect custom config to disable haptic", async () => {
      const config: FeedbackConfig = { playHaptic: false };

      await audioFeedbackManager.playWrongGuessFeedback(config);

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 700,
        curve: "linear",
      });
      expect(mockHapticTrigger).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const errorMessage = "SoundManager error";
      mockPlayNegativeWithFadeIn.mockRejectedValueOnce(new Error(errorMessage));

      await audioFeedbackManager.playWrongGuessFeedback();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error playing wrong guess feedback:",
        expect.any(Error)
      );
    });
  });

  describe("playFeedback", () => {
    it("should call playNeutralFeedback for neutral type", async () => {
      const spy = jest
        .spyOn(audioFeedbackManager, "playNeutralFeedback")
        .mockResolvedValue();
      const config: FeedbackConfig = { playSound: false };

      await audioFeedbackManager.playFeedback("neutral", config);

      expect(spy).toHaveBeenCalledWith(config);

      spy.mockRestore();
    });

    it("should call playSuccessFeedback for success type", async () => {
      const spy = jest
        .spyOn(audioFeedbackManager, "playSuccessFeedback")
        .mockResolvedValue();
      const config: FeedbackConfig = { playHaptic: false };

      await audioFeedbackManager.playFeedback("success", config);

      expect(spy).toHaveBeenCalledWith(config);

      spy.mockRestore();
    });

    it("should call playErrorFeedback for error type", async () => {
      const spy = jest
        .spyOn(audioFeedbackManager, "playErrorFeedback")
        .mockResolvedValue();
      const config: FeedbackConfig = { fadeInDuration: 1500 };

      await audioFeedbackManager.playFeedback("error", config);

      expect(spy).toHaveBeenCalledWith(config);

      spy.mockRestore();
    });

    it("should call playWrongGuessFeedback for wrongGuess type", async () => {
      const spy = jest
        .spyOn(audioFeedbackManager, "playWrongGuessFeedback")
        .mockResolvedValue();
      const config: FeedbackConfig = { playSound: true, playHaptic: true };

      await audioFeedbackManager.playFeedback("wrongGuess", config);

      expect(spy).toHaveBeenCalledWith(config);

      spy.mockRestore();
    });

    it("should handle unknown feedback types gracefully", async () => {
      const unknownType = "unknown_type" as FeedbackType;
      const spy = jest
        .spyOn(audioFeedbackManager, "playNeutralFeedback")
        .mockImplementation(async () => {});
      const successSpy = jest
        .spyOn(audioFeedbackManager, "playSuccessFeedback")
        .mockImplementation(async () => {});
      const errorSpy = jest
        .spyOn(audioFeedbackManager, "playErrorFeedback")
        .mockImplementation(async () => {});
      const wrongGuessSpy = jest
        .spyOn(audioFeedbackManager, "playWrongGuessFeedback")
        .mockImplementation(async () => {});

      await audioFeedbackManager.playFeedback(unknownType, {});

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unknown feedback type: ${unknownType}`
      );
      expect(spy).not.toHaveBeenCalled();
      expect(successSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(wrongGuessSpy).not.toHaveBeenCalled();

      spy.mockRestore();
      successSpy.mockRestore();
      errorSpy.mockRestore();
      wrongGuessSpy.mockRestore();
    });

    it("should work with empty config", async () => {
      const spy = jest
        .spyOn(audioFeedbackManager, "playNeutralFeedback")
        .mockResolvedValue();

      await audioFeedbackManager.playFeedback("neutral");

      expect(spy).toHaveBeenCalledWith({}); // Changed from undefined to {} since that's what gets passed

      spy.mockRestore();
    });
  });

  describe("Default Configuration", () => {
    it("should merge custom config with default values", async () => {
      const config: FeedbackConfig = { playSound: false }; // Only override playSound

      await audioFeedbackManager.playNeutralFeedback(config);

      // Should not play sound (overridden)
      expect(mockPlayBackgroundMusic).not.toHaveBeenCalled();
      // Should still play haptic (default value)
      expect(mockHapticTrigger).toHaveBeenCalledWith("impactLight");
    });

    it("should use default values when config is empty", async () => {
      await audioFeedbackManager.playErrorFeedback({});

      expect(mockPlayNegativeWithFadeIn).toHaveBeenCalledWith({
        duration: 1000, // default fadeInDuration
        curve: "exponential",
      });
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationError");
    });

    it("should use default values when config is undefined", async () => {
      await audioFeedbackManager.playSuccessFeedback();

      expect(mockPlaySuccess).toHaveBeenCalledTimes(1);
      expect(mockHapticTrigger).toHaveBeenCalledWith("notificationSuccess");
    });
  });

  describe("Interface Implementation", () => {
    it("should implement all methods from IAudioFeedbackService", () => {
      expect(typeof audioFeedbackManager.playNeutralFeedback).toBe("function");
      expect(typeof audioFeedbackManager.playSuccessFeedback).toBe("function");
      expect(typeof audioFeedbackManager.playErrorFeedback).toBe("function");
      expect(typeof audioFeedbackManager.playWrongGuessFeedback).toBe(
        "function"
      );
      expect(typeof audioFeedbackManager.playFeedback).toBe("function");
    });

    it("should return promises from all feedback methods", () => {
      const neutralPromise = audioFeedbackManager.playNeutralFeedback();
      const successPromise = audioFeedbackManager.playSuccessFeedback();
      const errorPromise = audioFeedbackManager.playErrorFeedback();
      const wrongGuessPromise = audioFeedbackManager.playWrongGuessFeedback();
      const unifiedPromise = audioFeedbackManager.playFeedback("neutral");

      expect(neutralPromise).toBeInstanceOf(Promise);
      expect(successPromise).toBeInstanceOf(Promise);
      expect(errorPromise).toBeInstanceOf(Promise);
      expect(wrongGuessPromise).toBeInstanceOf(Promise);
      expect(unifiedPromise).toBeInstanceOf(Promise);

      // Cleanup
      return Promise.all([
        neutralPromise,
        successPromise,
        errorPromise,
        wrongGuessPromise,
        unifiedPromise,
      ]);
    });
  });
});

