import {JEST_REFERRAL_REFERENCES, createJestReferralShareReference, isJestRewardedReferralReference} from "../referralCampaigns";

describe("Jest referral references", () => {
  it("keeps generic and legacy campaign references reward eligible", () => {
    expect(isJestRewardedReferralReference(JEST_REFERRAL_REFERENCES.friendChallenge)).toBe(true);
    expect(isJestRewardedReferralReference(JEST_REFERRAL_REFERENCES.raceTo10)).toBe(true);
    expect(isJestRewardedReferralReference("riddle_quest_friend_challenge_v2_result_0123456789abcdef")).toBe(true);
    expect(isJestRewardedReferralReference("riddle_quest_race_to_10_v1_share_fedcba9876543210")).toBe(true);
  });

  it("creates bounded personalized references for result and race shares", () => {
    /** Provides result behavior. */
    const result = createJestReferralShareReference("result", "0123456789abcdef");
    /** Provides race behavior. */
    const race = createJestReferralShareReference("race", "fedcba9876543210");

    expect(result).toBe("rq_fc_v2_0123456789abcdef");
    expect(race).toBe("rq_r10_v1_fedcba9876543210");
    expect(Math.max(result.length, race.length)).toBeLessThanOrEqual(32);
    expect(isJestRewardedReferralReference(result)).toBe(true);
    expect(isJestRewardedReferralReference(race)).toBe(true);
  });

  it.each([
    null,
    "unrelated_reference",
    "rq_fc_v2_not-hex",
    "rq_r10_v1_short",
    "riddle_quest_friend_challenge_v2_result_not-hex",
    "riddle_quest_race_to_10_v1_share_short",
    "riddle_quest_race_to_10_v1_share_0123456789abcdef00",
  ])("rejects malformed or unrelated reference %p", (reference) => {
    expect(isJestRewardedReferralReference(reference)).toBe(false);
  });

  it.each(["", "0123456789abcdeg", "0123456789abcdef00"])("rejects invalid share token %p", (token) => {
    expect(() => createJestReferralShareReference("result", token)).toThrow("invalid-jest-referral-share-token");
  });
});
