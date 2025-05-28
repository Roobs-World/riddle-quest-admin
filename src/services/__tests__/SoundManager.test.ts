import { AVPlaybackStatus, Audio } from "expo-av";

// Mock AppState
const mockAppStateSubscription = { remove: jest.fn() };
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn(() => mockAppStateSubscription),
  },
}));

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

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockImplementation(() => {
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
            uri: "test-uri",
          } as AVPlaybackStatus),
          pauseAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
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
        return Promise.resolve({ sound: instance });
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    InterruptionModeIOS: {},
    InterruptionModeAndroid: {},
    PitchCorrectionQuality: {},
  },
}));

// Mock the audio files
jest.mock("../../../assets/audio/Neutral.wav", () => "test-file-stub");
jest.mock("../../../assets/audio/Success.wav", () => "test-file-stub");
jest.mock("../../../assets/audio/Negative.wav", () => "test-file-stub");

import { SoundManager as ActualSoundManager } from "../SoundManager";

interface SoundManagerType {
  init: () => Promise<void>;
  playSuccess: () => Promise<void>;
  playNegative: () => Promise<void>;
  playBackgroundMusic: () => Promise<void>;
  pauseBackgroundMusic: () => Promise<void>;
  unload: () => Promise<void>;
}

describe("SoundManager", () => {
  let SoundManager: SoundManagerType;

  beforeEach(() => {
    // Clear mock calls and instances before each test
    jest.clearAllMocks();
    mockSoundInstances.length = 0; // Clear the instances array
    console.error = jest.fn(); // Mock console.error to avoid noise in tests
    console.warn = jest.fn(); // Mock console.warn to avoid noise in tests

    // Assign SoundManager for each test
    SoundManager = ActualSoundManager;
  });

  describe("init", () => {
    it("should set audio mode, create 3 sound instances, and play neutral sound", async () => {
      await SoundManager.init();

      // Verify audio mode was set
      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      // Audio.Sound.createAsync should be called 3 times during init
      expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(3);
      expect(mockSoundInstances.length).toBe(3);

      // Check the createAsync calls were made with correct parameters
      expect(Audio.Sound.createAsync).toHaveBeenNthCalledWith(
        1,
        "test-file-stub",
        {
          isLooping: true,
          shouldPlay: false,
        }
      );
      expect(Audio.Sound.createAsync).toHaveBeenNthCalledWith(
        2,
        "test-file-stub",
        {
          shouldPlay: false,
        }
      );
      expect(Audio.Sound.createAsync).toHaveBeenNthCalledWith(
        3,
        "test-file-stub",
        {
          shouldPlay: false,
        }
      );

      // Verify neutral sound starts playing
      expect(mockSoundInstances[0].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should log error if setting audio mode fails", async () => {
      // Setup specific mock behavior for setAudioModeAsync to fail
      (Audio.setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error("Audio mode failed")
      );

      await SoundManager.init();
      expect(console.error).toHaveBeenCalledWith(
        "Error loading sounds:",
        expect.any(Error)
      );
    });

    it("should log error if creating sounds fails", async () => {
      // Setup specific mock behavior for createAsync to fail
      (Audio.Sound.createAsync as jest.Mock).mockRejectedValueOnce(
        new Error("Create sound failed")
      );

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
      await SoundManager.init();
      // Clear calls from init itself
      if (mockSoundInstances[1]) mockSoundInstances[1].replayAsync.mockClear();
    });

    it("should replay success sound", async () => {
      await SoundManager.playSuccess();
      expect(mockSoundInstances[1].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should warn if success sound not initialized", async () => {
      // Don't call init, so sounds are not initialized
      // SoundManager is already assigned in main beforeEach
      await SoundManager.playSuccess();
      expect(console.warn).toHaveBeenCalledWith(
        "Success sound not initialized"
      );
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
      await SoundManager.init();
      if (mockSoundInstances[2]) mockSoundInstances[2].replayAsync.mockClear();
    });

    it("should replay negative sound", async () => {
      await SoundManager.playNegative();
      expect(mockSoundInstances[2].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should warn if negative sound not initialized", async () => {
      // Don't call init, so sounds are not initialized
      // SoundManager is already assigned in main beforeEach
      await SoundManager.playNegative();
      expect(console.warn).toHaveBeenCalledWith(
        "Negative sound not initialized"
      );
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
      await SoundManager.init();
      // Clear specific mocks if init calls them
      if (mockSoundInstances[0]) {
        mockSoundInstances[0].getStatusAsync.mockClear();
        mockSoundInstances[0].replayAsync.mockClear();
      }
    });

    it("should play background music if loaded and not playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: false,
      } as AVPlaybackStatus); // Use AVPlaybackStatus
      await SoundManager.playBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].replayAsync).toHaveBeenCalledTimes(1);
    });

    it("should not play background music if already playing", async () => {
      mockSoundInstances[0].getStatusAsync.mockResolvedValueOnce({
        isLoaded: true,
        isPlaying: true,
      } as AVPlaybackStatus); // Use AVPlaybackStatus
      await SoundManager.playBackgroundMusic();
      expect(mockSoundInstances[0].getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockSoundInstances[0].replayAsync).not.toHaveBeenCalled();
    });

    it("should warn if neutral sound not initialized", async () => {
      // Don't call init, so sounds are not initialized
      // SoundManager is already assigned in main beforeEach
      await SoundManager.playBackgroundMusic();
      expect(console.warn).toHaveBeenCalledWith(
        "Neutral sound not initialized"
      );
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

    it("should warn if neutral sound not initialized for pause", async () => {
      // Don't call init, so sounds are not initialized
      // SoundManager is already assigned in main beforeEach
      await SoundManager.pauseBackgroundMusic();
      expect(console.warn).toHaveBeenCalledWith(
        "Neutral sound not initialized"
      );
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
