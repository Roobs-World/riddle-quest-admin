import { Audio } from "expo-av";

const neutralSound = new Audio.Sound();
const successSound = new Audio.Sound();
const negativeSound = new Audio.Sound();

// Assume isSoundEnabled state is managed elsewhere (e.g., in App.tsx or Context)
// and can be accessed or passed here if needed for conditional playback.
// For now, we will assume the check is done at the call site.

export const SoundManager = {
  init: async () => {
    try {
      await neutralSound.loadAsync(require("../../assets/audio/Neutral.wav"), {
        isLooping: true,
      });
      await successSound.loadAsync(require("../../assets/audio/Success.wav"));
      await negativeSound.loadAsync(require("../../assets/audio/Negative.wav"));

      await neutralSound.playAsync();
    } catch (error) {
      console.error("Error loading sounds:", error);
    }
  },

  playSuccess: async () => {
    try {
      await successSound.replayAsync();
    } catch (error) {
      console.error("Error playing success sound:", error);
    }
  },

  playNegative: async () => {
    try {
      await negativeSound.replayAsync();
    } catch (error) {
      console.error("Error playing negative sound:", error);
    }
  },

  playBackgroundMusic: async () => {
    try {
      const status = await neutralSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await neutralSound.playAsync();
      }
    } catch (error) {
      console.error("Error playing background music:", error);
    }
  },

  pauseBackgroundMusic: async () => {
    try {
      const status = await neutralSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await neutralSound.pauseAsync();
      }
    } catch (error) {
      console.error("Error pausing background music:", error);
    }
  },

  unload: async () => {
    try {
      await neutralSound.unloadAsync();
      await successSound.unloadAsync();
      await negativeSound.unloadAsync();
    } catch (error) {
      console.error("Error unloading sounds:", error);
    }
  },
};
