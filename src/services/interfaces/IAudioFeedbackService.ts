export type FeedbackType = "neutral" | "success" | "error" | "wrongGuess";

export interface FeedbackConfig {
  playSound?: boolean;
  playHaptic?: boolean;
  fadeInDuration?: number;
}

/**
 * Interface for audio and haptic feedback operations
 */
export interface IAudioFeedbackService {
  /**
   * Play neutral feedback for letter input/removal
   */
  playNeutralFeedback(config?: FeedbackConfig): Promise<void>;

  /**
   * Play success feedback for correct guesses/wins
   */
  playSuccessFeedback(config?: FeedbackConfig): Promise<void>;

  /**
   * Play error feedback for game loss
   */
  playErrorFeedback(config?: FeedbackConfig): Promise<void>;

  /**
   * Play wrong guess feedback
   */
  playWrongGuessFeedback(config?: FeedbackConfig): Promise<void>;

  /**
   * Unified feedback method
   */
  playFeedback(type: FeedbackType, config?: FeedbackConfig): Promise<void>;
}
