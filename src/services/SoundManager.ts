import { Audio } from "expo-av";

const neutralSound = new Audio.Sound();
const successSound = new Audio.Sound();
const negativeSound = new Audio.Sound();

export const SoundManager = {
  init: async () => {
    try {
      // Load sounds
      await neutralSound.loadAsync(require("../../assets/audio/Neutral.wav"), {
        isLooping: true,
      });
      await successSound.loadAsync(require("../../assets/audio/Success.wav"));
      await negativeSound.loadAsync(require("../../assets/audio/Negative.wav"));

      // Start neutral sound immediately
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

  // Method to stop all sounds when the app is closed or goes to background (optional but good practice)
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
