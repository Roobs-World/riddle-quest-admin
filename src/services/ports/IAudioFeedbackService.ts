export type FeedbackType = "neutral" | "success" | "error" | "wrongGuess";

export interface FeedbackConfig {
  playSound?: boolean;
  playHaptic?: boolean;
  fadeInDuration?: number;
}

/**
 * Port for audio and haptic feedback.
 */
export interface IAudioFeedbackService {
  playNeutralFeedback(config?: FeedbackConfig): Promise<void>;
  playSuccessFeedback(config?: FeedbackConfig): Promise<void>;
  playErrorFeedback(config?: FeedbackConfig): Promise<void>;
  playWrongGuessFeedback(config?: FeedbackConfig): Promise<void>;
  playFeedback(type: FeedbackType, config?: FeedbackConfig): Promise<void>;
}
