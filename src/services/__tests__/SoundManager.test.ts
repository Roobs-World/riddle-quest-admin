import { AVPlaybackStatus } from "expo-av";

// Define a type for the mock sound instances with only the mocked members used by SoundManager
interface MockSoundInstance {
  loadAsync: jest.Mock;
  playAsync: jest.Mock;
  replayAsync: jest.Mock;
  getStatusAsync: jest.Mock<Promise<AVPlaybackStatus>>;
  pauseAsync: jest.Mock;
  unloadAsync: jest.Mock;
  // StopAsync is not used in SoundManager, removed
  // setOnPlaybackStatusUpdate is not used in SoundManager, removed
  // setVolumeAsync is not used in SoundManager, removed
  // setIsLoopingAsync is not used in SoundManager, removed

  // Add minimal properties required to satisfy the tests or avoid type errors
  _loaded?: boolean; // Mark as optional if not always used
  _loading?: boolean; // Mark as optional
  _key?: number | string; // Mark as optional
  _lastStatusUpdate?: AVPlaybackStatus | null; // Mark as optional
  _lastStatusUpdateTime?: number | null; // Mark as optional
  _subscriptions?: unknown[]; // Use unknown[] instead of any[]
  _eventEmitter?: { addListener: jest.Mock; removeListener: jest.Mock }; // More specific type
  _coalesceStatusUpdatesInMillis?: number; // Mark as optional
  _onPlaybackStatusUpdate?: ((status: AVPlaybackStatus) => void) | null; // Mark as optional
}

// File-level mock for expo-av
const mockSoundInstances: MockSoundInstance[] = [];
const MockAudioSound = jest.fn().mockImplementation(() => {
  const instance: MockSoundInstance = {
    loadAsync: jest.fn().mockResolvedValue(undefined),
    playAsync: jest.fn().mockResolvedValue(undefined),
    replayAsync: jest.fn().mockResolvedValue(undefined),
    getStatusAsync: jest.fn().mockResolvedValue({
      isLoaded: true,
      isPlaying: false,
      durationMillis: 1000,
      positionMillis: 0,
      didJustFinish: false,
      isLooping: false,
      shouldPlay: false,
      progressUpdateIntervalMillis: 500,
      uri: "test-uri", // Add required properties for AVPlaybackStatus
      // Add other required properties of AVPlaybackStatus if any are used in tests
    } as AVPlaybackStatus), // Explicitly cast to AVPlaybackStatus
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
    // StopAsync, setOnPlaybackStatusUpdate, setVolumeAsync, setIsLoopingAsync mocks removed

    // Include optional properties with mock values or as undefined
    _loaded: false,
    _loading: false,
    _key: Math.random(),
    _lastStatusUpdate: null,
    _lastStatusUpdateTime: null,
    _subscriptions: [],
    _eventEmitter: { addListener: jest.fn(), removeListener: jest.fn() },
    _coalesceStatusUpdatesInMillis: 0,
    _onPlaybackStatusUpdate: null,
  };
  mockSoundInstances.push(instance);
  return instance;
});

jest.mock("expo-av", () => ({
  Audio: {
    Sound: MockAudioSound,
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    InterruptionModeIOS: {},
    InterruptionModeAndroid: {},
    PitchCorrectionQuality: {},
  },
}));

// Helper to get the last created sound instance, useful for simple cases
// where sounds are created sequentially in SoundManager
// const getLastMockSoundInstance = () =>
//   mockSoundInstances[mockSoundInstances.length - 1]; // Removed unused function

import { SoundManager as ActualSoundManager } from "../SoundManager"; // Import the actual SoundManager

