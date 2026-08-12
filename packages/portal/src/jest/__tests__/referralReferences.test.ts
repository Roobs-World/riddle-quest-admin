import {
  createJestReferralShareToken,
  createUniqueJestReferralReference,
} from "../sharing/referralReferences";

describe("personalized Jest referral references", () => {
  it("uses fixed-width Web Crypto entropy without leaking target identifiers", () => {
    const token = createJestReferralShareToken((bytes) => {
      bytes.set([0, 1, 15, 16, 31, 32, 127, 255]);
    });

    expect(token).toBe("00010f101f207fff");
    expect(createUniqueJestReferralReference("result", token)).toBe(
      "riddle_quest_friend_challenge_v2_result_00010f101f207fff",
    );
    expect(createUniqueJestReferralReference("race", token)).toBe(
      "riddle_quest_race_to_10_v1_share_00010f101f207fff",
    );
  });

  it("keeps fallback references unique, bounded, and telemetry safe", () => {
    const first = createJestReferralShareToken(null, () => 0x123456789abc);
    const second = createJestReferralShareToken(null, () => 0x123456789abc);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(second).toMatch(/^[0-9a-f]{16}$/);
    expect(createUniqueJestReferralReference("race", second).length).toBeLessThanOrEqual(64);
  });
});
