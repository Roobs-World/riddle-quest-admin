import type {IAudioFeedbackService, FeedbackType, FeedbackConfig} from "../IAudioFeedbackService";

describe("IAudioFeedbackService", () => {
  it("should be importable as TypeScript types", () => {
    // Test that the types can be imported and used
    const feedbackType: FeedbackType = "neutral";
    const config: FeedbackConfig = {playSound: true, playHaptic: false};

    expect(feedbackType).toBe("neutral");
    expect(config.playSound).toBe(true);
    expect(config.playHaptic).toBe(false);
  });

  it("should define all FeedbackType values", () => {
    const validTypes: FeedbackType[] = ["neutral", "success", "error", "wrongGuess"];

    validTypes.forEach((type) => {
      const feedbackType: FeedbackType = type;
      expect(typeof feedbackType).toBe("string");
    });
  });

  it("should define FeedbackConfig interface with optional properties", () => {
    const config1: FeedbackConfig = {};
    const config2: FeedbackConfig = {playSound: true};
    const config3: FeedbackConfig = {playHaptic: false, fadeInDuration: 500};
    const config4: FeedbackConfig = {
      playSound: true,
      playHaptic: true,
      fadeInDuration: 1000,
    };

    expect(config1).toEqual({});
    expect(config2.playSound).toBe(true);
    expect(config3.playHaptic).toBe(false);
    expect(config4.fadeInDuration).toBe(1000);
  });

  it("should allow implementing the interface", () => {
    class TestAudioService implements IAudioFeedbackService {
      async playNeutralFeedback(config?: FeedbackConfig): Promise<void> {}
      async playSuccessFeedback(config?: FeedbackConfig): Promise<void> {}
      async playErrorFeedback(config?: FeedbackConfig): Promise<void> {}
      async playWrongGuessFeedback(config?: FeedbackConfig): Promise<void> {}
      async playFeedback(type: FeedbackType, config?: FeedbackConfig): Promise<void> {}
    }

    const service = new TestAudioService();
    expect(service).toBeInstanceOf(TestAudioService);
    expect(typeof service.playNeutralFeedback).toBe("function");
    expect(typeof service.playSuccessFeedback).toBe("function");
    expect(typeof service.playErrorFeedback).toBe("function");
    expect(typeof service.playWrongGuessFeedback).toBe("function");
    expect(typeof service.playFeedback).toBe("function");
  });

  it("should define methods that return promises", async () => {
    const mockService: IAudioFeedbackService = {
      playNeutralFeedback: jest.fn().mockResolvedValue(undefined),
      playSuccessFeedback: jest.fn().mockResolvedValue(undefined),
      playErrorFeedback: jest.fn().mockResolvedValue(undefined),
      playWrongGuessFeedback: jest.fn().mockResolvedValue(undefined),
      playFeedback: jest.fn().mockResolvedValue(undefined),
    };

    await expect(mockService.playNeutralFeedback()).resolves.toBeUndefined();
    await expect(mockService.playSuccessFeedback()).resolves.toBeUndefined();
    await expect(mockService.playErrorFeedback()).resolves.toBeUndefined();
    await expect(mockService.playWrongGuessFeedback()).resolves.toBeUndefined();
    await expect(mockService.playFeedback("neutral")).resolves.toBeUndefined();
  });
});
