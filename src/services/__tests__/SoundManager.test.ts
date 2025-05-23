import { Audio } from "expo-av";

// File-level mock for expo-av
const mockSoundInstances: any[] = [];
const MockAudioSound = jest.fn().mockImplementation(() => {
  const instance = {
    loadAsync: jest.fn().mockResolvedValue(undefined),
    playAsync: jest.fn().mockResolvedValue(undefined),
    replayAsync: jest.fn().mockResolvedValue(undefined),
    getStatusAsync: jest.fn().mockResolvedValue({
      isLoaded: true, // Default to loaded for simplicity in many tests
      isPlaying: false,
      durationMillis: 1000, // Mock duration
      positionMillis: 0,
      didJustFinish: false,
      isLooping: false,
    }),
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    stopAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
    setOnPlaybackStatusUpdate: jest.fn(),
    setVolumeAsync: jest.fn().mockResolvedValue(undefined),
    setIsLoopingAsync: jest.fn().mockResolvedValue(undefined),
  };
  mockSoundInstances.push(instance);
  return instance;
});

jest.mock("expo-av", () => ({
  Audio: {
    Sound: MockAudioSound,
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    // Keep other Audio sub-module mocks minimal unless SoundManager uses them
    InterruptionModeIOS: {},
    InterruptionModeAndroid: {},
    PitchCorrectionQuality: {},
  },
}));

// Helper to get the last created sound instance, useful for simple cases
// where sounds are created sequentially in SoundManager
const getLastMockSoundInstance = () =>
  mockSoundInstances[mockSoundInstances.length - 1];

