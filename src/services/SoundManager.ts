import { Audio } from "expo-av";

import neutralWav from "../../assets/audio/Neutral.wav";
import successWav from "../../assets/audio/Success.wav";
import negativeWav from "../../assets/audio/Negative.wav";

const neutralSound = new Audio.Sound();
const successSound = new Audio.Sound();
const negativeSound = new Audio.Sound();

// Assume isSoundEnabled state is managed elsewhere (e.g., in App.tsx or Context)
// and can be accessed or passed here if needed for conditional playback.
// For now, we will assume the check is done at the call site.

export const SoundManager = {
  init: async () => {
    try {
      await neutralSound.loadAsync(neutralWav, {
        isLooping: true,
      });
      await successSound.loadAsync(successWav);
      await negativeSound.loadAsync(negativeWav);

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