describe("SoundManager", () => {
  let SoundManager: typeof ActualSoundManager; // Use the actual type

  // General beforeEach for resetting console spy and clearing general mock states
  beforeEach(() => {
    // Clear general mock state that might persist if not handled by specific test setups
    MockAudioSound.mockClear();
    mockSoundInstances.length = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
    SoundManager = ActualSoundManager; // Assign the actual SoundManager before each test
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    jest.resetModules(); // Reset modules after each test to ensure a clean slate for the next
  });

  // Test to ensure module loading works as expected with the default mock
  it("should create 3 sound instances when SoundManager module is loaded", () => {
    // SoundManager is assigned in beforeEach, no need for require here
    expect(MockAudioSound).toHaveBeenCalledTimes(3); // Mocks are created when the module is first evaluated/imported
    expect(mockSoundInstances.length).toBe(3);
  });

  describe("init", () => {
    beforeEach(() => {
      // Default mock behavior for Audio.Sound for most init tests
      // (cleared by general beforeEach, specific implementations will be set by tests if needed)
      // SoundManager is assigned in the outer beforeEach
    });

    it("should create 3 sound instances, load all, and play neutral sound", async () => {
      // SoundManager is assigned in beforeEach
      await SoundManager.init();
      // MockAudioSound already called 3 times during import/evaluation
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
      // Setup specific mock behavior *before* SoundManager is accessed in init
      MockAudioSound.mockImplementationOnce(() => {
        // For neutralSound
        const instance: MockSoundInstance = {
          loadAsync: jest.fn().mockRejectedValueOnce(new Error("Load failed")),
          playAsync: jest.fn(),
          replayAsync: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({} as AVPlaybackStatus), // Mock minimal status
          pauseAsync: jest.fn(),
          unloadAsync: jest.fn(),
        };
        mockSoundInstances.push(instance);
        return instance;
      })
        .mockImplementationOnce(() => {
          // For successSound (to allow init to continue)
          const instance: MockSoundInstance = {
            loadAsync: jest.fn().mockResolvedValue(undefined),
            playAsync: jest.fn(),
            replayAsync: jest.fn(),
            getStatusAsync: jest.fn().mockResolvedValue({} as AVPlaybackStatus), // Mock minimal status
            pauseAsync: jest.fn(),
            unloadAsync: jest.fn(),
          };
          mockSoundInstances.push(instance);
          return instance;
        })
        .mockImplementationOnce(() => {
          // For negativeSound
          const instance: MockSoundInstance = {
            loadAsync: jest.fn().mockResolvedValue(undefined),
            playAsync: jest.fn(),
            replayAsync: jest.fn(),
            getStatusAsync: jest.fn().mockResolvedValue({} as AVPlaybackStatus), // Mock minimal status
            pauseAsync: jest.fn(),
            unloadAsync: jest.fn(),
          };
          mockSoundInstances.push(instance);
          return instance;
        });

      // SoundManager is assigned in the outer beforeEach
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
      SoundManager = ActualSoundManager; // Assign the actual SoundManager
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
      SoundManager = ActualSoundManager; // Assign the actual SoundManager
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
      SoundManager = ActualSoundManager; // Assign the actual SoundManager
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
      } as AVPlaybackStatus); // Use AVPlaybackStatus
      await SoundManager.playBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].playAsync).toHaveBeenCalledTimes(1);
    });

    it("should not play background music if already playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: true,
      } as AVPlaybackStatus); // Use AVPlaybackStatus
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
      SoundManager = ActualSoundManager; // Assign the actual SoundManager
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
      } as AVPlaybackStatus); // Use AVPlaybackStatus
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

  // Corrected test description and method call to match actual SoundManager.unload
  describe("unload", () => {
    beforeEach(async () => {
      SoundManager = ActualSoundManager; // Assign the actual SoundManager
      await SoundManager.init();
      if (mockSoundInstances[0]) mockSoundInstances[0].unloadAsync.mockClear();
      if (mockSoundInstances[1]) mockSoundInstances[1].unloadAsync.mockClear();
      if (mockSoundInstances[2]) mockSoundInstances[2].unloadAsync.mockClear();
    });

    it("should unload all sounds", async () => {
      await SoundManager.unload(); // Corrected method call
      expect(mockSoundInstances[0].unloadAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[1].unloadAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[2].unloadAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if unloading sounds fails", async () => {
      mockSoundInstances[0].unloadAsync.mockRejectedValueOnce(
        new Error("Unload failed")
      );
      await SoundManager.unload(); // Corrected method call
      expect(console.error).toHaveBeenCalledWith(
        "Error unloading sounds:",
        expect.any(Error)
      );
    });
  });
});
