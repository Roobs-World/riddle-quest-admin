import { Platform } from "react-native";
import {
  AUDIO_QUALITY_PRESETS,
  getOptimalAudioConfig,
  AudioQualityConfig,
} from "../audioOptimization";

// Mock Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: 30,
  },
}));

const mockPlatform = Platform as jest.Mocked<typeof Platform>;

describe("audioOptimization utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default iOS
    mockPlatform.OS = "ios";
    mockPlatform.Version = 30;
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

        // Reasonable buffer sizes (powers of 2)
        expect([1024, 2048, 4096]).toContain(preset.bufferSize);
      });
    });
  });

  describe("getOptimalAudioConfig", () => {
    it("should return HIGH preset for iOS", () => {
      mockPlatform.OS = "ios";

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return HIGH preset for Android API 28+", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = 28;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return HIGH preset for Android API 29", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = 29;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return STANDARD preset for Android API below 28", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = 27;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should return STANDARD preset for Android API 23", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = 23;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should return STANDARD preset for web platform", () => {
      mockPlatform.OS = "web" as any;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should return STANDARD preset for unknown platforms", () => {
      mockPlatform.OS = "unknown" as any;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should handle edge case Android versions", () => {
      mockPlatform.OS = "android";

      // Test boundary values
      mockPlatform.Version = 27;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      mockPlatform.Version = 28;
      expect(getOptimalAudioConfig()).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should return consistent results for multiple calls", () => {
      mockPlatform.OS = "ios";

      const config1 = getOptimalAudioConfig();
      const config2 = getOptimalAudioConfig();

      expect(config1).toEqual(config2);
      expect(config1).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });

    it("should handle platform changes correctly", () => {
      // Start with iOS
      mockPlatform.OS = "ios";
      const iosConfig = getOptimalAudioConfig();
      expect(iosConfig).toEqual(AUDIO_QUALITY_PRESETS.HIGH);

      // Switch to old Android
      mockPlatform.OS = "android";
      mockPlatform.Version = 25;
      const androidOldConfig = getOptimalAudioConfig();
      expect(androidOldConfig).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);

      // Switch to new Android
      mockPlatform.Version = 30;
      const androidNewConfig = getOptimalAudioConfig();
      expect(androidNewConfig).toEqual(AUDIO_QUALITY_PRESETS.HIGH);
    });
  });

  describe("error handling", () => {
    it("should handle getOptimalAudioConfig when Platform throws", () => {
      // Mock Platform.OS to throw
      Object.defineProperty(mockPlatform, "OS", {
        get: () => {
          throw new Error("Platform error");
        },
      });

      // Should not throw and return fallback
      expect(() => getOptimalAudioConfig()).not.toThrow();
      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should handle getOptimalAudioConfig when Platform.Version is undefined", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = undefined as any;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should handle getOptimalAudioConfig when Platform.Version is null", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = null as any;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
    });

    it("should handle getOptimalAudioConfig when Platform.Version is NaN", () => {
      mockPlatform.OS = "android";
      mockPlatform.Version = NaN;

      const config = getOptimalAudioConfig();
      expect(config).toEqual(AUDIO_QUALITY_PRESETS.STANDARD);
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
      const standard = AUDIO_QUALITY_PRESETS.STANDARD;

      // Bit rate ordering
      expect(ultra.bitRate).toBeGreaterThan(high.bitRate);
      expect(high.bitRate).toBeGreaterThan(standard.bitRate);

      // Buffer size ordering
      expect(ultra.bufferSize).toBeGreaterThan(high.bufferSize);
      expect(high.bufferSize).toBeGreaterThan(standard.bufferSize);
    });
  });
});
