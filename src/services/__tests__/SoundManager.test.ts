import { Audio } from "expo-av";
import { AppState } from "react-native";
import { SoundManager } from "../SoundManager";

// Mock expo-av
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn(),
    },
    PitchCorrectionQuality: {
      High: "high",
    },
  },
}));

// Mock react-native AppState
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

// Mock audio asset imports
jest.mock("../../../assets/audio/Neutral.wav", () => "neutral-audio-mock");
jest.mock("../../../assets/audio/Success.wav", () => "positive-audio-mock");
jest.mock("../../../assets/audio/Negative.wav", () => "negative-audio-mock");

describe("SoundManager", () => {
  let mockSound: any;
  let mockCreateAsync: jest.MockedFunction<typeof Audio.Sound.createAsync>;
  let mockSetAudioModeAsync: jest.MockedFunction<
    typeof Audio.setAudioModeAsync
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSound = {
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: true,
        isPlaying: false,
        volume: 1.0,
      }),
      setVolumeAsync: jest.fn().mockResolvedValue(undefined),
      playAsync: jest.fn().mockResolvedValue(undefined),
      pauseAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    mockCreateAsync = Audio.Sound.createAsync as jest.MockedFunction<
      typeof Audio.Sound.createAsync
    >;
    mockCreateAsync.mockResolvedValue({
      sound: mockSound,
      status: { isLoaded: true, isPlaying: false, volume: 1.0 },
    } as any);

    mockSetAudioModeAsync = Audio.setAudioModeAsync as jest.MockedFunction<
      typeof Audio.setAudioModeAsync
    >;
    mockSetAudioModeAsync.mockResolvedValue();
  });

  describe("init", () => {
    it("should initialize with audio mode configuration", async () => {
      await SoundManager.init();

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    });

    it("should create sound instances for all music modes", async () => {
      await SoundManager.init();

      expect(mockCreateAsync).toHaveBeenCalledTimes(3);
    });

    it("should handle initialization errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockCreateAsync.mockRejectedValueOnce(new Error("Audio creation failed"));

      await SoundManager.init();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading high-fidelity music system:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getCurrentMusicMode", () => {
    it("should return current music mode", async () => {
      await SoundManager.init();

      const mode = SoundManager.getCurrentMusicMode();
      expect(mode).toBe("neutral");
    });
  });

  describe("legacy methods", () => {
    beforeEach(async () => {
      await SoundManager.init();
      jest.clearAllMocks();
    });

    it("should expose playBackgroundMusic method", () => {
      expect(typeof SoundManager.playBackgroundMusic).toBe("function");
    });

    it("should expose pauseBackgroundMusic method", () => {
      expect(typeof SoundManager.pauseBackgroundMusic).toBe("function");
    });

    it("should expose fadeInBackgroundMusic method", () => {
      expect(typeof SoundManager.fadeInBackgroundMusic).toBe("function");
    });

    it("should expose fadeOutBackgroundMusic method", () => {
      expect(typeof SoundManager.fadeOutBackgroundMusic).toBe("function");
    });
  });

  describe("sound effect methods", () => {
    beforeEach(async () => {
      await SoundManager.init();
      jest.clearAllMocks();
    });

    it("should expose playSuccess method", () => {
      expect(typeof SoundManager.playSuccess).toBe("function");
    });

    it("should expose playNegative method", () => {
      expect(typeof SoundManager.playNegative).toBe("function");
    });

    it("should expose playNegativeWithFadeIn method", () => {
      expect(typeof SoundManager.playNegativeWithFadeIn).toBe("function");
    });
  });

  describe("basic operations", () => {
    beforeEach(async () => {
      await SoundManager.init();
      jest.clearAllMocks();
    });

    it("should expose setMusicMode method", () => {
      expect(typeof SoundManager.setMusicMode).toBe("function");
    });

    it("should expose pauseCurrentMusic method", () => {
      expect(typeof SoundManager.pauseCurrentMusic).toBe("function");
    });

    it("should expose resumeCurrentMusic method", () => {
      expect(typeof SoundManager.resumeCurrentMusic).toBe("function");
    });

    it("should expose unload method", () => {
      expect(typeof SoundManager.unload).toBe("function");
    });

    it("should expose pauseAllMusic method", () => {
      expect(typeof SoundManager.pauseAllMusic).toBe("function");
    });
  });

  describe("fade operations", () => {
    beforeEach(async () => {
      await SoundManager.init();
      jest.clearAllMocks();
    });

    it("should expose fadeIn method", () => {
      expect(typeof SoundManager.fadeIn).toBe("function");
    });

    it("should expose fadeOut method", () => {
      expect(typeof SoundManager.fadeOut).toBe("function");
    });

    it("should expose crossfade method", () => {
      expect(typeof SoundManager.crossfade).toBe("function");
    });

    it("should expose cancelFade method", () => {
      expect(typeof SoundManager.cancelFade).toBe("function");
    });
  });

  describe("unload", () => {
    it("should call unloadAsync on all sound instances", async () => {
      await SoundManager.init();

      await SoundManager.unload();

      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    it("should handle unload errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await SoundManager.init();
      mockSound.unloadAsync.mockRejectedValueOnce(new Error("Unload error"));

      await SoundManager.unload();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error unloading music:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
