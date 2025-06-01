import { Audio, AVPlaybackSource } from "expo-av";
import { AppState, AppStateStatus } from "react-native";

import neutralWav from "../../assets/audio/Neutral.wav";
import successWav from "../../assets/audio/Success.wav";
import negativeWav from "../../assets/audio/Negative.wav";

// Sound instances will be created after audio setup
let neutralSound: Audio.Sound | null = null;
let successSound: Audio.Sound | null = null;
let negativeSound: Audio.Sound | null = null;

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

// Assume isSoundEnabled state is managed elsewhere (e.g., in App.tsx or Context)
// and can be accessed or passed here if needed for conditional playback.
// For now, we will assume the check is done at the call site.

export const SoundManager = {
  init: async () => {
    try {
      console.log("SoundManager: Starting initialization...");

      // Set up AppState listener to track background/foreground state
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        console.log(
          "SoundManager: App state changed from",
          appState,
          "to",
          nextAppState
        );
        appState = nextAppState;

        // Pause background music when app goes to background to prevent audio focus issues
        if (nextAppState === "background" || nextAppState === "inactive") {
          SoundManager.pauseBackgroundMusic();
        }
      };

      appStateSubscription = AppState.addEventListener(
        "change",
        handleAppStateChange
      );

      // Set up audio mode optimized for high-quality playback
      console.log("SoundManager: Setting optimized audio mode...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false, // Disable ducking for full volume playback
      });
      console.log("SoundManager: Optimized audio mode set successfully");

      // Create sound instances using createAsync with high-quality settings
      console.log("SoundManager: Creating high-quality sound instances...");

      // Create neutral sound (background music) with high-quality settings
      console.log("SoundManager: Loading neutral sound with high quality...");
      console.log("Neutral wav source:", neutralWav);

      const { sound: neutralSoundInstance } = await Audio.Sound.createAsync(
        neutralWav as AVPlaybackSource,
        {
          isLooping: true,
          shouldPlay: false,
          // High-quality playback settings
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: false, // Disable pitch correction for better quality
        },
        // Audio session status callback for quality monitoring
        (status) => {
          if (status.isLoaded && !status.didJustFinish) {
            console.log(
              "SoundManager: Neutral sound status - Quality:",
              status
            );
          }
        }
      );
      neutralSound = neutralSoundInstance;
      console.log(
        "SoundManager: Neutral sound loaded with high quality successfully"
      );

      // Create success sound with high-quality settings
      console.log("SoundManager: Loading success sound with high quality...");
      const { sound: successSoundInstance } = await Audio.Sound.createAsync(
        successWav as AVPlaybackSource,
        {
          shouldPlay: false,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: false, // Disable pitch correction for better quality
        }
      );
      successSound = successSoundInstance;
      console.log(
        "SoundManager: Success sound loaded with high quality successfully"
      );

      // Create negative sound with high-quality settings
      console.log("SoundManager: Loading negative sound with high quality...");
      const { sound: negativeSoundInstance } = await Audio.Sound.createAsync(
        negativeWav as AVPlaybackSource,
        {
          shouldPlay: false,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: false, // Disable pitch correction for better quality
        }
      );
      negativeSound = negativeSoundInstance;
      console.log(
        "SoundManager: Negative sound loaded with high quality successfully"
      );

      console.log(
        "SoundManager: All sounds loaded with high quality successfully"
      );

      // Wait for the sound to be fully ready and check status
      console.log("SoundManager: Waiting for sound to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (neutralSound) {
        const status = await neutralSound.getStatusAsync();
        console.log("SoundManager: Neutral sound high-quality status:", status);

        if (status.isLoaded) {
          console.log(
            "SoundManager: High-quality sound is loaded, starting playback..."
          );
          // Use replayAsync as it works reliably with expo-av
          await neutralSound.replayAsync();
          console.log(
            "SoundManager: High-quality neutral sound playback started successfully"
          );
        } else {
          console.error("SoundManager: Sound is not loaded, status:", status);
        }
      } else {
        console.error("SoundManager: neutralSound is null");
      }

      isInitialized = true;
      console.log(
        "SoundManager: High-quality initialization completed successfully"
      );
    } catch (error) {
      console.error("Error loading high-quality sounds:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        neutralSoundState: neutralSound ? "created" : "null",
        successSoundState: successSound ? "created" : "null",
        negativeSoundState: negativeSound ? "created" : "null",
      });

      // Clean up any partially created sounds
      await SoundManager.unload();
      isInitialized = false;
    }
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

  /**
   * Fade in background music with configurable options
   */
  fadeInBackgroundMusic: async (options: FadeOptions = {}) => {
    if (!neutralSound) {
      console.warn("Background music not initialized");
      return;
    }
    await SoundManager.fadeIn(neutralSound, options);
  },

  /**
   * Fade out background music with configurable options
   */
  fadeOutBackgroundMusic: async (options: FadeOptions = {}) => {
    if (!neutralSound) {
      console.warn("Background music not initialized");
      return;
    }
    await SoundManager.fadeOut(neutralSound, options);
  },

  /**
   * Play negative sound with slow fade-in for wrong guesses
   */
  playNegativeWithFadeIn: async (options: FadeOptions = {}) => {
    try {
      if (appState !== "active") {
        console.log(
          "SoundManager: Skipping negative sound playback - app not active (" +
            appState +
            ")"
        );
        return;
      }

      if (!isInitialized || !negativeSound) {
        console.warn("Negative sound not initialized");
        return;
      }

      const status = await negativeSound.getStatusAsync();
      if (status.isLoaded) {
        // Set volume to 0 before starting playback
        await negativeSound.setVolumeAsync(0);

        // Start playing the sound
        await negativeSound.replayAsync();

        // Fade in with custom options (default to slow fade)
        const fadeConfig = {
          duration: 1500, // 1.5 seconds for slow fade
          curve: "exponential" as const,
          ...options,
        };

        await SoundManager.fadeIn(negativeSound, fadeConfig);

        console.log("Negative sound played with fade-in successfully");
      }
    } catch (error) {
      console.error("Error playing negative sound with fade-in:", error);
    }
  },

  playSuccess: async () => {
    try {
      // Don't attempt to play sounds when app is in background to prevent AudioFocusNotAcquiredException
      if (appState !== "active") {
        console.log(
          "SoundManager: Skipping success sound - app not in foreground (state:",
          appState,
          ")"
        );
        return;
      }

      if (!isInitialized || !successSound) {
        console.warn("Success sound not initialized");
        return;
      }

      // Verify the sound is still loaded before playing
      const status = await successSound.getStatusAsync();
      if (!status.isLoaded) {
        console.warn("Success sound is not loaded");
        return;
      }

      // Stop any currently playing instance and restart to ensure single instance
      if (status.isPlaying) {
        await successSound.stopAsync();
      }
      await successSound.replayAsync();
      console.log("Success sound played successfully");
    } catch (error) {
      console.error("Error playing success sound:", error);
    }
  },

  playNegative: async () => {
    try {
      // Don't attempt to play sounds when app is in background to prevent AudioFocusNotAcquiredException
      if (appState !== "active") {
        console.log(
          "SoundManager: Skipping negative sound - app not in foreground (state:",
          appState,
          ")"
        );
        return;
      }

      if (!isInitialized || !negativeSound) {
        console.warn("Negative sound not initialized");
        return;
      }

      // Verify the sound is still loaded before playing
      const status = await negativeSound.getStatusAsync();
      if (!status.isLoaded) {
        console.warn("Negative sound is not loaded");
        return;
      }

      // Stop any currently playing instance and restart to ensure single instance
      if (status.isPlaying) {
        await negativeSound.stopAsync();
      }
      await negativeSound.replayAsync();
      console.log("Negative sound played successfully");
    } catch (error) {
      console.error("Error playing negative sound:", error);
    }
  },

  playBackgroundMusic: async () => {
    try {
      // Don't attempt to play sounds when app is in background to prevent AudioFocusNotAcquiredException
      if (appState !== "active") {
        console.log(
          "SoundManager: Skipping background music - app not in foreground (state:",
          appState,
          ")"
        );
        return;
      }

      if (!isInitialized || !neutralSound) {
        console.warn("Neutral sound not initialized");
        return;
      }

      const status = await neutralSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        // Use playAsync instead of replayAsync to preserve looping behavior
        await neutralSound.playAsync();
        console.log("Background music started/resumed successfully");
      } else if (status.isLoaded && status.isPlaying) {
        console.log("Background music is already playing");
      }
    } catch (error) {
      console.error("Error playing background music:", error);
    }
  },

  pauseBackgroundMusic: async () => {
    try {
      if (!isInitialized || !neutralSound) {
        console.warn("Neutral sound not initialized");
        return;
      }

      const status = await neutralSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await neutralSound.pauseAsync();
        console.log("Background music paused successfully");
      }
    } catch (error) {
      console.error("Error pausing background music:", error);
    }
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

      if (neutralSound) {
        await neutralSound.unloadAsync();
        neutralSound = null;
      }
      if (successSound) {
        await successSound.unloadAsync();
        successSound = null;
      }
      if (negativeSound) {
        await negativeSound.unloadAsync();
        negativeSound = null;
      }
      isInitialized = false;
      console.log("SoundManager: All sounds unloaded successfully");
    } catch (error) {
      console.error("Error unloading sounds:", error);
    }
  },
};
