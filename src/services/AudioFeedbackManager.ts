/**
 * @fileoverview
 * Audio and haptics feedback service used by game state and UI components.
 *
 * `AudioFeedbackManager` implements `IAudioFeedbackService` and provides
 * a centralized place to coordinate sound effects and haptic patterns for
 * neutral input, successes, errors, and wrong guesses.
 *
 * It respects per-call overrides while applying a default configuration
 * that keeps behavior consistent across the app.
 */
import {SoundManager} from "./SoundManager";
import * as Haptics from "expo-haptics";
import {IAudioFeedbackService, FeedbackType, FeedbackConfig} from "./interfaces/IAudioFeedbackService";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";

/**
 * Default implementation of `IAudioFeedbackService` for Riddle Quest.
 */
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
    const finalConfig = {...this.defaultConfig, ...config};

    try {
      if (finalConfig.playSound) {
        await SoundManager.playBackgroundMusic();
      }

      if (finalConfig.playHaptic) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      logger.error("Error playing neutral feedback:", error);
      captureException(error);
    }
  }

  /**
   * Play success feedback for correct guesses/wins
   */
  async playSuccessFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = {...this.defaultConfig, ...config};

    try {
      if (finalConfig.playSound) {
        await SoundManager.playSuccess();
      }

      if (finalConfig.playHaptic) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      logger.error("Error playing success feedback:", error);
      captureException(error);
    }
  }

  /**
   * Play error feedback for game loss
   */
  async playErrorFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = {...this.defaultConfig, ...config};

    try {
      if (finalConfig.playSound) {
        await SoundManager.playNegativeWithFadeIn({
          duration: finalConfig.fadeInDuration,
          curve: "exponential",
        });
      }

      if (finalConfig.playHaptic) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      logger.error("Error playing error feedback:", error);
      captureException(error);
    }
  }

  /**
   * Play wrong guess feedback (less dramatic than error)
   */
  async playWrongGuessFeedback(config: FeedbackConfig = {}): Promise<void> {
    const finalConfig = {...this.defaultConfig, ...config};

    try {
      if (finalConfig.playSound) {
        await SoundManager.playNegativeWithFadeIn({
          duration: finalConfig.fadeInDuration * 0.7, // Shorter fade for wrong guess
          curve: "linear",
        });
      }

      if (finalConfig.playHaptic) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logger.error("Error playing wrong guess feedback:", error);
      captureException(error);
    }
  }

  /**
   * Unified feedback method
   */
  async playFeedback(type: FeedbackType, config: FeedbackConfig = {}): Promise<void> {
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
        logger.warn(`Unknown feedback type: ${type}`);
    }
  }
}
