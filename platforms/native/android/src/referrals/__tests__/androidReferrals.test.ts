import {describe, expect, it} from "@jest/globals";
import {androidReferralUrl, parseAndroidReferralUrl} from "../androidReferrals";

/** Untrusted native links carry an opaque handle rather than an account, award or external destination. */
describe("Android referral entry", () => {
  it("round-trips the exact server token and rejects additional navigation or reward fields", () => {
    /** Opaque provider token, never a local grant or account selector. */
    const token = "A_b-".repeat(10) + "xyz";
    expect(parseAndroidReferralUrl(androidReferralUrl(token))).toBe(token);
    for (const url of [
      "https://example.com/referral?token=" + token,
      "riddlequest://referral?token=" + token + "&coins=10000",
      "riddlequest://referral?token=" + token + "#extra",
      "riddlequest://referral?token=" + "a".repeat(42),
      "riddlequest://race?token=" + token,
    ])
      expect(parseAndroidReferralUrl(url)).toBeNull();
    expect(() => androidReferralUrl("untrusted-token")).toThrow("android-referral-token-invalid");
  });
});
