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

      // Set up audio mode first
      console.log("SoundManager: Setting audio mode...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      console.log("SoundManager: Audio mode set successfully");

      // Create sound instances using createAsync
      console.log("SoundManager: Creating sound instances...");

      // Create neutral sound (background music)
      console.log("SoundManager: Loading neutral sound...");
      console.log("Neutral wav source:", neutralWav);

      const { sound: neutralSoundInstance } = await Audio.Sound.createAsync(
        neutralWav as AVPlaybackSource,
        { isLooping: true, shouldPlay: false }
      );
      neutralSound = neutralSoundInstance;
      console.log("SoundManager: Neutral sound loaded successfully");

      // Create success sound
      console.log("SoundManager: Loading success sound...");
      const { sound: successSoundInstance } = await Audio.Sound.createAsync(
        successWav as AVPlaybackSource,
        { shouldPlay: false }
      );
      successSound = successSoundInstance;
      console.log("SoundManager: Success sound loaded successfully");

      // Create negative sound
      console.log("SoundManager: Loading negative sound...");
      const { sound: negativeSoundInstance } = await Audio.Sound.createAsync(
        negativeWav as AVPlaybackSource,
        { shouldPlay: false }
      );
      negativeSound = negativeSoundInstance;
      console.log("SoundManager: Negative sound loaded successfully");

      console.log("SoundManager: All sounds loaded successfully");

      // Wait for the sound to be fully ready and check status
      console.log("SoundManager: Waiting for sound to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (neutralSound) {
        const status = await neutralSound.getStatusAsync();
        console.log("SoundManager: Neutral sound status:", status);

        if (status.isLoaded) {
          console.log("SoundManager: Sound is loaded, starting playback...");
          // Use replayAsync as it works reliably with expo-av
          await neutralSound.replayAsync();
          console.log(
            "SoundManager: Neutral sound playback started successfully"
          );
        } else {
          console.error("SoundManager: Sound is not loaded, status:", status);
        }
      } else {
        console.error("SoundManager: neutralSound is null");
      }

      isInitialized = true;
      console.log("SoundManager: Initialization completed successfully");
    } catch (error) {
      console.error("Error loading sounds:", error);
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
        await neutralSound.replayAsync();
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
