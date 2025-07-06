import { Audio, AVPlaybackSource } from "expo-av";
import { AppState, AppStateStatus, InteractionManager } from "react-native";
import {
  configureHighQualityAudioSession,
  createHighQualitySound,
  getOptimalAudioConfig,
  monitorAudioQuality,
} from "../utils/audioOptimization";

import neutralWav from "../../assets/audio/Neutral.wav";
import positiveWav from "../../assets/audio/Success.wav"; // Repurposed as positive music
import negativeWav from "../../assets/audio/Negative.wav"; // Repurposed as negative music

// Music mode definitions
type MusicMode = "neutral" | "positive" | "negative";

// Music instances (separate from sound effects)
let neutralMusic: Audio.Sound | null = null;
let positiveMusic: Audio.Sound | null = null;
let negativeMusic: Audio.Sound | null = null;

// Current music state
let currentMusicMode: MusicMode = "neutral";
let isChangingMode = false; // Prevents multiple mode changes at once

// Track initialization state
let isInitialized = false;

// Global sound enabled state
let globalSoundEnabled = true;

// Track app state to prevent audio focus exceptions when in background
let appState: AppStateStatus = AppState.currentState;
let appStateSubscription: { remove: () => void } | null = null;

// Fading configuration
interface FadeOptions {
  duration?: number; // Fade duration in milliseconds (default: 1000ms)
  curve?: "linear" | "exponential"; // Fade curve type (default: linear)
  steps?: number; // Number of steps for smooth transition (default: 20)
}

// Default fade options
const DEFAULT_FADE_OPTIONS: Required<FadeOptions> = {
  duration: 1000,
  curve: "linear",
  steps: 20,
};

// Music mode transition options
const DEFAULT_MUSIC_TRANSITION_OPTIONS: Required<FadeOptions> = {
  duration: 2000, // 2 seconds for smooth music transitions
  curve: "exponential",
  steps: 40, // More steps for smoother music transitions
};

// Track active fade operations to prevent conflicts
const activeFades = new Set<Audio.Sound>();

// Helper function to calculate fade value based on curve type
const calculateFadeValue = (
  progress: number,
  curve: "linear" | "exponential"
): number => {
  if (curve === "exponential") {
    // Exponential curve for more natural audio transitions
    return Math.pow(progress, 2);
  }
  return progress; // Linear
};

// Helper function to get music instance by mode
const getMusicByMode = (mode: MusicMode): Audio.Sound | null => {
  switch (mode) {
    case "neutral":
      return neutralMusic;
    case "positive":
      return positiveMusic;
    case "negative":
      return negativeMusic;
    default:
      return null;
  }
};

// Helper function to pause all music except the specified one
const pauseAllMusicExcept = async (
  exceptMusic: Audio.Sound | null
): Promise<void> => {
  const allMusic = [neutralMusic, positiveMusic, negativeMusic];

  for (const music of allMusic) {
    if (music && music !== exceptMusic) {
      try {
        const status = await runAudioOperation(() => music.getStatusAsync());
        if (status.isLoaded && status.isPlaying) {
          await runAudioOperation(() =>
            music.setStatusAsync({ shouldPlay: false })
          );
        }
      } catch (error) {
        console.error("Error pausing music:", error);
      }
    }
  }
};

// Helper function to pause all music (for emergency stops)
const pauseAllMusic = async (): Promise<void> => {
  const allMusic = [neutralMusic, positiveMusic, negativeMusic];

  for (const music of allMusic) {
    if (music) {
      try {
        const status = await runAudioOperation(() => music.getStatusAsync());
        if (status.isLoaded && status.isPlaying) {
          await runAudioOperation(() =>
            music.setStatusAsync({ shouldPlay: false })
          );
        }
      } catch (error) {
        console.error("Error pausing music:", error);
      }
    }
  }
};

// Enhanced audio quality configuration
const HIGH_QUALITY_AUDIO_CONFIG = {
  // High-fidelity audio mode optimized for music playback
  allowsRecordingIOS: false,
  staysActiveInBackground: false,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: false,
  // Use speakers for better quality
  playThroughEarpieceAndroid: false,
  // Additional quality enhancements
  interruptionModeIOS: 1, // Do not mix with other apps
  interruptionModeAndroid: 1, // Do not mix with other apps
};

// Assume isSoundEnabled state is managed elsewhere (e.g., in App.tsx or Context)
// and can be accessed or passed here if needed for conditional playback.
// For now, we will assume the check is done at the call site.

// Thread-safe audio operation helper
const runAudioOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
};

