import {StartRaceRunRequestSchema} from "../raceSchemas";

describe("fallback offer request contract", () => {
  const fallbackOfferId = "a".repeat(64);
  const categoryRequest = {categoryId: "mixed", requestId: "fallback-request", fallbackOfferId};

  it("accepts a fallback only for a category request", () => {
    expect(StartRaceRunRequestSchema.safeParse(categoryRequest).success).toBe(true);
    expect(StartRaceRunRequestSchema.safeParse({
      challengeId: "challenge-1", requestId: "fallback-request", fallbackOfferId,
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
