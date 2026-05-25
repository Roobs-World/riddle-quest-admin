import {AppState, AppStateStatus} from "react-native";
import {SoundManager} from "../SoundManager";
import * as audioOptimization from "../../utils/audioOptimization";

// Mock audioOptimization utilities
jest.mock("../../utils/audioOptimization", () => ({
  configureHighQualityAudioSession: jest.fn().mockResolvedValue(undefined),
  createHighQualitySound: jest.fn(),
  getOptimalAudioConfig: jest.fn().mockReturnValue({}),
  monitorAudioQuality: jest.fn(),
}));

// Mock logger and sentry
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Store the app state change handler for testing
let appStateChangeHandler: ((state: AppStateStatus) => void) | null = null;
const mockRemoveSubscription = jest.fn();

jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn((event: string, handler: (state: AppStateStatus) => void) => {
      appStateChangeHandler = handler;
      return {remove: mockRemoveSubscription};
    }),
  },
}));

jest.mock("../../../assets/audio/music.wav", () => 1);

// Helper to create a mock AudioPlayer
const createMockPlayer = (overrides: Partial<MockAudioPlayer> = {}): MockAudioPlayer => ({
  volume: 1.0,
  playing: false,
  paused: true,
  isLoaded: true,
  play: jest.fn(),
  pause: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

interface MockAudioPlayer {
  volume: number;
  playing: boolean;
  paused: boolean;
  isLoaded: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
}

describe("SoundManager", () => {
  let mockPlayer: MockAudioPlayer;
  let mockCreateHighQualitySound: jest.Mock;
  let mockConfigureSession: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPlayer = createMockPlayer();
    mockCreateHighQualitySound = audioOptimization.createHighQualitySound as jest.Mock;
    mockConfigureSession = audioOptimization.configureHighQualityAudioSession as jest.Mock;

    mockCreateHighQualitySound.mockResolvedValue({sound: mockPlayer});
    mockConfigureSession.mockResolvedValue(undefined);

    // Reset state
    appStateChangeHandler = null;
    mockRemoveSubscription.mockClear();

    // Reset app state mock to active
    (AppState as {currentState: AppStateStatus}).currentState = "active";

    // Clean up any previous state - must be done before each test
    await SoundManager.unload();

    // Re-enable sound for each test
    SoundManager.setSoundEnabled(true);
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  describe("setSoundEnabled / getSoundEnabled", () => {
    it("should enable sound globally", async () => {
      await SoundManager.init();

      SoundManager.setSoundEnabled(true);

      expect(SoundManager.getSoundEnabled()).toBe(true);
    });

    it("should disable sound globally", async () => {
      await SoundManager.init();

      SoundManager.setSoundEnabled(false);

      expect(SoundManager.getSoundEnabled()).toBe(false);
    });

    it("should pause all music when sound is disabled", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      SoundManager.setSoundEnabled(false);

      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it("should not pause music when sound is enabled", async () => {
      await SoundManager.init();
      jest.clearAllMocks();

      SoundManager.setSoundEnabled(true);

      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });
  });

  describe("init", () => {
    it("should configure high quality audio session", async () => {
      await SoundManager.init();

      expect(mockConfigureSession).toHaveBeenCalled();
    });

    it("should create sound instance with loop and volume options", async () => {
      await SoundManager.init();

      expect(mockCreateHighQualitySound).toHaveBeenCalledWith(expect.anything(), {loop: true, volume: 1.0});
    });

    it("should monitor audio quality", async () => {
      await SoundManager.init();

      expect(audioOptimization.monitorAudioQuality).toHaveBeenCalledWith(mockPlayer);
    });

    it("should register app state change listener", async () => {
      await SoundManager.init();

      expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("should handle initialization errors gracefully", async () => {
      mockCreateHighQualitySound.mockRejectedValueOnce(new Error("Audio creation failed"));

      await SoundManager.init();

      // Should not throw, error is handled internally
      expect(require("../../utils/sentry").captureException).toHaveBeenCalled();
    });

    it("should handle failed sound creation (null sound)", async () => {
      mockCreateHighQualitySound.mockResolvedValueOnce({sound: null});

      await SoundManager.init();

      expect(require("../../utils/sentry").captureException).toHaveBeenCalled();
    });

    it("should remove existing subscription on re-init", async () => {
      await SoundManager.init();
      jest.clearAllMocks();
      mockCreateHighQualitySound.mockResolvedValue({sound: mockPlayer});

      await SoundManager.init();

      expect(mockRemoveSubscription).toHaveBeenCalled();
    });
  });

  describe("getCurrentMusicMode", () => {
    it("should always return neutral", async () => {
      await SoundManager.init();

      expect(SoundManager.getCurrentMusicMode()).toBe("neutral");
    });
  });

  describe("setMusicMode", () => {
    it("should be a no-op function for API compatibility", async () => {
      await SoundManager.init();

      // Should not throw
      await expect(SoundManager.setMusicMode()).resolves.toBeUndefined();
    });
  });

  describe("pauseCurrentMusic", () => {
    it("should pause music when playing", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      await SoundManager.pauseCurrentMusic();

      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it("should not pause music when not playing", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;

      await SoundManager.pauseCurrentMusic();

      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });

    it("should not pause when not initialized", async () => {
      // Don't call init
      await SoundManager.pauseCurrentMusic();

      // Should not throw
      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;
      mockPlayer.pause.mockImplementationOnce(() => {
        throw new Error("Pause error");
      });

      await SoundManager.pauseCurrentMusic();

      expect(require("../../utils/sentry").captureException).toHaveBeenCalled();
    });
  });

  describe("resumeCurrentMusic", () => {
    it("should resume music when not playing and app is active", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      SoundManager.setSoundEnabled(true);

      await SoundManager.resumeCurrentMusic();

      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("should not resume music when already playing", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;
      SoundManager.setSoundEnabled(true);

      await SoundManager.resumeCurrentMusic();

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should not resume when sound is globally disabled", async () => {
      await SoundManager.init();
      SoundManager.setSoundEnabled(false);
      mockPlayer.playing = false;

      await SoundManager.resumeCurrentMusic();

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should not resume when not initialized", async () => {
      // Don't call init
      SoundManager.setSoundEnabled(true);

      await SoundManager.resumeCurrentMusic();

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should not resume when app is in background", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      SoundManager.setSoundEnabled(true);

      // Simulate app going to background
      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }

      jest.clearAllMocks();
      await SoundManager.resumeCurrentMusic();

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      SoundManager.setSoundEnabled(true);
      mockPlayer.play.mockImplementationOnce(() => {
        throw new Error("Play error");
      });

      await SoundManager.resumeCurrentMusic();

      expect(require("../../utils/sentry").captureException).toHaveBeenCalled();
    });
  });

  describe("playBackgroundMusic / pauseBackgroundMusic", () => {
    it("playBackgroundMusic should delegate to resumeCurrentMusic", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      SoundManager.setSoundEnabled(true);

      await SoundManager.playBackgroundMusic();

      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("pauseBackgroundMusic should delegate to pauseCurrentMusic", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      await SoundManager.pauseBackgroundMusic();

      expect(mockPlayer.pause).toHaveBeenCalled();
    });
  });

  describe("playSuccess", () => {
    it("should resume current music", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      SoundManager.setSoundEnabled(true);

      await SoundManager.playSuccess();

      expect(mockPlayer.play).toHaveBeenCalled();
    });
  });

  describe("playNegative", () => {
    it("should pause current music", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      await SoundManager.playNegative();

      expect(mockPlayer.pause).toHaveBeenCalled();
    });
  });

  describe("fadeIn", () => {
    it("should fade in sound with default options", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;

      const fadePromise = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      // Fast-forward through the fade
      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.play).toHaveBeenCalled();
      expect(mockPlayer.volume).toBe(1);
    });

    it("should start from volume 0 when not playing", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      mockPlayer.volume = 1;

      const fadePromise = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      // Check initial volume is set to 0
      expect(mockPlayer.volume).toBe(0);

      await jest.runAllTimersAsync();
      await fadePromise;
    });

    it("should not fade when sound is not loaded", async () => {
      await SoundManager.init();
      mockPlayer.isLoaded = false;

      await SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should not fade when already fading the same sound", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;

      // Start first fade
      const fade1 = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      // Try to start second fade on the same sound immediately
      const fade2 = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      await jest.runAllTimersAsync();
      await Promise.all([fade1, fade2]);

      // play should only be called once because second fade is ignored
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it("should not fade when app is not active", async () => {
      await SoundManager.init();

      // Simulate app going to background
      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }

      jest.clearAllMocks();
      await SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("should apply exponential curve when specified", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;

      const fadePromise = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer, {
        curve: "exponential",
        steps: 2,
        duration: 100,
      });

      await jest.runAllTimersAsync();
      await fadePromise;

      // With exponential curve, volume should reach 1 at the end
      expect(mockPlayer.volume).toBe(1);
    });

    it("should handle errors gracefully", async () => {
      await SoundManager.init();

      let volumeValue = 1;
      // Create a player that throws on volume set
      const errorPlayer = {
        ...mockPlayer,
        get volume() {
          return volumeValue;
        },
        set volume(v: number) {
          volumeValue = v;
          throw new Error("Volume error");
        },
        isLoaded: true,
        playing: false,
      };

      const fadePromise = SoundManager.fadeIn(errorPlayer as unknown as import("expo-audio").AudioPlayer);
      await jest.runAllTimersAsync();
      await expect(fadePromise).resolves.toBeUndefined();
    });
  });

  describe("fadeOut", () => {
    it("should fade out sound with default options", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;
      mockPlayer.volume = 1;

      const fadePromise = SoundManager.fadeOut(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.volume).toBe(0);
    });

    it("should not fade when sound is not loaded", async () => {
      await SoundManager.init();
      mockPlayer.isLoaded = false;

      await SoundManager.fadeOut(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });

    it("should not fade when already fading the same sound", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      const fade1 = SoundManager.fadeOut(mockPlayer as unknown as import("expo-audio").AudioPlayer);
      const fade2 = SoundManager.fadeOut(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      await jest.runAllTimersAsync();
      await Promise.all([fade1, fade2]);

      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });

    it("should use starting volume for fade calculation", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;
      mockPlayer.volume = 0.5;

      const fadePromise = SoundManager.fadeOut(mockPlayer as unknown as import("expo-audio").AudioPlayer, {
        steps: 2,
        duration: 100,
      });

      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.volume).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      await SoundManager.init();

      let volumeValue = 1;
      const errorPlayer = {
        ...mockPlayer,
        get volume() {
          return volumeValue;
        },
        set volume(v: number) {
          volumeValue = v;
          throw new Error("Volume error");
        },
        isLoaded: true,
        playing: true,
      };

      const fadePromise = SoundManager.fadeOut(errorPlayer as unknown as import("expo-audio").AudioPlayer);
      await jest.runAllTimersAsync();
      await expect(fadePromise).resolves.toBeUndefined();
    });
  });

  describe("fadeInBackgroundMusic / fadeOutBackgroundMusic", () => {
    it("fadeInBackgroundMusic should fade in music when sound enabled", async () => {
      await SoundManager.init();
      SoundManager.setSoundEnabled(true);
      mockPlayer.playing = false;

      const fadePromise = SoundManager.fadeInBackgroundMusic({duration: 100, steps: 2});

      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("fadeInBackgroundMusic should not fade when sound disabled", async () => {
      await SoundManager.init();
      SoundManager.setSoundEnabled(false);

      await SoundManager.fadeInBackgroundMusic();

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("fadeOutBackgroundMusic should fade out music", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      const fadePromise = SoundManager.fadeOutBackgroundMusic({duration: 100, steps: 2});

      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it("fadeOutBackgroundMusic should do nothing when no music", async () => {
      // Not initialized, no music player
      await SoundManager.fadeOutBackgroundMusic();

      // Should not throw
    });
  });

  describe("playNegativeWithFadeIn", () => {
    it("should fade out then fade in", async () => {
      await SoundManager.init();
      SoundManager.setSoundEnabled(true);
      mockPlayer.playing = true;
      mockPlayer.volume = 1;

      const promise = SoundManager.playNegativeWithFadeIn({duration: 100, steps: 2});

      await jest.runAllTimersAsync();
      await promise;

      // Existing behavior: if the player is still marked as playing after fade-out,
      // fade-in restores volume but does not need to call play().
      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.volume).toBe(1);
    });

    it("should do nothing when no music player", async () => {
      // Not initialized
      await SoundManager.playNegativeWithFadeIn();

      // Should not throw
    });
  });

  describe("crossfade", () => {
    it("should fade out from sound and fade in to sound simultaneously", async () => {
      await SoundManager.init();

      const fromPlayer = createMockPlayer({playing: true, volume: 1});
      const toPlayer = createMockPlayer({playing: false, volume: 0});

      const promise = SoundManager.crossfade(
        fromPlayer as unknown as import("expo-audio").AudioPlayer,
        toPlayer as unknown as import("expo-audio").AudioPlayer,
        {duration: 100, steps: 2},
      );

      await jest.runAllTimersAsync();
      await promise;

      expect(fromPlayer.pause).toHaveBeenCalled();
      expect(toPlayer.play).toHaveBeenCalled();
    });
  });

  describe("cancelFade", () => {
    it("should cancel an active fade", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;
      mockPlayer.volume = 0;

      // Start fade with many steps
      const fadePromise = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer, {
        duration: 1000,
        steps: 100,
      });

      // Advance a bit then cancel
      await jest.advanceTimersByTimeAsync(50);
      const volumeAtCancel = mockPlayer.volume;
      SoundManager.cancelFade(mockPlayer as unknown as import("expo-audio").AudioPlayer);

      // Continue timers
      await jest.runAllTimersAsync();
      await fadePromise;

      // Volume should be near where it was cancelled (or exactly, since loop breaks)
      expect(mockPlayer.volume).toBeLessThanOrEqual(volumeAtCancel + 0.02);
    });
  });

  describe("unload", () => {
    it("should release music player", async () => {
      await SoundManager.init();

      await SoundManager.unload();

      expect(mockPlayer.release).toHaveBeenCalled();
    });

    it("should remove app state subscription", async () => {
      await SoundManager.init();

      await SoundManager.unload();

      expect(mockRemoveSubscription).toHaveBeenCalled();
    });

    it("should clear active fades", async () => {
      await SoundManager.init();

      // Start a fade
      SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer, {duration: 1000});

      // Unload should clear fades
      await SoundManager.unload();

      // Further timer advances should not cause errors
      await jest.runAllTimersAsync();
    });

    it("should handle release errors gracefully", async () => {
      await SoundManager.init();
      mockPlayer.release.mockRejectedValueOnce(new Error("Release error"));

      await SoundManager.unload();

      expect(require("../../utils/sentry").captureException).toHaveBeenCalled();
    });

    it("should handle unload when not initialized", async () => {
      // Should not throw
      await SoundManager.unload();
    });
  });

  describe("pauseAllMusic", () => {
    it("should delegate to pauseCurrentMusic", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      await SoundManager.pauseAllMusic();

      expect(mockPlayer.pause).toHaveBeenCalled();
    });
  });

  describe("App state handling", () => {
    it("should pause music when app goes to background", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }

      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it("should pause music when app becomes inactive", async () => {
      await SoundManager.init();
      mockPlayer.playing = true;

      if (appStateChangeHandler) {
        appStateChangeHandler("inactive");
      }

      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it("should resume music when app becomes active after background", async () => {
      await SoundManager.init();
      SoundManager.setSoundEnabled(true);
      mockPlayer.playing = false;

      // First go to background
      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }
      jest.clearAllMocks();

      // Then back to active
      if (appStateChangeHandler) {
        appStateChangeHandler("active");
      }

      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("should not take action when state does not change", async () => {
      await SoundManager.init();
      jest.clearAllMocks();

      // State is already "active" (initial), calling again with same state
      // We need to first change state then call with same state
      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }
      jest.clearAllMocks();

      // Now call with same state (background)
      if (appStateChangeHandler) {
        appStateChangeHandler("background");
      }

      // Should not call play or pause again
      expect(mockPlayer.play).not.toHaveBeenCalled();
      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined volume gracefully in fadeOut", async () => {
      await SoundManager.init();

      const player = createMockPlayer({
        volume: undefined as unknown as number,
        isLoaded: true,
        playing: true,
      });

      const fadePromise = SoundManager.fadeOut(player as unknown as import("expo-audio").AudioPlayer, {
        steps: 2,
        duration: 100,
      });

      await jest.runAllTimersAsync();
      await fadePromise;

      // Should use 1 as default starting volume and fade to 0
      expect(player.pause).toHaveBeenCalled();
    });

    it("should handle custom fade duration and steps", async () => {
      await SoundManager.init();
      mockPlayer.playing = false;

      const fadePromise = SoundManager.fadeIn(mockPlayer as unknown as import("expo-audio").AudioPlayer, {
        duration: 500,
        steps: 5,
        curve: "linear",
      });

      await jest.runAllTimersAsync();
      await fadePromise;

      expect(mockPlayer.volume).toBe(1);
    });

    it("should handle fadeInBackgroundMusic with no music player", async () => {
      // Don't initialize - no music player
      SoundManager.setSoundEnabled(true);

      // Should not throw
      await SoundManager.fadeInBackgroundMusic();
    });
  });
});
