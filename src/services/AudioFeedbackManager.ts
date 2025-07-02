import { SoundManager } from "./SoundManager";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import {
  IAudioFeedbackService,
  FeedbackType,
  FeedbackConfig,
} from "./interfaces/IAudioFeedbackService";

export class AudioFeedbackManager implements IAudioFeedbackService {
  private defaultConfig: Required<FeedbackConfig> = {
    playSound: true,
    playHaptic: true,
    fadeInDuration: 1000,
  };

  /**
   * Play neutral feedback for letter input/removal
   */
  async playNeutralFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      if (finalConfig.playSound) {
        await SoundManager.playBackgroundMusic();
      }

      if (finalConfig.playHaptic) {
        ReactNativeHapticFeedback.trigger("impactLight");
      }
    } catch (error) {
      console.error("Error playing neutral feedback:", error);
    }
  }

  /**
   * Play success feedback for correct guesses/wins
   */
  async playSuccessFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      if (finalConfig.playSound) {
        await SoundManager.playSuccess();
      }

      if (finalConfig.playHaptic) {
        ReactNativeHapticFeedback.trigger("notificationSuccess");
      }
    } catch (error) {
      console.error("Error playing success feedback:", error);
    }
  }

  /**
   * Play error feedback for game loss
   */
  async playErrorFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      if (finalConfig.playSound) {
        await SoundManager.playNegativeWithFadeIn({
          duration: finalConfig.fadeInDuration,
          curve: "exponential",
        });
      }

      if (finalConfig.playHaptic) {
        ReactNativeHapticFeedback.trigger("notificationError");
      }
    } catch (error) {
      console.error("Error playing error feedback:", error);
    }
  }

  /**
   * Play wrong guess feedback (less dramatic than error)
   */
  async playWrongGuessFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      if (finalConfig.playSound) {
        await SoundManager.playNegativeWithFadeIn({
          duration: finalConfig.fadeInDuration * 0.7, // Shorter fade for wrong guess
          curve: "linear",
        });
      }

      if (finalConfig.playHaptic) {
        ReactNativeHapticFeedback.trigger("impactMedium");
      }
    } catch (error) {
      console.error("Error playing wrong guess feedback:", error);
    }
  }

  /**
   * Unified feedback method
   */
  async playFeedback(
    type: FeedbackType,
    config: FeedbackConfig = {}
  ): Promise<void> {
    switch (type) {
      case "neutral":
        return this.playNeutralFeedback(config);
      case "success":
        return this.playSuccessFeedback(config);
      case "error":
        return this.playErrorFeedback(config);
      case "wrongGuess":
        return this.playWrongGuessFeedback(config);
      default:
        console.warn(`Unknown feedback type: ${type}`);
    }
  }
}
