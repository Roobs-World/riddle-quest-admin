import {
  AUDIO_QUALITY_PRESETS,
  getOptimalAudioConfig,
  AudioQualityConfig,
  configureHighQualityAudioSession,
  createHighQualitySound,
  monitorAudioQuality,
  validateAudioQuality,
  applyAudioEnhancements,
} from "../audioOptimization";
import type {AudioPlayer} from "expo-audio";

// Mock expo-audio
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockCreateAudioPlayer = jest.fn();

jest.mock("expo-audio", () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

// Mock logger
jest.mock("../logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock sentry
jest.mock("../sentry", () => ({
  captureException: jest.fn(),
}));

// Mutable Platform mock - override Platform in react-native for this test file
const platformMock: {OS: string; Version?: number} = {
  OS: "ios",
  Version: 30,
};
jest.mock("react-native", () => ({
  Platform: platformMock,
}));

describe("audioOptimization utility", () => {
  const originalDev = __DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default iOS
    platformMock.OS = "ios";
    platformMock.Version = 30;
    // Restore process.env
    delete process.env.EXPO_PRESERVE_AUDIO_QUALITY;
    Object.defineProperty(global, "__DEV__", {value: originalDev});
  });

  describe("AUDIO_QUALITY_PRESETS", () => {
    it("should provide ULTRA_HIGH quality preset", () => {
      expect(AUDIO_QUALITY_PRESETS.ULTRA_HIGH).toEqual({
        enableHighQuality: true,
        sampleRate: 48000,
        bitRate: 320000,
        bufferSize: 4096,
        useHardwareAcceleration: true,
      });
    });

    it("should provide HIGH quality preset", () => {
      expect(AUDIO_QUALITY_PRESETS.HIGH).toEqual({
        enableHighQuality: true,
        sampleRate: 44100,
        bitRate: 256000,
        bufferSize: 2048,
        useHardwareAcceleration: true,
      });
    });

    it("should provide STANDARD quality preset", () => {
      expect(AUDIO_QUALITY_PRESETS.STANDARD).toEqual({
        enableHighQuality: false,
        sampleRate: 44100,
        bitRate: 128000,
        bufferSize: 1024,
        useHardwareAcceleration: false,
      });
    });

    it("should provide ADAPTIVE_SMOOTH quality preset", () => {
      expect(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH).toEqual({
        enableHighQuality: true,
        sampleRate: 44100,
        bitRate: 192000,
        bufferSize: 1536,
        useHardwareAcceleration: true,
      });
    });

    it("should have all required properties in each preset", () => {
      const requiredProperties: (keyof AudioQualityConfig)[] = [
        "enableHighQuality",
        "sampleRate",
        "bitRate",
        "bufferSize",
        "useHardwareAcceleration",
      ];

      Object.values(AUDIO_QUALITY_PRESETS).forEach((preset) => {
        requiredProperties.forEach((property) => {
          expect(preset).toHaveProperty(property);
          expect(preset[property]).toBeDefined();
        });
      });
    });

    it("should have proper value types in presets", () => {
      Object.values(AUDIO_QUALITY_PRESETS).forEach((preset) => {
        expect(typeof preset.enableHighQuality).toBe("boolean");
        expect(typeof preset.sampleRate).toBe("number");
        expect(typeof preset.bitRate).toBe("number");
        expect(typeof preset.bufferSize).toBe("number");
        expect(typeof preset.useHardwareAcceleration).toBe("boolean");
      });
    });

    it("should have reasonable numerical values", () => {
      Object.values(AUDIO_QUALITY_PRESETS).forEach((preset) => {
        expect(preset.sampleRate).toBeGreaterThan(0);
        expect(preset.bitRate).toBeGreaterThan(0);
        expect(preset.bufferSize).toBeGreaterThan(0);

        // Common audio sample rates
        expect([44100, 48000]).toContain(preset.sampleRate);

        // Reasonable buffer sizes (powers of 2, or adaptive)
        expect([1024, 1536, 2048, 4096]).toContain(preset.bufferSize);
      });
    });
  });

  describe("getOptimalAudioConfig", () => {
    it("should return ULTRA_HIGH for production builds", () => {
      process.env.EXPO_PRESERVE_AUDIO_QUALITY = "1";
      Object.defineProperty(global, "__DEV__", {value: false});

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ULTRA_HIGH);
    });

    it("should return HIGH preset for iOS in dev", () => {
      platformMock.OS = "ios";
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return HIGH preset for Android API 30+ in dev", () => {
      platformMock.OS = "android";
      platformMock.Version = 30;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return ADAPTIVE_SMOOTH for Android API 28-29 in dev", () => {
      platformMock.OS = "android";

      platformMock.Version = 28;
      let config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);

      platformMock.Version = 29;
      config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);
    });

    it("should return STANDARD for Android API 24-27 in dev", () => {
      platformMock.OS = "android";

      platformMock.Version = 24;
      let config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      platformMock.Version = 27;
      config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should return STANDARD for Android API below 24 in dev", () => {
      platformMock.OS = "android";
      platformMock.Version = 23;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should return ADAPTIVE_SMOOTH preset for web platform", () => {
      platformMock.OS = "web" as any;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);
    });

    it("should return ADAPTIVE_SMOOTH preset for unknown platforms", () => {
      platformMock.OS = "unknown" as any;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);
    });

    it("should handle edge case Android versions correctly", () => {
      platformMock.OS = "android";

      platformMock.Version = 23;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      platformMock.Version = 24;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      platformMock.Version = 27;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      platformMock.Version = 28;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);
      platformMock.Version = 29;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);
      platformMock.Version = 30;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });
  });

  describe("error handling", () => {
    it("should return ADAPTIVE_SMOOTH when Platform throws", () => {
      const origOS = platformMock.OS;
      Object.defineProperty(platformMock, "OS", {
        get: () => {
          throw new Error("Platform error");
        },
        configurable: true,
      });
      const loggerSpy = jest.spyOn(require("../logger").logger, "error").mockImplementation();

      expect(() => getOptimalAudioConfig()).not.toThrow();
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH);

      Object.defineProperty(platformMock, "OS", {value: origOS, configurable: true});
      loggerSpy.mockRestore();
    });

    it("should return HIGH when Platform.Version is undefined on Android", () => {
      platformMock.OS = "android";
      platformMock.Version = undefined as any;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return HIGH when Platform.Version is null on Android", () => {
      platformMock.OS = "android";
      (platformMock as any).Version = null;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return HIGH when Platform.Version is NaN on Android", () => {
      platformMock.OS = "android";
      platformMock.Version = NaN;
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });
  });

  describe("configuration validation", () => {
    it("should ensure HIGH preset has better quality than STANDARD", () => {
      const high = AUDIO_QUALITY_PRESETS.HIGH;
      const standard = AUDIO_QUALITY_PRESETS.STANDARD;

      expect(high.enableHighQuality).toBe(true);
      expect(standard.enableHighQuality).toBe(false);

      expect(high.bitRate).toBeGreaterThan(standard.bitRate);
      expect(high.bufferSize).toBeGreaterThan(standard.bufferSize);

      expect(high.useHardwareAcceleration).toBe(true);
      expect(standard.useHardwareAcceleration).toBe(false);
    });

    it("should ensure ULTRA_HIGH preset has better quality than HIGH", () => {
      const ultraHigh = AUDIO_QUALITY_PRESETS.ULTRA_HIGH;
      const high = AUDIO_QUALITY_PRESETS.HIGH;

      expect(ultraHigh.enableHighQuality).toBe(true);
      expect(high.enableHighQuality).toBe(true);

      expect(ultraHigh.bitRate).toBeGreaterThan(high.bitRate);
      expect(ultraHigh.bufferSize).toBeGreaterThan(high.bufferSize);
      expect(ultraHigh.sampleRate).toBeGreaterThanOrEqual(high.sampleRate);

      expect(ultraHigh.useHardwareAcceleration).toBe(true);
      expect(high.useHardwareAcceleration).toBe(true);
    });

    it("should have consistent quality ordering", () => {
      const ultra = AUDIO_QUALITY_PRESETS.ULTRA_HIGH;
      const high = AUDIO_QUALITY_PRESETS.HIGH;
      const adaptive = AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
      const standard = AUDIO_QUALITY_PRESETS.STANDARD;

      // Bit rate ordering
      expect(ultra.bitRate).toBeGreaterThan(high.bitRate);
      expect(high.bitRate).toBeGreaterThan(adaptive.bitRate);
      expect(adaptive.bitRate).toBeGreaterThan(standard.bitRate);

      // Buffer size ordering
      expect(ultra.bufferSize).toBeGreaterThan(high.bufferSize);
      expect(high.bufferSize).toBeGreaterThan(adaptive.bufferSize);
      expect(adaptive.bufferSize).toBeGreaterThan(standard.bufferSize);
    });
  });

  describe("configureHighQualityAudioSession", () => {
    beforeEach(() => {
      mockSetAudioModeAsync.mockClear();
      mockSetAudioModeAsync.mockResolvedValue(undefined);
    });

    it("should configure audio session with correct options", async () => {
      await configureHighQualityAudioSession();

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "doNotMix",
      });
    });

    it("should throw when setAudioModeAsync fails", async () => {
      const error = new Error("Audio mode error");
      mockSetAudioModeAsync.mockRejectedValueOnce(error);

      await expect(configureHighQualityAudioSession()).rejects.toThrow("Audio mode error");
    });

    it("should capture exception when setAudioModeAsync fails", async () => {
      const {captureException} = require("../sentry");
      const error = new Error("Audio mode error");
      mockSetAudioModeAsync.mockRejectedValueOnce(error);

      try {
        await configureHighQualityAudioSession();
      } catch {
        // Expected
      }

      expect(captureException).toHaveBeenCalledWith(error);
    });
  });

  describe("createHighQualitySound", () => {
    const mockPlayer = {
      loop: false,
      volume: 1.0,
      isLoaded: true,
      duration: 1000,
      play: jest.fn(),
      pause: jest.fn(),
    };

    beforeEach(() => {
      mockCreateAudioPlayer.mockClear();
      mockCreateAudioPlayer.mockReturnValue(mockPlayer);
    });

    it("should create audio player with source", async () => {
      const source = {uri: "test.mp3"};
      const result = await createHighQualitySound(source);

      expect(mockCreateAudioPlayer).toHaveBeenCalledWith(source);
      expect(result.sound).toBe(mockPlayer);
    });

    it("should set loop option when provided", async () => {
      const source = {uri: "test.mp3"};
      await createHighQualitySound(source, {loop: true});

      expect(mockPlayer.loop).toBe(true);
    });

    it("should set volume option when provided", async () => {
      const source = {uri: "test.mp3"};
      await createHighQualitySound(source, {volume: 0.5});

      expect(mockPlayer.volume).toBe(0.5);
    });

    it("should use default values when options not provided", async () => {
      const freshPlayer = {loop: false, volume: 1.0};
      mockCreateAudioPlayer.mockReturnValue(freshPlayer);

      await createHighQualitySound({uri: "test.mp3"});

      expect(freshPlayer.loop).toBe(false);
      expect(freshPlayer.volume).toBe(1.0);
    });

    it("should throw when createAudioPlayer fails", async () => {
      const error = new Error("Player creation error");
      mockCreateAudioPlayer.mockImplementationOnce(() => {
        throw error;
      });

      await expect(createHighQualitySound({uri: "test.mp3"})).rejects.toThrow("Player creation error");
    });

    it("should capture exception when createAudioPlayer fails", async () => {
      const {captureException} = require("../sentry");
      const error = new Error("Player creation error");
      mockCreateAudioPlayer.mockImplementationOnce(() => {
        throw error;
      });

      try {
        await createHighQualitySound({uri: "test.mp3"});
      } catch {
        // Expected
      }

      expect(captureException).toHaveBeenCalledWith(error);
    });
  });

  describe("monitorAudioQuality", () => {
    it("should be a no-op function for API compatibility", () => {
      const mockSound = {} as AudioPlayer;

      // Should not throw
      expect(() => monitorAudioQuality(mockSound)).not.toThrow();
    });
  });

  describe("validateAudioQuality", () => {
    it("should return true for valid loaded sound", async () => {
      const mockSound = {
        isLoaded: true,
        duration: 1000,
      } as AudioPlayer;

      const result = await validateAudioQuality(mockSound);
      expect(result).toBe(true);
    });

    it("should return false when sound is not loaded", async () => {
      const mockSound = {
        isLoaded: false,
        duration: 1000,
      } as AudioPlayer;

      const result = await validateAudioQuality(mockSound);
      expect(result).toBe(false);
    });

    it("should return false when duration is 0", async () => {
      const mockSound = {
        isLoaded: true,
        duration: 0,
      } as AudioPlayer;

      const result = await validateAudioQuality(mockSound);
      expect(result).toBe(false);
    });

    it("should return false when duration is negative", async () => {
      const mockSound = {
        isLoaded: true,
        duration: -1,
      } as AudioPlayer;

      const result = await validateAudioQuality(mockSound);
      expect(result).toBe(false);
    });

    it("should return false and capture exception on error", async () => {
      const {captureException} = require("../sentry");
      const mockSound = {
        get isLoaded() {
          throw new Error("Access error");
        },
      } as unknown as AudioPlayer;

      const result = await validateAudioQuality(mockSound);
      expect(result).toBe(false);
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe("applyAudioEnhancements", () => {
    it("should set volume to 1.0", async () => {
      const mockSound = {
        volume: 0.5,
        playbackRate: 0.5,
      } as AudioPlayer;

      await applyAudioEnhancements(mockSound);
      expect(mockSound.volume).toBe(1.0);
    });

    it("should set playbackRate to 1.0", async () => {
      const mockSound = {
        volume: 0.5,
        playbackRate: 0.5,
      } as AudioPlayer;

      await applyAudioEnhancements(mockSound);
      expect(mockSound.playbackRate).toBe(1.0);
    });

    it("should capture exception on error", async () => {
      const {captureException} = require("../sentry");
      const mockSound = {
        set volume(_: number) {
          throw new Error("Volume error");
        },
        playbackRate: 1.0,
      } as unknown as AudioPlayer;

      await applyAudioEnhancements(mockSound);
      expect(captureException).toHaveBeenCalled();
    });
  });
});
