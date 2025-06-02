import { Audio, AVPlaybackSource } from "expo-av";
import { AppState, AppStateStatus } from "react-native";

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

// Enhanced audio quality configuration
const HIGH_QUALITY_AUDIO_CONFIG = {
  // High-fidelity audio mode optimized for music playback
  allowsRecordingIOS: false,
  staysActiveInBackground: false,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: false,
  // Use speakers for better quality
  playThroughEarpieceAndroid: false,
};

// High-quality sound creation options
const HIGH_QUALITY_SOUND_OPTIONS = {
  // Disable pitch correction for better quality
  shouldCorrectPitch: false,
  // Maximum volume for best dynamic range
  volume: 1.0,
  // Standard playback rate
  rate: 1.0,
  // Use high-quality pitch correction when rate changes (if available)
  ...(Audio.PitchCorrectionQuality?.High && {
    pitchCorrectionQuality: Audio.PitchCorrectionQuality.High,
  }),
};

// Assume isSoundEnabled state is managed elsewhere (e.g., in App.tsx or Context)
// and can be accessed or passed here if needed for conditional playback.
// For now, we will assume the check is done at the call site.

export const SoundManager = {
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

      // Set up high-fidelity audio mode
      console.log("SoundManager: Setting high-quality audio mode...");
      await Audio.setAudioModeAsync(HIGH_QUALITY_AUDIO_CONFIG);
      console.log("SoundManager: High-quality audio mode set successfully");

      // Create music instances for all 3 modes with enhanced quality
      console.log("SoundManager: Creating high-fidelity music instances...");

      // Create neutral music (default background music)
      console.log("SoundManager: Loading neutral music with high quality...");
      const { sound: neutralMusicInstance } = await Audio.Sound.createAsync(
        neutralWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          ...HIGH_QUALITY_SOUND_OPTIONS,
        },
        (status) => {
          if (status.isLoaded && !status.didJustFinish) {
            console.log("SoundManager: Neutral music high-quality status:", {
              uri: status.uri,
              duration: status.durationMillis,
              shouldCorrectPitch: status.shouldCorrectPitch,
              volume: status.volume,
              rate: status.rate,
            });
          }
        }
      );
      neutralMusic = neutralMusicInstance;
      console.log("SoundManager: Neutral music loaded with high quality");

      // Create positive music (for correct answers)
      console.log("SoundManager: Loading positive music with high quality...");
      const { sound: positiveMusicInstance } = await Audio.Sound.createAsync(
        positiveWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          volume: 0, // Start at 0 volume since it's not the default mode
          // Use high-quality settings except for volume
          shouldCorrectPitch: HIGH_QUALITY_SOUND_OPTIONS.shouldCorrectPitch,
          rate: HIGH_QUALITY_SOUND_OPTIONS.rate,
          pitchCorrectionQuality:
            HIGH_QUALITY_SOUND_OPTIONS.pitchCorrectionQuality,
        }
      );
      positiveMusic = positiveMusicInstance;
      console.log("SoundManager: Positive music loaded with high quality");

      // Create negative music (for wrong answers)
      console.log("SoundManager: Loading negative music with high quality...");
      const { sound: negativeMusicInstance } = await Audio.Sound.createAsync(
        negativeWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          volume: 0, // Start at 0 volume since it's not the default mode
          // Use high-quality settings except for volume
          shouldCorrectPitch: HIGH_QUALITY_SOUND_OPTIONS.shouldCorrectPitch,
          rate: HIGH_QUALITY_SOUND_OPTIONS.rate,
          pitchCorrectionQuality:
            HIGH_QUALITY_SOUND_OPTIONS.pitchCorrectionQuality,
        }
      );
      negativeMusic = negativeMusicInstance;
      console.log("SoundManager: Negative music loaded with high quality");

      console.log("SoundManager: All music modes loaded with enhanced quality");

      // Start with neutral music mode
      await SoundManager.setMusicMode("neutral", { duration: 0 }); // No fade for initial start

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

      // Start the new music at volume 0 and begin playing
      await newMusic.setVolumeAsync(0);
      await newMusic.playAsync();

      if (currentMusic && config.duration > 0) {
        // Crossfade between current and new music
        await SoundManager.crossfade(currentMusic, newMusic, config);
      } else {
        // No crossfade, just start new music immediately
        await newMusic.setVolumeAsync(1.0);
        if (currentMusic) {
          await currentMusic.pauseAsync();
        }
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

      const currentMusic = getMusicByMode(currentMusicMode);
      if (currentMusic) {
        const status = await currentMusic.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentMusic.pauseAsync();
          console.log(`SoundManager: Paused ${currentMusicMode} music`);
        }
      }
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

      const currentMusic = getMusicByMode(currentMusicMode);
      if (currentMusic) {
        const status = await currentMusic.getStatusAsync();
        if (status.isLoaded && !status.isPlaying) {
          await currentMusic.playAsync();
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
    // Transition to positive music mode for success
    await SoundManager.setMusicMode("positive", {
      duration: 1500,
      curve: "exponential",
    });

    // After a delay, return to neutral mode
    setTimeout(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    }, 3000); // Stay in positive mode for 3 seconds
  },

  playNegative: async () => {
    // Transition to negative music mode for failure
    await SoundManager.setMusicMode("negative", {
      duration: 1000,
      curve: "exponential",
    });

    // After a delay, return to neutral mode
    setTimeout(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    }, 4000); // Stay in negative mode for 4 seconds
  },

  /**
   * Play negative music with fade-in for wrong guesses
   */
  playNegativeWithFadeIn: async (options: FadeOptions = {}) => {
    const config = {
      duration: 1500,
      curve: "exponential" as const,
      ...options,
    };

    await SoundManager.setMusicMode("negative", config);

    // Return to neutral after a delay
    setTimeout(async () => {
      await SoundManager.setMusicMode("neutral", {
        duration: 2000,
        curve: "exponential",
      });
    }, 4000);
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

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        console.warn("SoundManager: Sound not loaded for fade in");
        return;
      }

      // Start playing at volume 0 if not already playing
      if (!status.isPlaying) {
        await sound.setVolumeAsync(0);
        await sound.playAsync();
      }

      const stepDuration = config.duration / config.steps;

      for (let i = 0; i <= config.steps; i++) {
        if (!activeFades.has(sound)) break; // Fade was cancelled

        const progress = i / config.steps;
        const volume = calculateFadeValue(progress, config.curve);

        await sound.setVolumeAsync(volume);

        if (i < config.steps) {
          await new Promise((resolve) => setTimeout(resolve, stepDuration));
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

      const status = await sound.getStatusAsync();
      if (!status.isLoaded || !status.isPlaying) {
        console.warn("SoundManager: Sound not playing for fade out");
        return;
      }

      const stepDuration = config.duration / config.steps;

      for (let i = config.steps; i >= 0; i--) {
        if (!activeFades.has(sound)) break; // Fade was cancelled

        const progress = i / config.steps;
        const volume = calculateFadeValue(progress, config.curve);

        await sound.setVolumeAsync(volume);

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDuration));
        }
      }

      // Pause the sound after fade out completes
      await sound.pauseAsync();

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

      // Start the new sound at volume 0
      const toStatus = await toSound.getStatusAsync();
      if (toStatus.isLoaded && !toStatus.isPlaying) {
        await toSound.setVolumeAsync(0);
        await toSound.playAsync();
      }

      const stepDuration = config.duration / config.steps;

      for (let i = 0; i <= config.steps; i++) {
        if (!activeFades.has(fromSound) || !activeFades.has(toSound)) break;

        const progress = i / config.steps;
        const fadeOutVolume = calculateFadeValue(1 - progress, config.curve);
        const fadeInVolume = calculateFadeValue(progress, config.curve);

        await Promise.all([
          fromSound.setVolumeAsync(fadeOutVolume),
          toSound.setVolumeAsync(fadeInVolume),
        ]);

        if (i < config.steps) {
          await new Promise((resolve) => setTimeout(resolve, stepDuration));
        }
      }

      // Pause the old sound after crossfade completes
      await fromSound.pauseAsync();

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
};
