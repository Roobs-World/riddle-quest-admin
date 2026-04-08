import {
  AUDIO_QUALITY_PRESETS,
  getOptimalAudioConfig,
  AudioQualityConfig,
} from "../audioOptimization";

// Mutable Platform mock - override Platform in react-native for this test file
const platformMock: { OS: string; Version?: number } = {
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
    Object.defineProperty(global, "__DEV__", { value: originalDev });
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
      Object.defineProperty(global, "__DEV__", { value: false });

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
      expect(getOptimalAudioConfig()).toEqual(
        AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH
      );
      platformMock.Version = 29;
      expect(getOptimalAudioConfig()).toEqual(
        AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH
      );
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

      Object.defineProperty(platformMock, "OS", { value: origOS, configurable: true });
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
});
