import { Audio } from "expo-av";
import { AppState } from "react-native";
import { SoundManager } from "../SoundManager";
import * as audioOptimization from "../../utils/audioOptimization";

// Mock the entire audioOptimization module
jest.mock("../../utils/audioOptimization", () => ({
  configureHighQualityAudioSession: jest.fn().mockResolvedValue(undefined),
  createHighQualitySound: jest.fn(),
  getOptimalAudioConfig: jest.fn().mockReturnValue({}),
  monitorAudioQuality: jest.fn(),
}));

// Mock expo-av
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: jest.fn(() => ({
      getStatusAsync: jest
        .fn()
        .mockResolvedValue({ isLoaded: true, isPlaying: false }),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setStatusAsync: jest.fn().mockResolvedValue(undefined),
      playAsync: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock react-native AppState
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => callback()),
  },
}));

// Mock audio asset imports
jest.mock("../../../assets/audio/Neutral.wav", () => "neutral-audio-mock");
jest.mock("../../../assets/audio/Success.wav", () => "positive-audio-mock");
jest.mock("../../../assets/audio/Negative.wav", () => "negative-audio-mock");

const mockSound = {
  getStatusAsync: jest.fn().mockResolvedValue({
    isLoaded: true,
    isPlaying: false,
    volume: 1.0,
  }),
  setStatusAsync: jest.fn().mockResolvedValue(undefined),
  playAsync: jest.fn().mockResolvedValue(undefined),
  unloadAsync: jest.fn().mockResolvedValue(undefined),
};

describe("SoundManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock for createHighQualitySound
    (audioOptimization.createHighQualitySound as jest.Mock).mockResolvedValue({
      sound: mockSound,
    });
  });

  describe("init", () => {
    it("should initialize with audio mode configuration", async () => {
      await SoundManager.init();

      expect(
        audioOptimization.configureHighQualityAudioSession
      ).toHaveBeenCalled();
      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
    });

    it("should create sound instances for all music modes", async () => {
      await SoundManager.init();

      expect(audioOptimization.createHighQualitySound).toHaveBeenCalledTimes(3);
      expect(audioOptimization.monitorAudioQuality).toHaveBeenCalledTimes(3);
    });

    it("should handle initialization errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (
        audioOptimization.createHighQualitySound as jest.Mock
      ).mockRejectedValueOnce(new Error("Audio creation failed"));

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
      await SoundManager.init(); // Initialize to create sounds
      await SoundManager.unload();

      // We have 3 sounds, so unload should be called on each
      expect(mockSound.unloadAsync).toHaveBeenCalledTimes(3);
    });

    it("should handle unload errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await SoundManager.init();

      // Make one of the unload calls fail
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