// Thread-safe delay helper - avoid setTimeout to prevent Reanimated worklet conflicts
const safeDelay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const checkElapsed = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= ms) {
        resolve();
      } else {
        requestAnimationFrame(checkElapsed);
      }
    };
    requestAnimationFrame(checkElapsed);
  });
};

export const SoundManager = {
  /**
   * Enable or disable sound globally
   */
  setSoundEnabled: (enabled: boolean) => {
    globalSoundEnabled = enabled;
    console.log(
      `SoundManager: Sound globally ${enabled ? "enabled" : "disabled"}`
    );

    if (!enabled) {
      // Immediately pause all music when sound is disabled
      SoundManager.pauseAllMusic();
    }
  },

  /**
   * Get the current global sound enabled state
   */
  getSoundEnabled: (): boolean => {
    return globalSoundEnabled;
  },

  init: async () => {
    try {
      console.log(
        "SoundManager: Starting high-fidelity music system initialization..."
      );

      // Set up AppState listener to track background/foreground state
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        console.log(
          "SoundManager: App state changed from",
          appState,
          "to",
          nextAppState
        );
        appState = nextAppState;

        // Pause current music when app goes to background
        if (nextAppState === "background" || nextAppState === "inactive") {
          SoundManager.pauseCurrentMusic();
        } else if (nextAppState === "active" && isInitialized) {
          // Resume music when app becomes active again
          SoundManager.resumeCurrentMusic();
        }
      };

      appStateSubscription = AppState.addEventListener(
        "change",
        handleAppStateChange
      );

      // Set up high-fidelity audio mode with optimal configuration
      console.log("SoundManager: Setting high-quality audio mode...");
      await configureHighQualityAudioSession();
      await Audio.setAudioModeAsync(HIGH_QUALITY_AUDIO_CONFIG);
      console.log("SoundManager: High-quality audio mode set successfully");

      // Create music instances for all 3 modes with enhanced quality
      console.log("SoundManager: Creating high-fidelity music instances...");

      // Create neutral music (default background music)
      console.log("SoundManager: Loading neutral music with high quality...");
      const neutralResult = await createHighQualitySound(
        neutralWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: false,
        }
      );

      if (!neutralResult.sound) {
        console.error(
          "SoundManager: Failed to create neutral music sound object"
        );
        throw new Error("Failed to create neutral music sound object");
      }

      neutralMusic = neutralResult.sound;
      monitorAudioQuality(neutralMusic);
      console.log("SoundManager: Neutral music loaded with high quality");

      // Create positive music (for correct answers)
      console.log("SoundManager: Loading positive music with high quality...");
      const { sound: positiveMusicInstance } = await createHighQualitySound(
        positiveWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          volume: 0, // Start at 0 volume since it's not the default mode
          rate: 1.0,
          shouldCorrectPitch: false,
        }
      );
      positiveMusic = positiveMusicInstance;
      monitorAudioQuality(positiveMusic);
      console.log("SoundManager: Positive music loaded with high quality");

      // Create negative music (for wrong answers)
      console.log("SoundManager: Loading negative music with high quality...");
      const { sound: negativeMusicInstance } = await createHighQualitySound(
        negativeWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          volume: 0, // Start at 0 volume since it's not the default mode
          rate: 1.0,
          shouldCorrectPitch: false,
        }
      );
      negativeMusic = negativeMusicInstance;
      monitorAudioQuality(negativeMusic);
      console.log("SoundManager: Negative music loaded with high quality");

      // Log optimal audio configuration for monitoring
      const optimalConfig = getOptimalAudioConfig();
      console.log(
        "SoundManager: Using optimal audio configuration:",
        optimalConfig
      );

      console.log("SoundManager: All music modes loaded with enhanced quality");

      // Start with neutral music mode directly
      if (neutralMusic) {
        try {
          // Use setStatusAsync instead of individual method calls
          await runAudioOperation(() =>
            neutralMusic!.setStatusAsync({
              shouldPlay: true,
              volume: 1.0,
            })
          );
          currentMusicMode = "neutral"; // Explicitly set current mode
          console.log(
            "SoundManager: Neutral music started directly during init."
          );
        } catch (e) {
          console.error(
            "SoundManager: Failed to start neutral music directly in init",
            e
          );
          // Fallback or further error handling might be needed here
        }
      } else {
        console.error(
          "SoundManager: neutralMusic instance is null, cannot start directly in init."
        );
      }

      isInitialized = true;
      console.log(
        "SoundManager: High-fidelity music system initialization completed"
      );
    } catch (error) {
      console.error("Error loading high-fidelity music system:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        neutralMusicState: neutralMusic ? "created" : "null",
        positiveMusicState: positiveMusic ? "created" : "null",
        negativeMusicState: negativeMusic ? "created" : "null",
      });

      // Clean up any partially created sounds
      await SoundManager.unload();
      isInitialized = false;
    }
  },

  /**
   * Set the music mode with crossfading
   */
  setMusicMode: async (
    mode: MusicMode,
    options: FadeOptions = {}
  ): Promise<void> => {
    try {
      if (!isInitialized) {
        console.warn("SoundManager: Not initialized, cannot set music mode");
        return;
      }

      if (!globalSoundEnabled) {
        console.log("SoundManager: Sound disabled, skipping music mode change");
        return;
      }

      if (appState !== "active") {
        console.log("SoundManager: App not active, skipping music mode change");
        return;
      }

      if (isChangingMode) {
        console.log("SoundManager: Already changing music mode, skipping");
        return;
      }

      if (currentMusicMode === mode) {
        console.log(`SoundManager: Already in ${mode} mode`);
        return;
      }

      isChangingMode = true;
      const config = { ...DEFAULT_MUSIC_TRANSITION_OPTIONS, ...options };

      console.log(
        `SoundManager: Transitioning from ${currentMusicMode} to ${mode} mode`
      );

      const currentMusic = getMusicByMode(currentMusicMode);
      const newMusic = getMusicByMode(mode);

      if (!newMusic) {
        console.warn(`SoundManager: Music for mode ${mode} not available`);
        isChangingMode = false;
        return;
      }

      // CRITICAL FIX: Immediately pause all other music to ensure only one plays at a time
      await pauseAllMusicExcept(newMusic);

      // Start the new music at volume 0 and begin playing
      await runAudioOperation(() =>
        newMusic.setStatusAsync({ volume: 0, shouldPlay: true })
      );

      if (currentMusic && config.duration > 0) {
        // Crossfade between current and new music
        // Note: currentMusic should already be paused by pauseAllMusicExcept, but restart it for crossfade
        const currentStatus = await runAudioOperation(() =>
          currentMusic.getStatusAsync()
        );
        if (currentStatus.isLoaded && !currentStatus.isPlaying) {
          await runAudioOperation(() =>
            currentMusic.setStatusAsync({ shouldPlay: true })
          );
        }
        await SoundManager.crossfade(currentMusic, newMusic, config);
      } else {
        // No crossfade, just start new music immediately at full volume
        await runAudioOperation(() => newMusic.setStatusAsync({ volume: 1.0 }));
        // currentMusic is already paused by pauseAllMusicExcept
      }

      currentMusicMode = mode;
      isChangingMode = false;

      console.log(`SoundManager: Successfully transitioned to ${mode} mode`);
    } catch (error) {
      console.error("Error setting music mode:", error);
      isChangingMode = false;
    }
  },

  /**
   * Get the current music mode
   */
  getCurrentMusicMode: (): MusicMode => {
    return currentMusicMode;
  },

  /**
   * Pause the currently playing music
   */
  pauseCurrentMusic: async (): Promise<void> => {
    try {
      if (!isInitialized) {
        console.warn("SoundManager: Not initialized");
        return;
      }

      // Pause all music to be extra safe
      await pauseAllMusic();
      console.log(
        `SoundManager: Paused all music (was in ${currentMusicMode} mode)`
      );
    } catch (error) {
      console.error("Error pausing current music:", error);
    }
  },

  /**
   * Resume the current music mode
   */
  resumeCurrentMusic: async (): Promise<void> => {
    try {
      if (!isInitialized || appState !== "active") {
        return;
      }

      if (!globalSoundEnabled) {
        console.log("SoundManager: Sound disabled, skipping music resume");
        return;
      }

      const currentMusic = getMusicByMode(currentMusicMode);
      if (currentMusic) {
        const status = await runAudioOperation(() =>
          currentMusic.getStatusAsync()
        );
        if (status.isLoaded && !status.isPlaying) {
          await runAudioOperation(() =>
            currentMusic.setStatusAsync({ shouldPlay: true })
          );
          console.log(
            `SoundManager: Resumed ${currentMusicMode} music in high quality`
          );
        }
      }
    } catch (error) {
      console.error("Error resuming music:", error);
    }
  },

  // Legacy methods for backward compatibility
  playBackgroundMusic: async () => {
    await SoundManager.resumeCurrentMusic();
  },

  pauseBackgroundMusic: async () => {
    await SoundManager.pauseCurrentMusic();
  },

  fadeInBackgroundMusic: async (options: FadeOptions = {}) => {
    if (!globalSoundEnabled) {
      console.log("SoundManager: Sound disabled, skipping fade-in");
      return;
    }

    const currentMusic = getMusicByMode(currentMusicMode);
    if (currentMusic) {
      await SoundManager.fadeIn(currentMusic, options);
    }
  },

  fadeOutBackgroundMusic: async (options: FadeOptions = {}) => {
    const currentMusic = getMusicByMode(currentMusicMode);
    if (currentMusic) {
      await SoundManager.fadeOut(currentMusic, options);
    }
  },

  /**
   * Play a sound effect - separate from music system
   * Note: Sound effects are now handled differently from music modes
   * These methods are maintained for backwards compatibility but may be deprecated
   */
  playSuccess: async () => {
    if (!globalSoundEnabled) {
      console.log("SoundManager: Sound disabled, skipping success sound");
      return;
    }

    // Transition to positive music mode for success
    await SoundManager.setMusicMode("positive", {
      duration: 1500,
      curve: "exponential",
    });

    // After a delay, return to neutral mode using safeDelay to avoid Reanimated conflicts
    safeDelay(3000).then(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    });
  },

  playNegative: async () => {
    if (!globalSoundEnabled) {
      console.log("SoundManager: Sound disabled, skipping negative sound");
      return;
    }

    // Transition to negative music mode for failure
    await SoundManager.setMusicMode("negative", {
      duration: 1000,
      curve: "exponential",
    });

    // After a delay, return to neutral mode using safeDelay to avoid Reanimated conflicts
    safeDelay(4000).then(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    });
  },

  /**
   * Play negative music with fade-in for wrong guesses
   */
  playNegativeWithFadeIn: async (options: FadeOptions = {}) => {
    if (!globalSoundEnabled) {
      console.log(
        "SoundManager: Sound disabled, skipping negative fade-in sound"
      );
      return;
    }

    const config = {
      duration: 1500,
      curve: "exponential" as const,
      ...options,
    };

    await SoundManager.setMusicMode("negative", config);

    // Return to neutral after a delay using safeDelay to avoid Reanimated conflicts
    safeDelay(4000).then(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    });
  },

  /**
   * Fade in a sound from volume 0 to 1
   */
  fadeIn: async (
    sound: Audio.Sound,
    options: FadeOptions = {}
  ): Promise<void> => {
    const config = { ...DEFAULT_FADE_OPTIONS, ...options };

    if (activeFades.has(sound)) {
      console.warn("SoundManager: Fade already in progress for this sound");
      return;
    }

    try {
      activeFades.add(sound);

      // Don't attempt to fade when app is in background
      if (appState !== "active") {
        console.log("SoundManager: Skipping fade in - app not in foreground");
        return;
      }

      const status = await runAudioOperation(() => sound.getStatusAsync());
      if (!status.isLoaded) {
        console.warn("SoundManager: Sound not loaded for fade in");
        return;
      }

      // Start playing at volume 0 if not already playing
      if (!status.isPlaying) {
        await runAudioOperation(() =>
          sound.setStatusAsync({ volume: 0, shouldPlay: true })
        );
      }

      const stepDuration = config.duration / config.steps;

      for (let i = 0; i <= config.steps; i++) {
        if (!activeFades.has(sound)) break; // Fade was cancelled

        const progress = i / config.steps;
        const volume = calculateFadeValue(progress, config.curve);

        await runAudioOperation(() => sound.setStatusAsync({ volume }));

        if (i < config.steps) {
          await safeDelay(stepDuration);
        }
      }

      console.log(
        `SoundManager: Fade in completed (${config.duration}ms, ${config.curve})`
      );
    } catch (error) {
      console.error("Error during fade in:", error);
    } finally {
      activeFades.delete(sound);
    }
  },

  /**
   * Fade out a sound from current volume to 0
   */
  fadeOut: async (
    sound: Audio.Sound,
    options: FadeOptions = {}
  ): Promise<void> => {
    const config = { ...DEFAULT_FADE_OPTIONS, ...options };

    if (activeFades.has(sound)) {
      console.warn("SoundManager: Fade already in progress for this sound");
      return;
    }

    try {
      activeFades.add(sound);

      const status = await runAudioOperation(() => sound.getStatusAsync());
      if (!status.isLoaded || !status.isPlaying) {
        console.warn("SoundManager: Sound not playing for fade out");
        return;
      }

      const stepDuration = config.duration / config.steps;

      for (let i = config.steps; i >= 0; i--) {
        if (!activeFades.has(sound)) break; // Fade was cancelled

        const progress = i / config.steps;
        const volume = calculateFadeValue(progress, config.curve);

        await runAudioOperation(() => sound.setStatusAsync({ volume }));

        if (i > 0) {
          await safeDelay(stepDuration);
        }
      }

      // Pause the sound after fade out completes using setStatusAsync
      await runAudioOperation(() =>
        sound.setStatusAsync({ shouldPlay: false })
      );

      console.log(
        `SoundManager: Fade out completed (${config.duration}ms, ${config.curve})`
      );
    } catch (error) {
      console.error("Error during fade out:", error);
    } finally {
      activeFades.delete(sound);
    }
  },

  /**
   * Crossfade between two sounds
   */
  crossfade: async (
    fromSound: Audio.Sound,
    toSound: Audio.Sound,
    options: FadeOptions = {}
  ): Promise<void> => {
    const config = { ...DEFAULT_FADE_OPTIONS, ...options };

    if (activeFades.has(fromSound) || activeFades.has(toSound)) {
      console.warn(
        "SoundManager: Crossfade already in progress for one of the sounds"
      );
      return;
    }

    try {
      activeFades.add(fromSound);
      activeFades.add(toSound);

      // Don't attempt to crossfade when app is in background
      if (appState !== "active") {
        console.log("SoundManager: Skipping crossfade - app not in foreground");
        return;
      }

      // SAFETY: Pause all other music except the ones we're crossfading
      await pauseAllMusicExcept(fromSound);
      await pauseAllMusicExcept(toSound);

      // Start the new sound at volume 0
      const toStatus = await runAudioOperation(() => toSound.getStatusAsync());
      if (toStatus.isLoaded && !toStatus.isPlaying) {
        await runAudioOperation(() =>
          toSound.setStatusAsync({ volume: 0, shouldPlay: true })
        );
      }

      // Ensure fromSound is playing for the crossfade
      const fromStatus = await runAudioOperation(() =>
        fromSound.getStatusAsync()
      );
      if (fromStatus.isLoaded && !fromStatus.isPlaying) {
        await runAudioOperation(() =>
          fromSound.setStatusAsync({ shouldPlay: true })
        );
      }

      const stepDuration = config.duration / config.steps;

      for (let i = 0; i <= config.steps; i++) {
        if (!activeFades.has(fromSound) || !activeFades.has(toSound)) break;

        const progress = i / config.steps;
        const fadeOutVolume = calculateFadeValue(1 - progress, config.curve);
        const fadeInVolume = calculateFadeValue(progress, config.curve);

        await Promise.all([
          runAudioOperation(() =>
            fromSound.setStatusAsync({ volume: fadeOutVolume })
          ),
          runAudioOperation(() =>
            toSound.setStatusAsync({ volume: fadeInVolume })
          ),
        ]);

        if (i < config.steps) {
          await safeDelay(stepDuration);
        }
      }

      // Pause the old sound after crossfade completes and ensure no other music is playing
      await runAudioOperation(() =>
        fromSound.setStatusAsync({ shouldPlay: false })
      );
      await pauseAllMusicExcept(toSound);

      console.log(
        `SoundManager: Crossfade completed (${config.duration}ms, ${config.curve})`
      );
    } catch (error) {
      console.error("Error during crossfade:", error);
    } finally {
      activeFades.delete(fromSound);
      activeFades.delete(toSound);
    }
  },

  /**
   * Cancel any active fade operation for a specific sound
   */
  cancelFade: (sound: Audio.Sound): void => {
    activeFades.delete(sound);
    console.log("SoundManager: Fade operation cancelled");
  },

  unload: async () => {
    // NOTE: This method should only be used for cleanup during initialization failures.
    // During normal app operation, sounds should remain in memory for optimal performance.
    try {
      // Cancel any active fades before unloading
      activeFades.clear();

      // Remove AppState listener to prevent memory leaks
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }

      if (neutralMusic) {
        await neutralMusic.unloadAsync();
        neutralMusic = null;
      }
      if (positiveMusic) {
        await positiveMusic.unloadAsync();
        positiveMusic = null;
      }
      if (negativeMusic) {
        await negativeMusic.unloadAsync();
        negativeMusic = null;
      }
      isInitialized = false;
      currentMusicMode = "neutral";
      isChangingMode = false;
      console.log("SoundManager: All music unloaded successfully");
    } catch (error) {
      console.error("Error unloading music:", error);
    }
  },

  /**
   * Pause all music (emergency stop)
   */
  pauseAllMusic: async (): Promise<void> => {
    try {
      await pauseAllMusic();
      console.log("SoundManager: All music paused");
    } catch (error) {
      console.error("Error pausing all music:", error);
    }
  },
};