describe("SoundManager", () => {
  let SoundManager: any;

  // General beforeEach for resetting console spy and clearing general mock states
  beforeEach(() => {
    // Clear general mock state that might persist if not handled by specific test setups
    MockAudioSound.mockClear();
    mockSoundInstances.length = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    jest.resetModules(); // Reset modules after each test to ensure a clean slate for the next
  });

  // Test to ensure module loading works as expected with the default mock
  it("should create 3 sound instances when SoundManager module is loaded", () => {
    SoundManager = require("../SoundManager").SoundManager; // Load it here
    expect(MockAudioSound).toHaveBeenCalledTimes(3);
    expect(mockSoundInstances.length).toBe(3);
  });

  describe("init", () => {
    beforeEach(() => {
      // Default mock behavior for Audio.Sound for most init tests
      // (cleared by general beforeEach, specific implementations will be set by tests if needed)
      // SoundManager will be required by each test in this block that needs it fresh
    });

    it("should create 3 sound instances, load all, and play neutral sound", async () => {
      SoundManager = require("../SoundManager").SoundManager; // Load fresh
      await SoundManager.init();
      // MockAudioSound already called 3 times during require
      expect(mockSoundInstances.length).toBe(3);
      expect(mockSoundInstances[0].loadAsync).toHaveBeenCalledWith(
        "test-file-stub", // Comes from the fileMock.js via moduleNameMapper
        { isLooping: true }
      );
      expect(mockSoundInstances[1].loadAsync).toHaveBeenCalledWith(
        "test-file-stub"
      );
      expect(mockSoundInstances[2].loadAsync).toHaveBeenCalledWith(
        "test-file-stub"
      );
      expect(mockSoundInstances[0].playAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if loading sounds fails", async () => {
      // Setup specific mock behavior *before* SoundManager is required
      MockAudioSound.mockImplementationOnce(() => {
        // For neutralSound
        const instance = {
          loadAsync: jest.fn().mockRejectedValueOnce(new Error("Load failed")),
          playAsync: jest.fn(),
          остальные_методы_если_нужны: jest.fn(),
        };
        mockSoundInstances.push(instance);
        return instance;
      })
        .mockImplementationOnce(() => {
          // For successSound (to allow init to continue)
          const instance = {
            loadAsync: jest.fn().mockResolvedValue(undefined),
            playAsync: jest.fn(),
          };
          mockSoundInstances.push(instance);
          return instance;
        })
        .mockImplementationOnce(() => {
          // For negativeSound
          const instance = {
            loadAsync: jest.fn().mockResolvedValue(undefined),
            playAsync: jest.fn(),
          };
          mockSoundInstances.push(instance);
          return instance;
        });

      SoundManager = require("../SoundManager").SoundManager; // Load with the above behavior for the 3 instances

      await SoundManager.init();
      expect(console.error).toHaveBeenCalledWith(
        "Error loading sounds:",
        expect.any(Error)
      );
    });
  });

  describe("playSuccess", () => {
    beforeEach(async () => {
      // Ensure a fresh SoundManager with sounds loaded for these tests
      SoundManager = require("../SoundManager").SoundManager;
      await SoundManager.init();
      // Clear calls from init itself
      if (mockSoundInstances[1]) mockSoundInstances[1].replayAsync.mockClear();
    });

    it("should replay success sound", async () => {
      await SoundManager.playSuccess();
      expect(mockSoundInstances[1].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if playing success sound fails", async () => {
      mockSoundInstances[1].replayAsync.mockRejectedValueOnce(
        new Error("Play success failed")
      );
      await SoundManager.playSuccess();
      expect(console.error).toHaveBeenCalledWith(
        "Error playing success sound:",
        expect.any(Error)
      );
    });
  });

  describe("playNegative", () => {
    beforeEach(async () => {
      SoundManager = require("../SoundManager").SoundManager;
      await SoundManager.init();
      if (mockSoundInstances[2]) mockSoundInstances[2].replayAsync.mockClear();
    });

    it("should replay negative sound", async () => {
      await SoundManager.playNegative();
      expect(mockSoundInstances[2].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if playing negative sound fails", async () => {
      mockSoundInstances[2].replayAsync.mockRejectedValueOnce(
        new Error("Play negative failed")
      );
      await SoundManager.playNegative();
      expect(console.error).toHaveBeenCalledWith(
        "Error playing negative sound:",
        expect.any(Error)
      );
    });
  });

  describe("playBackgroundMusic", () => {
    beforeEach(async () => {
      SoundManager = require("../SoundManager").SoundManager;
      await SoundManager.init();
      // Clear specific mocks if init calls them
      if (mockSoundInstances[0]) {
        mockSoundInstances[0].getStatusAsync.mockClear();
        mockSoundInstances[0].playAsync.mockClear();
      }
    });

    it("should play background music if loaded and not playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: false,
      } as any);
      await SoundManager.playBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].playAsync).toHaveBeenCalledTimes(1);
    });

    it("should not play background music if already playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: true,
      } as any);
      await SoundManager.playBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].playAsync).not.toHaveBeenCalled();
    });

    it("should log error if getStatusAsync fails", async () => {
      mockSoundInstances[0].getStatusAsync.mockRejectedValueOnce(
        new Error("Get status failed")
      );
      await SoundManager.playBackgroundMusic();
      expect(console.error).toHaveBeenCalledWith(
        "Error playing background music:",
        expect.any(Error)
      );
    });
  });

  describe("pauseBackgroundMusic", () => {
    beforeEach(async () => {
      SoundManager = require("../SoundManager").SoundManager;
      await SoundManager.init();
      if (mockSoundInstances[0]) {
        mockSoundInstances[0].getStatusAsync.mockClear();
        mockSoundInstances[0].pauseAsync.mockClear();
      }
    });

    it("should pause background music if loaded and playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: true,
      } as any);
      await SoundManager.pauseBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].pauseAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if getStatusAsync fails for pause", async () => {
      mockSoundInstances[0].getStatusAsync.mockRejectedValueOnce(
        new Error("Get status failed")
      );
      await SoundManager.pauseBackgroundMusic();
      expect(console.error).toHaveBeenCalledWith(
        "Error pausing background music:",
        expect.any(Error)
      );
    });
  });

  describe("unload", () => {
    beforeEach(async () => {
      SoundManager = require("../SoundManager").SoundManager;
      // Don't init() here, as unload might be called on non-inited sounds
      // Or, if init is always expected before unload, then call it.
      // For now, assume unload can be called independently after module load.
    });

    it("should unload all sounds", async () => {
      // Ensure instances are created by requiring SoundManager, then clear unload calls
      SoundManager = require("../SoundManager").SoundManager; // Ensure it's loaded for this test
      mockSoundInstances.forEach((instance) =>
        instance.unloadAsync.mockClear()
      );

      await SoundManager.unload();
      expect(mockSoundInstances[0].unloadAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[1].unloadAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[2].unloadAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if unloading sounds fails", async () => {
      SoundManager = require("../SoundManager").SoundManager; // Ensure it's loaded
      mockSoundInstances[0].unloadAsync.mockRejectedValueOnce(
        new Error("Unload failed")
      );
      await SoundManager.unload();
      expect(console.error).toHaveBeenCalledWith(
        "Error unloading sounds:",
        expect.any(Error)
      );
    });
  });
});
