import { AppState } from "react-native";
import { SoundManager } from "../SoundManager";
import * as audioOptimization from "../../utils/audioOptimization";

jest.mock("../../utils/audioOptimization", () => ({
  configureHighQualityAudioSession: jest.fn().mockResolvedValue(undefined),
  createHighQualitySound: jest.fn(),
  getOptimalAudioConfig: jest.fn().mockReturnValue({}),
  monitorAudioQuality: jest.fn(),
}));

jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => callback()),
  },
}));

jest.mock("../../../assets/audio/music.wav", () => 1);

const mockPlayer = {
  volume: 1.0,
  playing: false,
  paused: true,
  isLoaded: true,
  play: jest.fn(),
  pause: jest.fn(),
  release: jest.fn(),
};

describe("SoundManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (audioOptimization.createHighQualitySound as jest.Mock).mockResolvedValue({
      sound: mockPlayer,
    });
  });

  describe("init", () => {
    it("should initialize with audio mode configuration", async () => {
      await SoundManager.init();

      expect(
        audioOptimization.configureHighQualityAudioSession
      ).toHaveBeenCalled();
    });

    it("should create a single sound instance", async () => {
      await SoundManager.init();

      expect(audioOptimization.createHighQualitySound).toHaveBeenCalledTimes(1);
      expect(audioOptimization.monitorAudioQuality).toHaveBeenCalledTimes(1);
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
        "Error loading music system:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getCurrentMusicMode", () => {
    it("should return neutral", async () => {
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
    it("should call release on the sound instance", async () => {
      await SoundManager.init();
      await SoundManager.unload();

      expect(mockPlayer.release).toHaveBeenCalledTimes(1);
    });

    it("should handle unload errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await SoundManager.init();
      mockPlayer.release.mockRejectedValueOnce(new Error("Release error"));

      await SoundManager.unload();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error unloading music:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
