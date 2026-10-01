import {StartRaceRunRequestSchema} from "../raceSchemas";

describe("fallback offer request contract", () => {
  /** Server-issued fallback identifier used across request combinations. */
  const fallbackOfferId = "a".repeat(64);
  /** Valid category request with an explicit supported locale. */
  const categoryRequest = {locale: "en", categoryId: "mixed", requestId: "fallback-request", fallbackOfferId};

  it("accepts a fallback only for a category request", () => {
    expect(StartRaceRunRequestSchema.safeParse(categoryRequest).success).toBe(true);
    expect(StartRaceRunRequestSchema.safeParse({
      locale: "en", challengeId: "challenge-1", requestId: "fallback-request", fallbackOfferId,
    }).success).toBe(false);
  });

  it("rejects a rivalry or match offer combined with a fallback", () => {
    expect(StartRaceRunRequestSchema.safeParse({
      ...categoryRequest, rivalryChallengeId: "rivalry-1",
    }).success).toBe(false);
    expect(StartRaceRunRequestSchema.safeParse({
      ...categoryRequest, offerId: "b".repeat(64),
    }).success).toBe(false);
  });
});
